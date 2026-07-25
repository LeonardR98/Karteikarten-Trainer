import { useState } from "react";
import { X } from "lucide-react";
import { normalizeTags } from "../lib/storage.js";

export function TagPicker({ tags, onChange, suggestions = [], label = "Themen" }) {
  const [draft, setDraft] = useState("");

  function addTag(name) {
    const next = normalizeTags([...tags, name]);
    onChange(next);
    setDraft("");
  }

  function removeTag(name) {
    onChange(tags.filter((tag) => tag !== name));
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      if (draft.trim()) addTag(draft);
    }
  }

  const remainingSuggestions = suggestions.filter(
    (name) => !tags.some((tag) => tag.toLowerCase() === name.toLowerCase())
  );

  return (
    <div className="tag-picker">
      <span className="tag-picker-label">{label}</span>
      <div className="tag-picker-chips">
        {tags.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Tag ${tag} entfernen`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => draft.trim() && addTag(draft)}
          placeholder="Tag hinzufügen…"
          list="tag-picker-suggestions"
          className="tag-picker-input"
        />
      </div>
      {remainingSuggestions.length > 0 && (
        <datalist id="tag-picker-suggestions">
          {remainingSuggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}
    </div>
  );
}
