import { Bold, List } from "lucide-react";
import { useRef } from "react";
import { FormattedCardText } from "./FormattedCardText.jsx";

export function RichTextEditor({ value, onChange, label }) {
  const editorRef = useRef(null);

  function handleChange(event) {
    const textarea = event.target;
    const cursor = textarea.selectionStart;

    // Auto-convert a typed "->" into a real arrow, right at the cursor.
    if (textarea.value.slice(cursor - 2, cursor) === "->") {
      const nextValue = `${textarea.value.slice(0, cursor - 2)}→${textarea.value.slice(cursor)}`;
      const nextCursor = cursor - 1;
      onChange(nextValue);
      window.requestAnimationFrame(() => {
        editorRef.current?.focus();
        editorRef.current?.setSelectionRange(nextCursor, nextCursor);
      });
      return;
    }

    onChange(textarea.value);
  }

  function updateText(nextValue, start, end) {
    onChange(nextValue);
    window.requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(start, end);
    });
  }

  function toggleBold() {
    const textarea = editorRef.current;
    if (!textarea) return;
    const { selectionStart: start, selectionEnd: end } = textarea;
    const selected = value.slice(start, end);
    const before = value.slice(0, start);
    const after = value.slice(end);
    const isWrapped = before.endsWith("**") && after.startsWith("**");

    if (isWrapped) {
      updateText(`${before.slice(0, -2)}${selected}${after.slice(2)}`, start - 2, end - 2);
      return;
    }

    if (!selected) {
      updateText(`${before}****${after}`, start + 2, start + 2);
      return;
    }

    updateText(`${before}**${selected}**${after}`, start + 2, end + 2);
  }

  function toggleBulletList() {
    const textarea = editorRef.current;
    if (!textarea) return;
    const { selectionStart: start, selectionEnd: end } = textarea;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndIndex = value.indexOf("\n", end);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const selectedLines = value.slice(lineStart, lineEnd).split("\n");
    const isList = selectedLines.every((line) => /^[-*]\s+/.test(line) || !line);
    const nextLines = selectedLines.map((line) => {
      if (!line) return line;
      return isList ? line.replace(/^[-*]\s+/, "") : `- ${line}`;
    });
    const nextSegment = nextLines.join("\n");
    const nextValue = `${value.slice(0, lineStart)}${nextSegment}${value.slice(lineEnd)}`;
    updateText(nextValue, lineStart, lineStart + nextSegment.length);
  }

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" role="toolbar" aria-label={`${label} formatieren`}>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={toggleBold} aria-label="Fett markieren" title="Fett">
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={toggleBulletList} aria-label="Aufzählung erstellen" title="Aufzählung">
          <List className="h-4 w-4" />
        </button>
      </div>
      <textarea
        ref={editorRef}
        className="rich-text-input"
        value={value}
        aria-label={label}
        placeholder={`${label} eingeben`}
        onChange={handleChange}
      />
      <div className="rich-text-preview">
        <span className="rich-text-preview-label">Vorschau</span>
        {value.trim() ? (
          <FormattedCardText value={value} className="rich-text-preview-content" />
        ) : (
          <p className="rich-text-preview-empty">Vorschau erscheint hier.</p>
        )}
      </div>
    </div>
  );
}
