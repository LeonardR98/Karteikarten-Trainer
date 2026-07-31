import { Button } from "../../components/Button.jsx";

// Shown after a CSV file was parsed (see importCsv in App.jsx) to pick the
// target deck (existing or new) before actually inserting the cards.
export function CsvImportDialog({
  pendingCount,
  decks,
  importDeckId,
  onImportDeckIdChange,
  importNewDeckName,
  onImportNewDeckNameChange,
  onCancel,
  onImport,
  isClosing = false,
  onAnimationEnd,
}) {
  return (
    <div className={`import-dialog-backdrop ${isClosing ? "is-closing" : ""}`} role="presentation" onAnimationEnd={onAnimationEnd}>
      <section className={`import-dialog ${isClosing ? "is-closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="import-title">
        <h2 id="import-title">CSV in ein Deck importieren</h2>
        <p>{pendingCount} gültige Karten wurden gefunden. Wähle ihr Ziel-Deck.</p>

        <label>
          Ziel-Deck
          <select value={importDeckId} onChange={(event) => onImportDeckIdChange(event.target.value)}>
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>{deck.name}</option>
            ))}
            <option value="new">Neues Deck anlegen …</option>
          </select>
        </label>

        {importDeckId === "new" && (
          <label>
            Name des neuen Decks
            <input
              value={importNewDeckName}
              onChange={(event) => onImportNewDeckNameChange(event.target.value)}
              placeholder="z. B. Klausurvorbereitung"
              autoFocus
            />
          </label>
        )}

        <div className="import-dialog-actions">
          <Button onClick={onCancel} variant="outline" className="rounded-xl">
            Abbrechen
          </Button>
          <Button onClick={onImport} className="rounded-xl">
            Importieren
          </Button>
        </div>
      </section>
    </div>
  );
}
