import { normalizeCardText } from "../lib/storage.js";

// Renders text with a small markdown subset: "- item" bullet lists and
// **bold** inline spans. Used for the flashcard faces, collection list
// previews, and the live edit-mode preview in RichTextEditor.jsx.
export function FormattedCardText({ value, className = "" }) {
  const lines = normalizeCardText(value).split("\n");
  const blocks = [];
  let listItems = [];

  function inlineText(text) {
    return text.split(/(\*\*.+?\*\*)/g).map((part, index) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={index}>{part.slice(2, -2)}</strong>
        : part
    );
  }

  function flushList() {
    if (!listItems.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {listItems.map((item, index) => <li key={index}>{inlineText(item)}</li>)}
      </ul>
    );
    listItems = [];
  }

  lines.forEach((line) => {
    const match = line.match(/^[-*]\s+(.*)$/);
    if (match) {
      listItems.push(match[1]);
      return;
    }

    flushList();
    blocks.push(
      line
        ? <div key={`line-${blocks.length}`}>{inlineText(line)}</div>
        : <div key={`line-${blocks.length}`} className="formatted-empty-line" aria-hidden="true">&nbsp;</div>
    );
  });
  flushList();

  return <div className={className}>{blocks}</div>;
}
