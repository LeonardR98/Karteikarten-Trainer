import { useState } from "react";
import { ChevronDown, ChevronUp, Filter } from "lucide-react";
import { getTagColorStyle } from "../lib/tagColors.js";

const SORT_OPTIONS = [
  { value: "default", label: "Standard" },
  { value: "question-asc", label: "Frage A–Z" },
  { value: "newest", label: "Neueste zuerst" },
  { value: "level", label: "Nach Kategorie" },
];

export function TagFilterBar({ allTags, selectedTags, onSelectedTagsChange, sortBy, onSortByChange, tagColors }) {
  const [isOpen, setIsOpen] = useState(false);

  function toggleTag(tag) {
    if (selectedTags.includes(tag)) {
      onSelectedTagsChange(selectedTags.filter((item) => item !== tag));
    } else {
      onSelectedTagsChange([...selectedTags, tag]);
    }
  }

  const summary = selectedTags.length ? selectedTags.join(", ") : "Alle";

  return (
    <div className="tag-filter-bar">
      <button
        type="button"
        className="tag-filter-toggle"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
      >
        <Filter className="h-4 w-4" />
        <span>Thema: {summary}</span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="tag-filter-panel">
          {allTags.length ? (
            <div className="tag-filter-options">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-chip ${selectedTags.includes(tag) ? "is-selected" : ""}`}
                  onClick={() => toggleTag(tag)}
                  style={getTagColorStyle(tag, tagColors)}
                >
                  {tag}
                </button>
              ))}
            </div>
          ) : (
            <p className="tag-filter-empty">Noch keine Themen in diesem Deck.</p>
          )}

          <label className="tag-filter-sort">
            Sortierung
            <select value={sortBy} onChange={(event) => onSortByChange(event.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
