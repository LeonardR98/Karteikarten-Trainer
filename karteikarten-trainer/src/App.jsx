import { Brain, Download, LogIn, LogOut, Moon, Sun, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth/AuthContext.jsx";
import { LoginModal } from "./auth/LoginModal.jsx";
import { Button } from "./components/Button.jsx";
import { AddCardDialog } from "./features/cards/AddCardDialog.jsx";
import { CardReviewPanel } from "./features/cards/CardReviewPanel.jsx";
import { CollectionPanel } from "./features/cards/CollectionPanel.jsx";
import { EditCardDialog } from "./features/cards/EditCardDialog.jsx";
import { StatsPanel } from "./features/cards/StatsPanel.jsx";
import { CsvImportDialog } from "./features/csv-import/CsvImportDialog.jsx";
import { ImportPreviewModal } from "./features/csv-import/ImportPreviewModal.jsx";
import { DeckDialog } from "./features/decks/DeckDialog.jsx";
import { DeckSettingsModal } from "./features/decks/DeckSettingsModal.jsx";
import { DeckSidebar } from "./features/decks/DeckSidebar.jsx";
import { useData } from "./data/DataProvider.jsx";
import { pickWeightedCard } from "./lib/srs.js";
import {
  LEVELS,
  LEVEL_ORDER,
  cardTextToPlainText,
  exportCardsToCsv,
  importCardsFromCsv,
} from "./lib/storage.js";

// Orchestrator: owns all state and the handlers that call into the data
// layer (see src/data/DataProvider.jsx), and composes the feature
// components in src/features/*. Each feature component is presentation +
// local UI state only; cross-cutting state (active deck/card, dialog open
// flags, drag-and-drop) lives here because more than one feature needs it.
export default function KarteikartenTrainer() {
  const {
    decks,
    cards,
    setMessage,
    actions,
    importPreview,
    isImporting,
    importLocalData,
    skipLocalImport,
    isCloud,
  } = useData();
  const { user, status: authStatus, signOut } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);
  const [currentDeckId, setCurrentDeckId] = useState(
    decks.find((deck) => deck.isDefault)?.id || decks[0]?.id
  );
  const [currentId, setCurrentId] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [questionTags, setQuestionTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState("default");
  const [ratingResult, setRatingResult] = useState(null);
  const [pendingImportCards, setPendingImportCards] = useState([]);
  const [importDeckId, setImportDeckId] = useState(
    decks.find((deck) => deck.isDefault)?.id || decks[0]?.id || ""
  );
  const [importNewDeckName, setImportNewDeckName] = useState("");
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [dropDeckId, setDropDeckId] = useState(null);
  const [isAddCardDialogOpen, setIsAddCardDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editTags, setEditTags] = useState([]);
  const [deckDialog, setDeckDialog] = useState(null);
  const [deckDialogName, setDeckDialogName] = useState("");
  const [deckSettingsDeck, setDeckSettingsDeck] = useState(null);
  const [isCollectionOpen, setIsCollectionOpen] = useState(true);

  useEffect(() => {
    const anyModalOpen = Boolean(
      deckSettingsDeck || deckDialog || isAddCardDialogOpen || editingCard || isLoginOpen
    );
    document.body.style.overflow = anyModalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [deckSettingsDeck, deckDialog, isAddCardDialogOpen, editingCard, isLoginOpen]);

  const fileInputRef = useRef(null);

  // Decks can swap out from under us (e.g. local demo deck -> cloud decks
  // after login, or vice versa on logout) — fall back without needing an
  // effect if the previously selected id no longer exists.
  const activeDeck =
    decks.find((deck) => deck.id === currentDeckId) ||
    decks.find((deck) => deck.isDefault) ||
    decks[0];
  const activeCards = useMemo(
    () => cards.filter((card) => card.deckId === activeDeck?.id),
    [cards, activeDeck?.id]
  );

  const currentCard = activeCards.find((card) => card.id === currentId) || null;

  const stats = useMemo(() => {
    return LEVEL_ORDER.reduce((acc, level) => {
      acc[level] = activeCards.filter((card) => card.level === level).length;
      return acc;
    }, {});
  }, [activeCards]);

  const deckSummaries = useMemo(
    () =>
      decks.map((deck) => {
        const deckCards = cards.filter((card) => card.deckId === deck.id);
        const understood = deckCards.filter(
          (card) => card.level === "verstanden"
        ).length;
        const levelCounts = LEVEL_ORDER.reduce((counts, level) => {
          counts[level] = deckCards.filter((card) => card.level === level).length;
          return counts;
        }, {});

        return {
          ...deck,
          cardCount: deckCards.length,
          understood,
          levelCounts,
          completionPercent: deckCards.length
            ? Math.round((understood / deckCards.length) * 100)
            : 0,
          completed: deckCards.length > 0 && understood === deckCards.length,
        };
      }),
    [decks, cards]
  );
  const activeDeckSummary = deckSummaries.find(
    (deck) => deck.id === activeDeck?.id
  );

  const deckTags = useMemo(() => {
    const names = new Set();
    activeCards.forEach((card) => card.tags?.forEach((tag) => names.add(tag)));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [activeCards]);

  const filteredCards = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const matching = activeCards.filter((card) => {
      const matchesTerm =
        !term ||
        cardTextToPlainText(card.question).toLowerCase().includes(term) ||
        cardTextToPlainText(card.answer).toLowerCase().includes(term) ||
        LEVELS[card.level].label.toLowerCase().includes(term);

      const matchesTags =
        !selectedTags.length || selectedTags.every((tag) => card.tags?.includes(tag));

      return matchesTerm && matchesTags;
    });

    const sorted = [...matching];

    if (sortBy === "question-asc") {
      sorted.sort((a, b) =>
        cardTextToPlainText(a.question).localeCompare(cardTextToPlainText(b.question))
      );
    } else if (sortBy === "newest") {
      sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === "level") {
      sorted.sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
    }

    return sorted;
  }, [activeCards, searchTerm, selectedTags, sortBy]);

  function selectNextCard(excludedId = null) {
    const nextCard = pickWeightedCard(activeCards, excludedId);

    setCurrentId(nextCard?.id || null);
    setShowAnswer(false);

    if (nextCard) {
      setMessage(
        `Nächste Karte: ${LEVELS[nextCard.level].label}
        (${LEVELS[nextCard.level].weight}% Kategorie-Gewichtung).`
      );
    }
  }

  function selectDeck(deck) {
    setCurrentDeckId(deck.id);
    setCurrentId(cards.find((card) => card.deckId === deck.id)?.id || null);
    setShowAnswer(false);
    setRatingResult(null);
    setSearchTerm("");
    setSelectedTags([]);
  }

  async function createNewDeck(name) {
    const result = await actions.createDeck(name);
    if (!result.newDeck) return null;
    selectDeck(result.newDeck);
    return result.newDeck;
  }

  async function renameDeck(targetDeck, name) {
    if (!targetDeck) return;
    await actions.renameDeck(targetDeck, name);
    setDeckDialog(null);
  }

  async function deleteDeck(deck) {
    if (!deck) return;
    const result = await actions.deleteDeck(deck);
    if (result.nextDeck && deck.id === activeDeck?.id) selectDeck(result.nextDeck);
    setDeckDialog(null);
  }

  async function mergeDeckInto(sourceDeck, targetDeckId) {
    const targetDeck = decks.find((deck) => deck.id === targetDeckId);
    if (!sourceDeck || !targetDeck || targetDeck.id === sourceDeck.id) return;

    const sourceCards = cards.filter((card) => card.deckId === sourceDeck.id);
    for (const card of sourceCards) {
      await actions.moveCardToDeck(card.id, targetDeck);
    }

    const result = await actions.deleteDeck(sourceDeck);
    if (result.nextDeck && sourceDeck.id === activeDeck?.id) selectDeck(result.nextDeck);
    setDeckSettingsDeck(null);
    setMessage(`Deck „${sourceDeck.name}“ wurde in „${targetDeck.name}“ integriert.`);
  }

  function openDeckDialog(type, deck = null) {
    setDeckDialog({ type, deck });
    setDeckDialogName(type === "rename" ? deck.name : "");
  }

  function confirmDeckDialog() {
    if (deckDialog.type === "create") {
      const created = createNewDeck(deckDialogName);
      if (created) setDeckDialog(null);
    }

    if (deckDialog.type === "rename") {
      renameDeck(deckDialog.deck, deckDialogName);
    }

    if (deckDialog.type === "delete") {
      deleteDeck(deckDialog.deck);
    }
  }

  async function moveCardToDeck(cardId, targetDeck) {
    const card = cards.find((item) => item.id === cardId);
    if (!card || card.deckId === targetDeck.id) return;

    await actions.moveCardToDeck(cardId, targetDeck);

    if (cardId === currentId) {
      setCurrentId(activeCards.find((item) => item.id !== cardId)?.id || null);
      setShowAnswer(false);
    }
  }

  function handleDropOnDeck(event, deck) {
    event.preventDefault();
    const cardId = event.dataTransfer.getData("text/plain") || draggedCardId;

    if (cardId) moveCardToDeck(cardId, deck);
    setDraggedCardId(null);
    setDropDeckId(null);
  }

  function openAddCardDialogForDeck(deck) {
    setCurrentDeckId(deck.id);
    setQuestion("");
    setAnswer("");
    setQuestionTags([]);
    setIsAddCardDialogOpen(true);
  }

  async function addCard() {
    if (!activeDeck) {
      setMessage("Bitte zuerst ein Deck auswählen.");
      return;
    }

    const result = await actions.addCard(activeDeck.id, question, answer, questionTags);
    if (!result.newCard) return;

    setCurrentId(result.newCard.id);
    setShowAnswer(false);
    setQuestion("");
    setAnswer("");
    setQuestionTags([]);
    setIsAddCardDialogOpen(false);
  }

  function openEditCard(card) {
    setEditingCard(card);
    setEditQuestion(card.question);
    setEditAnswer(card.answer);
    setEditTags(card.tags || []);
  }

  async function saveEditedCard() {
    if (!editingCard) return;
    const result = await actions.saveEditedCard(editingCard.id, editQuestion, editAnswer, editTags);
    if (result.message === "Karteikarte gespeichert.") setEditingCard(null);
  }

  function rateCard(result) {
    if (!currentCard || ratingResult) return;

    const cardId = currentCard.id;
    const deckId = activeDeck.id;

    setRatingResult(result);

    window.setTimeout(async () => {
      const updated = await actions.rateCard(cardId, result);
      const nextCard = pickWeightedCard(
        updated.cards.filter((card) => card.deckId === deckId),
        cardId
      );

      setCurrentId(nextCard?.id || null);
      setShowAnswer(false);
      setRatingResult(null);

      if (nextCard) {
        setMessage(
          `Nächste Karte: ${LEVELS[nextCard.level].label} (${LEVELS[nextCard.level].weight}% Kategorie-Gewichtung).`
        );
      }
    }, 550);
  }

  async function deleteCard(id) {
    const result = await actions.deleteCard(id);

    if (id === currentId) {
      setCurrentId(
        result.cards.find((card) => card.deckId === activeDeck?.id)?.id || null
      );
      setShowAnswer(false);
    }
  }

  function importCsv(file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const importedCards = importCardsFromCsv(reader.result);

      if (!importedCards.length) {
        setMessage("Keine gültigen Karten gefunden.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setPendingImportCards(importedCards);
      setImportDeckId(activeDeck?.id || decks[0]?.id || "");
      setImportNewDeckName("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    reader.onerror = () => {
      setMessage("Die CSV-Datei konnte nicht gelesen werden.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    reader.readAsText(file);
  }

  async function finishImport() {
    if (!pendingImportCards.length) return;

    const result = await actions.finishImport(pendingImportCards, importDeckId, importNewDeckName);
    if (!result.targetDeck) return;

    setCurrentDeckId(result.targetDeck.id);
    setCurrentId(result.imported[0]?.id || null);
    setShowAnswer(false);
    setPendingImportCards([]);
  }

  function exportCsv() {
    const csv = exportCardsToCsv(activeCards);
    const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${activeDeck?.name || "karteikarten"}.csv`;
    link.click();

    URL.revokeObjectURL(url);
    setMessage("CSV exportiert.");
  }

  function resetProgress(deckId = activeDeck?.id) {
    actions.resetProgress(deckId);
  }

  function clearAllCards(deckId = activeDeck?.id) {
    actions.clearAllCards(deckId);
    if (deckId === activeDeck?.id) {
      setCurrentId(null);
      setShowAnswer(false);
    }
  }

  return (
    <div className="concept-app min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
      <div className="concept-frame mx-auto max-w-7xl space-y-6">
        <header className="concept-header flex flex-col gap-4 md:flex-row md:items-end
        md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full
            bg-white px-3 py-1 text-sm font-medium text-slate-600 shadow-sm">
              <Brain className="h-4 w-4" />
              Intelligenter Karteikarten-Trainer
            </div>

            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
              Karteikarten lernen
            </h1>

            <p className="mt-2 max-w-2xl text-slate-600">
              Neue Karten starten bei Falsch. Du bewertest mit Richtig,
              Teilweise oder Falsch. Nach 3x Richtig steigt eine Karte eine
              Stufe auf. Bei Falsch fällt sie eine Stufe zurück. Teilweise
              verändert die Kategorie nicht und setzt die Richtig-Serie zurück.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setDarkMode((prev) => !prev)}
              variant="outline"
              className="rounded-2xl"
              aria-label="Dark Mode umschalten"
              title="Dark Mode umschalten"
            >
              {darkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            <Button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-2xl"
            >
              <Upload className="mr-2 h-4 w-4" />
              CSV einlesen
            </Button>

            <Button
              onClick={exportCsv}
              disabled={!activeCards.length}
              variant="outline"
              className="rounded-2xl"
            >
              <Download className="mr-2 h-4 w-4" />
              CSV exportieren
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => importCsv(event.target.files?.[0])}
            />

            {authStatus === "authenticated" ? (
              <div className="user-account-badge">
                <span className="user-avatar-circle" title={user?.email}>
                  {(user?.email || "?").charAt(0).toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="user-logout-button"
                  aria-label="Abmelden"
                  title="Abmelden"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Button
                onClick={() => setIsLoginOpen(true)}
                variant="outline"
                className="rounded-2xl"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Anmelden
              </Button>
            )}
          </div>
        </header>

        {activeDeckSummary?.completed && (
          <div className="deck-complete-banner" role="status">
            <span aria-hidden="true">🎉 🏆</span>
            <div>
              <strong>Deck abgeschlossen!</strong>
              <p>Alle Karten in „{activeDeckSummary.name}“ sind verstanden.</p>
            </div>
          </div>
        )}

        <div className="concept-dashboard">
          <DeckSidebar
            activeDeck={activeDeck}
            deckSummaries={deckSummaries}
            draggedCardId={draggedCardId}
            dropDeckId={dropDeckId}
            onSelectDeck={selectDeck}
            onCreateDeck={() => openDeckDialog("create")}
            onAddCardToDeck={openAddCardDialogForDeck}
            onOpenDeckSettings={setDeckSettingsDeck}
            onDragOverDeck={(deck) => setDropDeckId(deck.id)}
            onDragLeaveDeck={(deck) => {
              if (dropDeckId === deck.id) setDropDeckId(null);
            }}
            onDropOnDeck={handleDropOnDeck}
          />

          <StatsPanel stats={stats} activeDeckSummary={activeDeckSummary} />

          <main className="concept-main grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-6">
              <CardReviewPanel
                activeCardsCount={activeCards.length}
                currentCard={currentCard}
                showAnswer={showAnswer}
                onToggleAnswer={() => setShowAnswer((value) => !value)}
                ratingResult={ratingResult}
                onRate={rateCard}
                onShuffle={() => selectNextCard()}
              />

              <CollectionPanel
                activeCardsCount={activeCards.length}
                isCollectionOpen={isCollectionOpen}
                onToggleCollection={() => setIsCollectionOpen((value) => !value)}
                onAddCard={() => setIsAddCardDialogOpen(true)}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                deckTags={deckTags}
                selectedTags={selectedTags}
                onSelectedTagsChange={setSelectedTags}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                filteredCards={filteredCards}
                currentId={currentId}
                onSelectCard={(cardId) => {
                  setCurrentId(cardId);
                  setShowAnswer(false);
                }}
                draggedCardId={draggedCardId}
                onDragStartCard={(event, cardId) => {
                  setDraggedCardId(cardId);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", cardId);
                }}
                onDragEndCard={() => {
                  setDraggedCardId(null);
                  setDropDeckId(null);
                }}
                onEditCard={openEditCard}
                onDeleteCard={deleteCard}
              />
            </section>
          </main>
        </div>

        {deckSettingsDeck && (
          <div className="import-dialog-backdrop" role="presentation">
            <div className="deck-settings-flex-row">
              <DeckSettingsModal
                deck={deckSettingsDeck}
                cards={cards.filter((card) => card.deckId === deckSettingsDeck.id)}
                otherDecks={decks.filter((deck) => deck.id !== deckSettingsDeck.id)}
                isCloud={isCloud}
                canManage={!isCloud || deckSettingsDeck.myRole === "owner"}
                onClose={() => setDeckSettingsDeck(null)}
                onMergeInto={(targetDeckId) => mergeDeckInto(deckSettingsDeck, targetDeckId)}
                onRename={async (name) => {
                  await renameDeck(deckSettingsDeck, name);
                  setDeckSettingsDeck(null);
                }}
                onDelete={async () => {
                  await deleteDeck(deckSettingsDeck);
                  setDeckSettingsDeck(null);
                }}
                onEditCard={(card) => openEditCard(card)}
                onDeleteCard={deleteCard}
                onResetProgress={() => resetProgress(deckSettingsDeck.id)}
                onClearAllCards={() => clearAllCards(deckSettingsDeck.id)}
              />

              {isAddCardDialogOpen && (
                <AddCardDialog
                  sideBySide
                  activeDeckName={activeDeck?.name}
                  question={question}
                  onQuestionChange={setQuestion}
                  answer={answer}
                  onAnswerChange={setAnswer}
                  tags={questionTags}
                  onTagsChange={setQuestionTags}
                  suggestions={deckTags}
                  onCancel={() => setIsAddCardDialogOpen(false)}
                  onSubmit={addCard}
                />
              )}

              {editingCard && (
                <EditCardDialog
                  sideBySide
                  question={editQuestion}
                  onQuestionChange={setEditQuestion}
                  answer={editAnswer}
                  onAnswerChange={setEditAnswer}
                  tags={editTags}
                  onTagsChange={setEditTags}
                  suggestions={deckTags}
                  onCancel={() => setEditingCard(null)}
                  onSubmit={saveEditedCard}
                />
              )}
            </div>
          </div>
        )}

        {deckDialog && (
          <DeckDialog
            deckDialog={deckDialog}
            deckDialogName={deckDialogName}
            onNameChange={setDeckDialogName}
            onCancel={() => setDeckDialog(null)}
            onConfirm={confirmDeckDialog}
          />
        )}

        {!deckSettingsDeck && isAddCardDialogOpen && (
          <AddCardDialog
            activeDeckName={activeDeck?.name}
            question={question}
            onQuestionChange={setQuestion}
            answer={answer}
            onAnswerChange={setAnswer}
            tags={questionTags}
            onTagsChange={setQuestionTags}
            suggestions={deckTags}
            onCancel={() => setIsAddCardDialogOpen(false)}
            onSubmit={addCard}
          />
        )}

        {!deckSettingsDeck && editingCard && (
          <EditCardDialog
            question={editQuestion}
            onQuestionChange={setEditQuestion}
            answer={editAnswer}
            onAnswerChange={setEditAnswer}
            tags={editTags}
            onTagsChange={setEditTags}
            suggestions={deckTags}
            onCancel={() => setEditingCard(null)}
            onSubmit={saveEditedCard}
          />
        )}

        {isLoginOpen && <LoginModal onClose={() => setIsLoginOpen(false)} />}

        {importPreview && (
          <ImportPreviewModal
            preview={importPreview}
            isImporting={isImporting}
            onImport={importLocalData}
            onSkip={skipLocalImport}
          />
        )}

        {pendingImportCards.length > 0 && (
          <CsvImportDialog
            pendingCount={pendingImportCards.length}
            decks={decks}
            importDeckId={importDeckId}
            onImportDeckIdChange={setImportDeckId}
            importNewDeckName={importNewDeckName}
            onImportNewDeckNameChange={setImportNewDeckName}
            onCancel={() => {
              setPendingImportCards([]);
              setMessage("CSV-Import abgebrochen.");
            }}
            onImport={finishImport}
          />
        )}
      </div>
    </div>
  );
}
