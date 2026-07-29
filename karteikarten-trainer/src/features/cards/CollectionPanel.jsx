import { ChevronDown, ChevronUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Card, CardContent } from "../../components/Button.jsx";
import { TagBadgeList } from "../../components/TagBadgeList.jsx";
import { TagFilterBar } from "../../components/TagFilterBar.jsx";
import { cardTextToPlainText } from "../../lib/storage.js";
import { Badge } from "./CardDisplay.jsx";

// "Sammlung": search/filter/sort over the active deck's cards, plus
// per-card edit/delete and drag-to-move-between-decks (drop target lives
// in DeckSidebar; draggedCardId is lifted to App.jsx so both sides share it).
export function CollectionPanel({
  activeCardsCount,
  isCollectionOpen,
  onToggleCollection,
  onAddCard,
  searchTerm,
  onSearchTermChange,
  deckTags,
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
}) {
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
              />

              <div className="max-h-[540px] space-y-2 overflow-auto pr-1">
                {filteredCards.map((card) => (
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

                    <TagBadgeList tags={card.tags} />
                  </div>
                ))}

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
