import { Bold, List } from "lucide-react";
import { useEffect, useRef } from "react";
import { normalizeCardText } from "../lib/storage.js";

// A small, dependency-free rich text editor: a contenteditable div that
// shows **bold**/"- list" formatting live (real bold text, real bullets)
// while still reading/writing the same markdown-lite string every other
// part of the app uses (cards, CSV export/import, search, ...). No editor
// library — just document.execCommand for bold/list toggling (deprecated
// API, but the only browser-native way to do this without one) and manual
// HTML<->markdown conversion below.

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineHtml(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function markdownToHtml(value) {
  const lines = normalizeCardText(value).split("\n");
  const blocks = [];
  let listItems = [];

  function flushList() {
    if (!listItems.length) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${inlineHtml(item)}</li>`).join("")}</ul>`);
    listItems = [];
  }

  lines.forEach((line) => {
    const match = line.match(/^[-*]\s+(.*)$/);
    if (match) {
      listItems.push(match[1]);
      return;
    }

    flushList();
    blocks.push(`<div>${line ? inlineHtml(line) : "<br>"}</div>`);
  });
  flushList();

  return blocks.join("");
}

function inlineTextFromNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeName === "BR") return "";

  if (node.nodeName === "STRONG" || node.nodeName === "B") {
    const inner = Array.from(node.childNodes).map(inlineTextFromNode).join("");
    return inner ? `**${inner}**` : "";
  }

  return Array.from(node.childNodes || []).map(inlineTextFromNode).join("");
}

function lineTextFrom(node) {
  return Array.from(node.childNodes).map(inlineTextFromNode).join("");
}

function htmlToMarkdown(root) {
  const lines = [];

  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      lines.push(node.textContent);
      return;
    }

    if (node.nodeName === "UL" || node.nodeName === "OL") {
      Array.from(node.children).forEach((item) => lines.push(`- ${lineTextFrom(item)}`));
      return;
    }

    if (node.nodeName === "BR") {
      lines.push("");
      return;
    }

    lines.push(lineTextFrom(node));
  });

  return lines.join("\n");
}

export function RichTextEditor({ value, onChange, label }) {
  const editorRef = useRef(null);
  const lastEmittedValueRef = useRef(undefined);

  // Only resync innerHTML when `value` changed for a reason other than our
  // own typing (e.g. switching which card is being edited) — otherwise
  // every keystroke would reset the DOM and throw the cursor around.
  useEffect(() => {
    if (value === lastEmittedValueRef.current) return;
    if (editorRef.current) {
      editorRef.current.innerHTML = markdownToHtml(value);
    }
    lastEmittedValueRef.current = value;
  }, [value]);

  function syncFromDom() {
    if (!editorRef.current) return;
    const nextValue = htmlToMarkdown(editorRef.current);
    const normalized = nextValue.trim() ? nextValue : "";

    if (!normalized) editorRef.current.innerHTML = "";

    lastEmittedValueRef.current = normalized;
    onChange(normalized);
  }

  function maybeReplaceArrow() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;

    const offset = range.startOffset;
    if (node.textContent.slice(offset - 2, offset) !== "->") return;

    node.textContent = `${node.textContent.slice(0, offset - 2)}→${node.textContent.slice(offset)}`;

    const nextRange = document.createRange();
    nextRange.setStart(node, offset - 1);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
  }

  function handleInput() {
    maybeReplaceArrow();
    syncFromDom();
  }

  function handleFocus() {
    // Make Enter create <div> lines consistently across browsers, matching
    // what htmlToMarkdown expects (one block element per line).
    try {
      document.execCommand("defaultParagraphSeparator", false, "div");
    } catch {
      // Unsupported in some browsers — harmless, worst case mixed <br> use.
    }
  }

  function toggleBold() {
    // No explicit .focus() here: the toolbar button's onMouseDown already
    // preventDefault()s so the editor never loses focus/selection in the
    // first place — calling .focus() again can reset the selection in some
    // browsers, applying the command to the wrong range.
    document.execCommand("bold");
    syncFromDom();
  }

  function toggleBulletList() {
    document.execCommand("insertUnorderedList");
    syncFromDom();
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
      <div
        ref={editorRef}
        className="rich-text-input"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        data-placeholder={`${label} eingeben`}
        onInput={handleInput}
        onFocus={handleFocus}
      />
    </div>
  );
}
