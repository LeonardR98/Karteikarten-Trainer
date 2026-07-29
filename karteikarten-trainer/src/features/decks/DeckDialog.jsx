import { Button } from "../../components/Button.jsx";

// Create/rename/delete deck dialog; `deckDialog` is `{ type, deck }` or null.
export function DeckDialog({ deckDialog, deckDialogName, onNameChange, onCancel, onConfirm }) {
  return (
    <div className="import-dialog-backdrop" role="presentation">
      <section className="deck-dialog" role="dialog" aria-modal="true" aria-labelledby="deck-dialog-title">
        <h2 id="deck-dialog-title">
          {deckDialog.type === "create"
            ? "Neues Deck erstellen"
            : deckDialog.type === "rename"
              ? "Deck umbenennen"
              : "Deck löschen"}
        </h2>

        {deckDialog.type === "delete" ? (
          <p>
            Möchtest du das Deck „{deckDialog.deck.name}“ wirklich löschen?
            Alle enthaltenen Karten werden ebenfalls gelöscht.
          </p>
        ) : (
          <label>
            Deckname
            <input
              value={deckDialogName}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="z. B. Englisch Vokabeln"
              autoFocus
            />
          </label>
        )}

        <div className="import-dialog-actions">
          <Button onClick={onCancel} variant="outline" className="rounded-xl">
            Abbrechen
          </Button>
          <Button
            onClick={onConfirm}
            className={`rounded-xl ${deckDialog.type === "delete" ? "deck-delete-confirm" : ""}`}
          >
            {deckDialog.type === "delete" ? "Endgültig löschen" : "Speichern"}
          </Button>
        </div>
      </section>
    </div>
  );
}
