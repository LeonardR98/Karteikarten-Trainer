import { useState } from "react";
import { ChevronDown, ChevronUp, Paintbrush, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { Card, CardContent } from "../../components/Button.jsx";
import { TagBadgeList } from "../../components/TagBadgeList.jsx";
import { TagFilterBar } from "../../components/TagFilterBar.jsx";
import { cardTextToPlainText } from "../../lib/storage.js";
import { TAG_COLOR_PALETTE } from "../../lib/tagColors.js";
import { NO_TOPIC_LABEL, groupCardsByTopic } from "../../lib/tagGroups.js";
import { Badge } from "./CardDisplay.jsx";

// "Sammlung": search/filter/sort over the active deck's cards, plus
// per-card edit/delete and drag-to-move-between-decks (drop target lives
// in DeckSidebar; draggedCardId is lifted to App.jsx so both sides share it).
// Cards are grouped by topic exactly like DeckSettingsModal's "Themen" tab
// (same groupCardsByTopic helper + rename/color controls), but each card
// keeps this panel's own richer card design instead of the settings-modal
// topic-card style.
export function CollectionPanel({
  activeCardsCount,
  isCollectionOpen,
  onToggleCollection,
  onAddCard,
  searchTerm,
  onSearchTermChange,
  deckTags,
  tagColors,
  selectedTags,
  onSelectedTagsChange,
  sortBy,
  onSortByChange,
  filteredCards,
  currentId,
  onSelectCard,
  draggedCardId,
  onDragStartCard,
  onDragEndCard,
  onEditCard,
  onDeleteCard,
  onRenameTag,
  onSetTagColor,
}) {
  const [renamingTopic, setRenamingTopic] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [colorPickerTopic, setColorPickerTopic] = useState(null);

  function startRenameTopic(topic) {
    setRenamingTopic(topic);
    setRenameDraft(topic);
  }

  function submitRenameTopic() {
    const trimmed = renameDraft.trim();
    if (trimmed && trimmed !== renamingTopic) onRenameTag(renamingTopic, trimmed);
    setRenamingTopic(null);
  }

  const groupedByTopic = groupCardsByTopic(filteredCards);

  return (
    <aside className="concept-collection space-y-6">
      <Card className="collection-panel rounded-3xl border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Sammlung</h2>

            <div className="collection-heading-actions">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium">
                {activeCardsCount}
              </span>
              <button
                type="button"
                className="collection-add-card"
                onClick={onAddCard}
                aria-label="Neue Karte anlegen"
              >
                <Plus className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="collection-toggle"
                onClick={onToggleCollection}
                aria-label={isCollectionOpen ? "Sammlung einklappen" : "Sammlung ausklappen"}
                aria-expanded={isCollectionOpen}
              >
                {isCollectionOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {isCollectionOpen && (
            <>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />

                <input
                  value={searchTerm}
                  onChange={(event) => onSearchTermChange(event.target.value)}
                  placeholder="Suchen..."
                  className="w-full rounded-2xl border bg-white py-2 pl-10
                  pr-3 outline-none ring-blue-200 focus:ring-4"
                />
              </div>

              <TagFilterBar
                allTags={deckTags}
                selectedTags={selectedTags}
                onSelectedTagsChange={onSelectedTagsChange}
                sortBy={sortBy}
                onSortByChange={onSortByChange}
                tagColors={tagColors}
              />

              <div className="max-h-[540px] space-y-4 overflow-auto pr-1">
                {groupedByTopic.map(([topic, topicCards]) => {
                  const isRealTopic = topic !== NO_TOPIC_LABEL;

                  return (
                    <div key={topic} className="deck-settings-topic-group">
                      {renamingTopic === topic ? (
                        <div className="deck-settings-topic-rename">
                          <input
                            value={renameDraft}
                            onChange={(event) => setRenameDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") submitRenameTopic();
                              if (event.key === "Escape") setRenamingTopic(null);
                            }}
                            autoFocus
                          />
                          <button type="button" onClick={submitRenameTopic} aria-label="Umbenennen speichern">
                            <Save className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => setRenamingTopic(null)} aria-label="Umbenennen abbrechen">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <h3 className="deck-settings-topic-title">
                          {topic} <span className="deck-settings-topic-count">({topicCards.length})</span>
                          {isRealTopic && (
                            <>
                              <button
                                type="button"
                                className="deck-settings-topic-rename-button"
                                onClick={() => startRenameTopic(topic)}
                                aria-label={`Thema ${topic} umbenennen`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="deck-settings-topic-rename-button"
                                onClick={() =>
                                  setColorPickerTopic((current) => (current === topic ? null : topic))
                                }
                                aria-label={`Farbe für Thema ${topic} wählen`}
                                aria-expanded={colorPickerTopic === topic}
                              >
                                <Paintbrush className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </h3>
                      )}

                      {isRealTopic && colorPickerTopic === topic && (
                        <div className="deck-settings-topic-colors">
                          {TAG_COLOR_PALETTE.map((swatch) => {
                            const isActive = tagColors?.[topic.toLowerCase()] === swatch.value;
                            return (
                              <button
                                key={swatch.value}
                                type="button"
                                className={`deck-settings-color-swatch ${isActive ? "is-active" : ""}`}
                                style={{ backgroundColor: swatch.background, borderColor: swatch.foreground }}
                                onClick={() => onSetTagColor(topic, swatch.value)}
                                aria-label={`Thema ${topic} in ${swatch.label} färben`}
                                aria-pressed={isActive}
                              />
                            );
                          })}
                        </div>
                      )}

                      <div className="space-y-2">
                        {topicCards.map((card) => (
                          <div
                            key={card.id}
                            draggable
                            onDragStart={(event) => onDragStartCard(event, card.id)}
                            onDragEnd={onDragEndCard}
                            className={`collection-card is-draggable rounded-2xl border bg-white p-3 ${
                              card.id === currentId ? "is-selected" : ""
                            } ${card.id === draggedCardId ? "is-dragging" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <button
                                onClick={() => onSelectCard(card.id)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <div className="truncate font-semibold">
                                  {cardTextToPlainText(card.question)}
                                </div>

                                <div className="mt-1 truncate text-sm text-slate-500">
                                  {cardTextToPlainText(card.answer)}
                                </div>
                              </button>

                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => onEditCard(card)}
                                  className="rounded-xl p-2 collection-card-action"
                                  aria-label="Karte bearbeiten"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteCard(card.id)}
                                  className="rounded-xl p-2 collection-card-action is-danger"
                                  aria-label="Karte löschen"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <Badge level={card.level} />

                              <span className="text-xs text-slate-400">
                                {card.correctStreak}/3 richtig
                              </span>
                            </div>

                            <TagBadgeList tags={card.tags} tagColors={tagColors} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {!filteredCards.length && (
                  <div className="rounded-2xl bg-slate-100 p-5 text-center
                  text-sm text-slate-500">
                    Keine Karten gefunden.
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
