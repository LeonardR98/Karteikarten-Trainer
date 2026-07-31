import { CloudUpload } from "lucide-react";
import { Button } from "../../components/Button.jsx";

export function ImportPreviewModal({ preview, isImporting, onImport, onSkip, isClosing = false, onAnimationEnd }) {
  return (
    <div className={`import-dialog-backdrop ${isClosing ? "is-closing" : ""}`} role="presentation" onAnimationEnd={onAnimationEnd}>
      <section className={`import-dialog ${isClosing ? "is-closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="import-preview-title">
        <h2 id="import-preview-title">Lokale Karteikarten gefunden</h2>
        <p>
          Auf diesem Gerät liegen <strong>{preview.deckCount} Decks</strong> mit{" "}
          <strong>{preview.cardCount} Karten</strong> ({preview.deckNames.join(", ")}).
          Sollen sie einmalig in deine privaten Cloud-Decks übernommen werden?
        </p>

        <div className="import-dialog-actions">
          <Button onClick={onSkip} variant="outline" className="rounded-xl" disabled={isImporting}>
            Überspringen
          </Button>
          <Button onClick={onImport} className="rounded-xl" disabled={isImporting}>
            <CloudUpload className="mr-2 h-4 w-4" />
            {isImporting ? "Importiere…" : "Importieren"}
          </Button>
        </div>
      </section>
    </div>
  );
}
