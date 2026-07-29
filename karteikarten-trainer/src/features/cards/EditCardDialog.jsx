import { Save } from "lucide-react";
import { Button } from "../../components/Button.jsx";
import { RichTextEditor } from "../../components/RichTextEditor.jsx";
import { TagPicker } from "../../components/TagPicker.jsx";

// See AddCardDialog.jsx for the sideBySide/standalone rendering rationale.
export function EditCardDialog({
  sideBySide = false,
  question,
  onQuestionChange,
  answer,
  onAnswerChange,
  tags,
  onTagsChange,
  suggestions,
  onCancel,
  onSubmit,
}) {
  const content = (
    <>
      <h2 id="edit-card-title">Karte bearbeiten</h2>
      <p>Ändere Frage oder Antwort dieser Karte.</p>
      <label>
        Frage
        <RichTextEditor value={question} onChange={onQuestionChange} label="Frage" />
      </label>
      <label>
        Antwort
        <RichTextEditor value={answer} onChange={onAnswerChange} label="Antwort" />
      </label>
      <TagPicker tags={tags} onChange={onTagsChange} suggestions={suggestions} />
      <div className="import-dialog-actions">
        <Button onClick={onCancel} variant="outline" className="rounded-xl">
          Abbrechen
        </Button>
        <Button onClick={onSubmit} className="rounded-xl">
          <Save className="mr-2 h-4 w-4" />
          Speichern
        </Button>
      </div>
    </>
  );

  if (sideBySide) {
    return (
      <section className="card-dialog card-dialog-side" role="dialog" aria-modal="true" aria-labelledby="edit-card-title">
        {content}
      </section>
    );
  }

  return (
    <div className="import-dialog-backdrop" role="presentation">
      <section className="card-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-card-title">
        {content}
      </section>
    </div>
  );
}
