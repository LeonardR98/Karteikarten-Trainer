# Karteikarten-Trainer

Karteikarten-App mit Spaced-Repetition-Levels (Falsch → Mittel → Gut →
Verstanden). Läuft offline mit `localStorage` oder, nach Anmeldung,
Cloud-synchronisiert und geteilt über Supabase (mehrere Nutzer pro Deck,
Rollen owner/editor/viewer).

## Setup & Scripts

```bash
npm install
npm run dev      # Dev-Server (Vite)
npm run build    # Production-Build nach build/
npm run lint     # ESLint über das ganze Projekt
npm test         # Vitest (aktuell: src/data/localBackend.test.js)
```

Für den Cloud-Modus werden `VITE_SUPABASE_URL` und
`VITE_SUPABASE_PUBLISHABLE_KEY` in einer `.env` benötigt (siehe
`.env.example`). Ohne diese Werte läuft die App automatisch im lokalen
Offline-Modus (`src/lib/supabaseClient.js`).

## Ordner-Karte

| Pfad | Zweck |
|---|---|
| `src/App.jsx` | Orchestrator: hält den gemeinsamen State (aktives Deck/Karte, offene Dialoge, Drag&Drop) und die Handler, die die Data-Layer-Actions aufrufen. Komponiert nur noch die Feature-Komponenten unten, enthält selbst kein Feature-JSX mehr. |
| `src/features/decks/` | Alles rund um Decks: `DeckSidebar.jsx` (Liste + Kachel), `DeckDialog.jsx` (Erstellen/Umbenennen/Löschen), `DeckSettingsModal.jsx` (Tabs Allgemein/Themen/Zusammenarbeit). |
| `src/features/cards/` | Alles rund um Karten: `CardReviewPanel.jsx` (Flip-Karte + Bewerten), `CollectionPanel.jsx` (Suche/Filter/Liste), `StatsPanel.jsx` (Level-Statistik), `AddCardDialog.jsx` / `EditCardDialog.jsx`, `CardDisplay.jsx` (geteilte `Badge`/`FormattedCardText`-Helfer). |
| `src/features/csv-import/` | CSV-Import-Flow: `CsvImportDialog.jsx` (Zieldeck wählen), `ImportPreviewModal.jsx` (Übernahme lokaler Daten nach Login). |
| `src/components/` | Generische, feature-unabhängige UI-Bausteine: `Button.jsx`, `RichTextEditor.jsx`, `TagPicker.jsx`, `TagBadgeList.jsx`, `TagFilterBar.jsx`. |
| `src/data/` | Backend-Abstraktion, siehe unten. |
| `src/auth/` | Supabase-Auth: `AuthContext.jsx` (Session-State), `LoginModal.jsx`, `AcceptInviteScreen.jsx` (Einladungslink-Flow). |
| `src/lib/` | Reine Hilfsfunktionen ohne React: `storage.js` (Level-Logik, CSV im-/export, Text-Normalisierung), `srs.js` (gewichtete Kartenauswahl), `supabaseClient.js`. |
| `api/` | Vercel-Serverless-Functions für Invite-Links (`decks/create-invite.js`, `decks/accept-invite.js`) mit Service-Role-Zugriff (`_supabaseAdmin.js`). |
| `supabase/migrations/` | SQL-Schema + RLS-Policies, chronologisch nummeriert. |
| `*.css` (in `src/`) | Global importiert in `main.jsx`, nicht pro Komponente gescoped. `decks.css` = Deck-Sidebar/Dialoge/Backdrops, `tags.css` = Deck-Einstellungen/Tags, `flashcard.css` = Flip-Karte, `concept.css` = Grundlayout/Karten-Container, `App.css`/`index.css` = Basis-Resets. Beim Ändern von Klassen zuerst dort suchen, wo die Klasse schon verwendet wird (`grep -rn "klassenname" src/*.css`), statt neue Dateien anzulegen. |

## Datenfluss: lokal vs. Cloud

`src/data/DataProvider.jsx` ist die einzige Stelle, die zwischen den beiden
Backends umschaltet:

- **Signed-out**: `localBackend.js` — synchron, State im Memory + Spiegel in
  `localStorage`.
- **Authentifiziert**: `supabaseBackend.js` — asynchron, jede Aktion schreibt
  direkt nach Supabase und patcht den lokalen State aus der Antwort (kein
  Refetch-nach-jeder-Aktion).

Beide Backends implementieren dieselbe Action-Surface (`createDeck`,
`addCard`, `rateCard`, `deleteCard`, …), die UI-Komponenten kennen den
Unterschied nicht — sie rufen immer nur `useData().actions.*` auf.

## Bisherige wichtige Entscheidungen/Fixes

Kurzreferenz, damit nicht dieselbe Analyse zweimal gemacht werden muss:

- **Round-Trip-Parallelisierung**: `fetchState()` und `setCardTags()` in
  `supabaseBackend.js` liefen ursprünglich komplett sequenziell (bis zu 5
  Requests nacheinander bei `addCard`, 4 bei `fetchState`). Wo Requests
  nicht voneinander abhängen, laufen sie jetzt über `Promise.all` parallel.
- **Kein Refetch nach eigenen Aktionen**: `DataProvider.jsx` abonniert
  Supabase-Realtime auf `cards`/`tags`/`card_tags`, um Änderungen anderer
  Deck-Mitglieder zu übernehmen. Ohne Schutz löste das nach jeder eigenen
  Aktion (schon lokal übernommen) einen unnötigen kompletten Refetch aus —
  `skipRefetchUntilRef` unterdrückt das kurz nach eigenen Mutationen.
- **Deck-Einstellungen + Karte bearbeiten/hinzufügen nebeneinander**: Beide
  Dialoge können gleichzeitig offen sein (z. B. Karte im "Themen"-Tab
  bearbeiten). `DeckSettingsModal` rendert dafür **keinen eigenen** Backdrop
  mehr (das führte zu einem verschachtelten `position: fixed`-Layer, der den
  Karten-Dialog optisch verdeckt hat) — `App.jsx` legt bei Bedarf einen
  gemeinsamen Backdrop mit Flex-Row um beide Panels.
- **`profiles`-RLS für Mitgliedernamen**: Migration
  `0002_profiles_deck_visibility.sql` erlaubt das Lesen von
  `email`/`display_name` anderer Nutzer, mit denen man ein Deck teilt.
  Vorher zeigte "Zusammenarbeit" andere Mitglieder nur als UUID, weil RLS
  nur das eigene Profil sichtbar machte.
- **CSS bewusst nicht umstrukturiert**: Die fünf CSS-Dateien sind nach
  App-Ära benannt statt nach der aktuellen Feature-Struktur, werden aber
  global importiert (gewachsene Kaskade/Spezifität) — ein Umbau war für den
  Restrukturierungs-Task zu riskant für den Nutzen. Siehe Tabelle oben,
  welche Datei welchen Bereich stylt.
