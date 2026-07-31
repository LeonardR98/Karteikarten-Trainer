import { Plus } from "lucide-react";
import { Button } from "../../components/Button.jsx";
import { RichTextEditor } from "../../components/RichTextEditor.jsx";
import { TagPicker } from "../../components/TagPicker.jsx";
import { ImagePickerField } from "./ImagePickerField.jsx";

// Rendered two ways depending on context: standalone with its own
// fullscreen backdrop, or `sideBySide` as a bare panel meant to sit next to
// an already-open DeckSettingsModal (parent supplies the shared backdrop +
// flex row in that case — see App.jsx).
export function AddCardDialog({
  sideBySide = false,
  activeDeckName,
  question,
  onQuestionChange,
  answer,
  onAnswerChange,
  questionImage,
  onQuestionImageChange,
  answerImage,
  onAnswerImageChange,
  tags,
  onTagsChange,
  suggestions,
  tagColors,
  onCancel,
  onSubmit,
  isClosing = false,
  onAnimationEnd,
}) {
  const content = (
    <>
      <h2 id="new-card-title">Neue Karte</h2>
      <p>Die Karte wird dem aktiven Deck „{activeDeckName}“ hinzugefügt.</p>
      <div className="card-dialog-field">
        Frage
        <RichTextEditor value={question} onChange={onQuestionChange} label="Frage" />
        <ImagePickerField value={questionImage} onChange={onQuestionImageChange} label="Frage" />
      </div>
      <div className="card-dialog-field">
        Antwort
        <RichTextEditor value={answer} onChange={onAnswerChange} label="Antwort" />
        <ImagePickerField value={answerImage} onChange={onAnswerImageChange} label="Antwort" />
      </div>
      <TagPicker tags={tags} onChange={onTagsChange} suggestions={suggestions} tagColors={tagColors} />
      <div className="import-dialog-actions">
        <Button onClick={onCancel} variant="outline" className="rounded-xl">
          Abbrechen
        </Button>
        <Button onClick={onSubmit} className="rounded-xl">
          <Plus className="mr-2 h-4 w-4" />
          Karte anlegen
        </Button>
      </div>
    </>
  );

  if (sideBySide) {
    return (
      <section
        className={`card-dialog card-dialog-side ${isClosing ? "is-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-card-title"
        onAnimationEnd={onAnimationEnd}
      >
        {content}
      </section>
    );
  }

  return (
    <div className={`import-dialog-backdrop ${isClosing ? "is-closing" : ""}`} role="presentation" onAnimationEnd={onAnimationEnd}>
      <section className={`card-dialog ${isClosing ? "is-closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="new-card-title">
        {content}
      </section>
    </div>
  );
}
