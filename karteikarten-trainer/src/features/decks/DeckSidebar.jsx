import { Plus, Settings } from "lucide-react";
import { Button } from "../../components/Button.jsx";
import { LEVEL_ORDER } from "../../lib/storage.js";

// Deck list + tile. Drag-and-drop cards from CollectionPanel are dropped
// here to move them between decks — draggedCardId/dropDeckId state is
// lifted to App.jsx since CollectionPanel is the drag source.
export function DeckSidebar({
  activeDeck,
  deckSummaries,
  draggedCardId,
  dropDeckId,
  onSelectDeck,
  onCreateDeck,
  onAddCardToDeck,
  onOpenDeckSettings,
  onDragOverDeck,
  onDragLeaveDeck,
  onDropOnDeck,
}) {
  return (
    <div className="concept-sidebar-column">
      <section className="deck-manager concept-deck-sidebar" aria-label="Kartendecks">
        <div className="deck-manager-header">
          <div>
            <h2>Kartendecks</h2>
            <p>Jede Karte gehört genau zu einem Deck.</p>
          </div>
          <span className="deck-active-name">
            Aktives Deck: {activeDeck?.name || "–"}
          </span>
        </div>

        <Button onClick={onCreateDeck} className="deck-create-button rounded-xl">
          <Plus className="mr-2 h-4 w-4" />
          Deck erstellen
        </Button>

        <div className="deck-list">
          {deckSummaries.map((deck) => (
            <div
              key={deck.id}
              className={`deck-tile ${deck.id === activeDeck?.id ? "is-active" : ""} ${
                deck.id === dropDeckId ? "is-drop-target" : ""
              }`}
              onClick={() => onSelectDeck(deck)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectDeck(deck);
                }
              }}
              role="button"
              tabIndex={0}
              onDragOver={(event) => {
                if (!draggedCardId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                onDragOverDeck(deck);
              }}
              onDragLeave={() => onDragLeaveDeck(deck)}
              onDrop={(event) => onDropOnDeck(event, deck)}
            >
              <span className="deck-tile-top">
                <strong>{deck.name}</strong>
                <span className="deck-tile-actions">
                  <button
                    type="button"
                    className="deck-icon-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddCardToDeck(deck);
                    }}
                    aria-label={`Karte zu Deck ${deck.name} hinzufügen`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="deck-icon-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenDeckSettings(deck);
                    }}
                    aria-label={`Einstellungen für Deck ${deck.name}`}
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                </span>
              </span>
              <span className={deck.completed ? "deck-status done" : "deck-status"}>
                {deck.completed ? "Abgeschlossen" : "Offen"}
              </span>
              <span className="deck-tile-meta">
                {deck.cardCount} Karten · {deck.completionPercent}% abgeschlossen
              </span>
              <span className="deck-progress" aria-label={`${deck.completionPercent}% abgeschlossen`}>
                {LEVEL_ORDER.map((level) => (
                  <span
                    key={level}
                    className={`deck-progress-segment ${level}`}
                    style={{
                      width: `${deck.cardCount ? (deck.levelCounts[level] / deck.cardCount) * 100 : 0}%`,
                    }}
                  />
                ))}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
