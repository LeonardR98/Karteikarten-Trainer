import {
  Brain,
  ChevronDown,
  ChevronUp,
  Download,
  LogIn, LogOut,
  Pencil,
  Plus,
  Save,
  Search,
  Settings,
  Shuffle,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useAuth } from "./auth/AuthContext.jsx";
import { LoginModal } from "./auth/LoginModal.jsx";
import { Button, Card, CardContent } from "./components/Button.jsx";
import { DeckSettingsModal } from "./components/DeckSettingsModal.jsx";
import { ImportPreviewModal } from "./components/ImportPreviewModal.jsx";
import { RichTextEditor } from "./components/RichTextEditor.jsx";
import { TagBadgeList } from "./components/TagBadgeList.jsx";
import { TagFilterBar } from "./components/TagFilterBar.jsx";
import { TagPicker } from "./components/TagPicker.jsx";
import { useData } from "./data/DataProvider.jsx";
import { pickWeightedCard } from "./lib/srs.js";
import {
  LEVELS,
  LEVEL_ORDER,
  cardTextToPlainText,
  exportCardsToCsv,
  importCardsFromCsv,
  normalizeCardText,
  normalizeLevel,
} from "./lib/storage.js";

  function FormattedCardText({ value, className = "" }) {
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

  function Badge({ level }) {
    const safeLevel = normalizeLevel(level);
    const item = LEVELS[safeLevel];

    return (
      <span className={`status-badge status-${safeLevel} rounded-full border px-3 py-1 text-xs font-semibold
      ${item.color}`}>
        {item.label}
      </span>
    );
  }

  export default function KarteikartenTrainer() {
    const {
      decks,
      cards,
      message,
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

    async function moveCardToDeck(cardId, targetDeck) {
      const card = cards.find((item) => item.id === cardId);
      if (!card || card.deckId === targetDeck.id) return;

      await actions.moveCardToDeck(cardId, targetDeck);

      if (cardId === currentId) {
        setCurrentId(activeCards.find((item) => item.id !== cardId)?.id || null);
        setShowAnswer(false);
      }
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

          {message && <p className="app-status-message">{message}</p>}

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

            <Button
              onClick={() => openDeckDialog("create")}
              className="deck-create-button rounded-xl"
            >
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
                  onClick={() => selectDeck(deck)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectDeck(deck);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onDragOver={(event) => {
                    if (!draggedCardId) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropDeckId(deck.id);
                  }}
                  onDragLeave={() => {
                    if (dropDeckId === deck.id) setDropDeckId(null);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const cardId = event.dataTransfer.getData("text/plain") || draggedCardId;

                    if (cardId) moveCardToDeck(cardId, deck);
                    setDraggedCardId(null);
                    setDropDeckId(null);
                  }}
                >
                  <span className="deck-tile-top">
                    <strong>{deck.name}</strong>
                    <span className="deck-tile-actions">
                      <button
                        type="button"
                        className="deck-icon-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeckSettingsDeck(deck);
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

          <aside className="concept-collection space-y-6">
            <Card className="collection-panel rounded-3xl border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Sammlung</h2>

                  <div className="collection-heading-actions">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium">
                      {activeCards.length}
                    </span>
                    <button
                      type="button"
                      className="collection-add-card"
                      onClick={() => setIsAddCardDialogOpen(true)}
                      aria-label="Neue Karte anlegen"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="collection-toggle"
                      onClick={() => setIsCollectionOpen((value) => !value)}
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
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Suchen..."
                        className="w-full rounded-2xl border bg-white py-2 pl-10
                        pr-3 outline-none ring-blue-200 focus:ring-4"
                      />
                    </div>

                    <TagFilterBar
                      allTags={deckTags}
                      selectedTags={selectedTags}
                      onSelectedTagsChange={setSelectedTags}
                      sortBy={sortBy}
                      onSortByChange={setSortBy}
                    />

                    <div className="max-h-[540px] space-y-2 overflow-auto pr-1">
                      {filteredCards.map((card) => (
                        <div
                          key={card.id}
                          draggable
                          onDragStart={(event) => {
                            setDraggedCardId(card.id);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", card.id);
                          }}
                          onDragEnd={() => {
                            setDraggedCardId(null);
                            setDropDeckId(null);
                          }}
                          className={`collection-card is-draggable rounded-2xl border bg-white p-3 ${
                            card.id === currentId ? "is-selected" : ""
                          } ${card.id === draggedCardId ? "is-dragging" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              onClick={() => {
                                setCurrentId(card.id);
                                setShowAnswer(false);
                              }}
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
                                onClick={() => openEditCard(card)}
                                className="rounded-xl p-2 collection-card-action"
                                aria-label="Karte bearbeiten"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteCard(card.id)}
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
          </div>

          <section className="concept-stats grid gap-4 md:grid-cols-4">
            {LEVEL_ORDER.slice()
              .reverse()
              .map((level) => (
                <Card key={level} className="rounded-3xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <Badge level={level} />
                      <span className="text-sm font-medium text-slate-500">
                        {LEVELS[level].weight}%
                      </span>
                    </div>

                    <div className="mt-4 text-3xl font-bold">{stats[level]}</div>
                    <div className="text-sm text-slate-500">
                      Karten in dieser Kategorie
                    </div>
                  </CardContent>
                </Card>
              ))}
            <div className="stats-progress-summary">
              <span>Lernfortschritt in diesem Deck</span>
              <span className="stats-progress-bar" aria-label={`${activeDeckSummary?.completionPercent || 0}% abgeschlossen`}>
                {LEVEL_ORDER.map((level) => (
                  <span
                    key={level}
                    className={`deck-progress-segment ${level}`}
                    style={{
                      width: `${activeDeckSummary?.cardCount ? (activeDeckSummary.levelCounts[level] / activeDeckSummary.cardCount) * 100 : 0}%`,
                    }}
                  />
                ))}
              </span>
              <strong>{activeDeckSummary?.completionPercent || 0}% abgeschlossen</strong>
            </div>
          </section>

          <main className="concept-main grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-6">
              <Card className="rounded-3xl border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold">Durchgehen</h2>
                      <p className="text-sm text-slate-500">
                        Erst antworten, dann Lösung anzeigen und bewerten.
                      </p>
                    </div>

                    <Button
                      onClick={() => selectNextCard()}
                      disabled={!activeCards.length || Boolean(ratingResult)}
                      variant="outline"
                      className="rounded-2xl"
                    >
                      <Shuffle className="mr-2 h-4 w-4" />
                      Zufall
                    </Button>
                  </div>

                  <>
                    {currentCard ? (
                      <div className="rounded-3xl bg-gradient-to-br from-white to-slate-100 p-6 shadow-inner">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                          <Badge level={currentCard.level} />

                          <span className="text-sm text-slate-500">
                            Richtig-Serie: {currentCard.correctStreak}/3 ·
                            Beantwortet: {currentCard.totalAnswered}
                          </span>
                        </div>

                        <div className="flashcard-scene">
                          <button
                            type="button"
                            key={currentCard.id}
                            className={`flashcard ${
                              showAnswer ? "is-flipped" : ""
                            } ${ratingResult ? `is-rating-${ratingResult}` : ""}`}
                            onClick={() => {
                              if (!ratingResult) setShowAnswer((value) => !value);
                            }}
                            aria-label="Karte drehen und Antwort anzeigen"
                          >
                            <span className="flashcard-face flashcard-front">
                              <span className="flashcard-label">Frage</span>
                              <FormattedCardText
                                value={currentCard.question}
                                className="flashcard-content flashcard-question"
                              />
                              <span className="flashcard-hint">
                                Karte anklicken, um die Antwort zu sehen
                              </span>
                            </span>

                            <span className="flashcard-face flashcard-back">
                              <span className="flashcard-question-preview">
                                {cardTextToPlainText(currentCard.question)}
                              </span>
                              <span className="flashcard-label">Antwort</span>
                              <FormattedCardText
                                value={currentCard.answer}
                                className="flashcard-content flashcard-answer"
                              />
                            </span>

                            {ratingResult && (
                              <span
                                className={`flashcard-feedback ${
                                  showAnswer ? "is-back" : ""
                                }`}
                              >
                                {ratingResult === "richtig"
                                  ? "🎉 Richtig!"
                                  : ratingResult === "teilweise"
                                    ? "🤔 Teilweise"
                                    : "❌ Falsch"}
                              </span>
                            )}

                            {ratingResult === "richtig" && (
                              <span
                                className={`flashcard-confetti ${
                                  showAnswer ? "is-back" : ""
                                }`}
                                aria-hidden="true"
                              >
                                {Array.from({ length: 12 }, (_, index) => (
                                  <i key={index} />
                                ))}
                              </span>
                            )}
                          </button>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          <Button
                            onClick={() => {
                              rateCard("richtig");
                            }}
                            disabled={Boolean(ratingResult)}
                            variant="outline"
                            className="rounded-2xl border-emerald-200 text-emerald-700"
                          >
                            Richtig
                          </Button>

                          <Button
                            onClick={() => {
                              rateCard("teilweise");
                            }}
                            disabled={Boolean(ratingResult)}
                            variant="outline"
                            className="rounded-2xl border-amber-200 text-amber-700"
                          >
                            Teilweise
                          </Button>

                          <Button
                            onClick={() => {
                              rateCard("falsch");
                            }}
                            disabled={Boolean(ratingResult)}
                            variant="outline"
                            className="rounded-2xl border-rose-200 text-rose-700"
                          >
                            Falsch
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-dashed bg-white p-10 text-center text-slate-500">
                        Noch keine Karte aktiv. Lege eine Karte an oder
                        importiere
                        eine CSV.
                      </div>
                    )}
                  </>
                </CardContent>
              </Card>

            </section>
          </main>
          </div>

          {deckSettingsDeck && (
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
              onEditCard={(card) => {
                setDeckSettingsDeck(null);
                openEditCard(card);
              }}
              onDeleteCard={deleteCard}
              onResetProgress={() => resetProgress(deckSettingsDeck.id)}
              onClearAllCards={() => clearAllCards(deckSettingsDeck.id)}
            />
          )}

          {deckDialog && (
            <div className="import-dialog-backdrop" role="presentation">
              <section className="deck-dialog" role="dialog" aria-modal="true" aria-labelledby="deck-dialog-title">
                <h2 id="deck-dialog-title">
                  {deckDialog.type === "create"
                    ? "Neues Deck erstellen"
                    : deckDialog.type === "rename"
                      ? "Deck umbenennen"
                      : "Deck löschen"}
                </h2>

                {deckDialog.type === "delete" ? (
                  <p>
                    Möchtest du das Deck „{deckDialog.deck.name}“ wirklich löschen?
                    Alle enthaltenen Karten werden ebenfalls gelöscht.
                  </p>
                ) : (
                  <label>
                    Deckname
                    <input
                      value={deckDialogName}
                      onChange={(event) => setDeckDialogName(event.target.value)}
                      placeholder="z. B. Englisch Vokabeln"
                      autoFocus
                    />
                  </label>
                )}

                <div className="import-dialog-actions">
                  <Button onClick={() => setDeckDialog(null)} variant="outline" className="rounded-xl">
                    Abbrechen
                  </Button>
                  <Button
                    onClick={() => {
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
                    }}
                    className={`rounded-xl ${deckDialog.type === "delete" ? "deck-delete-confirm" : ""}`}
                  >
                    {deckDialog.type === "delete" ? "Endgültig löschen" : "Speichern"}
                  </Button>
                </div>
              </section>
            </div>
          )}

          {isAddCardDialogOpen && (
            <div className="import-dialog-backdrop" role="presentation">
              <section className="card-dialog" role="dialog" aria-modal="true" aria-labelledby="new-card-title">
                <h2 id="new-card-title">Neue Karte</h2>
                <p>Die Karte wird dem aktiven Deck „{activeDeck?.name}“ hinzugefügt.</p>
                <label>
                  Frage
                  <RichTextEditor
                    value={question}
                    onChange={setQuestion}
                    label="Frage"
                  />
                </label>
                <label>
                  Antwort
                  <RichTextEditor
                    value={answer}
                    onChange={setAnswer}
                    label="Antwort"
                  />
                </label>
                <TagPicker tags={questionTags} onChange={setQuestionTags} suggestions={deckTags} />
                <div className="import-dialog-actions">
                  <Button onClick={() => setIsAddCardDialogOpen(false)} variant="outline" className="rounded-xl">
                    Abbrechen
                  </Button>
                  <Button onClick={addCard} className="rounded-xl">
                    <Plus className="mr-2 h-4 w-4" />
                    Karte anlegen
                  </Button>
                </div>
              </section>
            </div>
          )}

          {editingCard && (
            <div className="import-dialog-backdrop" role="presentation">
              <section className="card-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-card-title">
                <h2 id="edit-card-title">Karte bearbeiten</h2>
                <p>Ändere Frage oder Antwort dieser Karte.</p>
                <label>
                  Frage
                  <RichTextEditor
                    value={editQuestion}
                    onChange={setEditQuestion}
                    label="Frage"
                  />
                </label>
                <label>
                  Antwort
                  <RichTextEditor
                    value={editAnswer}
                    onChange={setEditAnswer}
                    label="Antwort"
                  />
                </label>
                <TagPicker tags={editTags} onChange={setEditTags} suggestions={deckTags} />
                <div className="import-dialog-actions">
                  <Button onClick={() => setEditingCard(null)} variant="outline" className="rounded-xl">
                    Abbrechen
                  </Button>
                  <Button onClick={saveEditedCard} className="rounded-xl">
                    <Save className="mr-2 h-4 w-4" />
                    Speichern
                  </Button>
                </div>
              </section>
            </div>
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
            <div className="import-dialog-backdrop" role="presentation">
              <section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
                <h2 id="import-title">CSV in ein Deck importieren</h2>
                <p>{pendingImportCards.length} gültige Karten wurden gefunden. Wähle ihr Ziel-Deck.</p>

                <label>
                  Ziel-Deck
                  <select
                    value={importDeckId}
                    onChange={(event) => setImportDeckId(event.target.value)}
                  >
                    {decks.map((deck) => (
                      <option key={deck.id} value={deck.id}>{deck.name}</option>
                    ))}
                    <option value="new">Neues Deck anlegen …</option>
                  </select>
                </label>

                {importDeckId === "new" && (
                  <label>
                    Name des neuen Decks
                    <input
                      value={importNewDeckName}
                      onChange={(event) => setImportNewDeckName(event.target.value)}
                      placeholder="z. B. Klausurvorbereitung"
                      autoFocus
                    />
                  </label>
                )}

                <div className="import-dialog-actions">
                  <Button
                    onClick={() => {
                      setPendingImportCards([]);
                      setMessage("CSV-Import abgebrochen.");
                    }}
                    variant="outline"
                    className="rounded-xl"
                  >
                    Abbrechen
                  </Button>
                  <Button onClick={finishImport} className="rounded-xl">
                    Importieren
                  </Button>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    );
  }
