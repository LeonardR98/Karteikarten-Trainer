import {
  BarChart3,
  Brain,
  Bold,
  Download,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  List,
  RotateCcw,
  Save,
  Search,
  Shuffle,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function Button({ children, className = "", variant, ...props }) {
    const style =
      variant === "outline"
        ? "border border-slate-300 bg-white text-slate-900"
        : "bg-slate-900 text-white";

    return (
      <button
        className={`inline-flex items-center justify-center px-4 py-2 ${style}
        ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }

  function Card({ children, className = "" }) {
    return <div className={`bg-white ${className}`}>{children}</div>;
  }

  function CardContent({ children, className = "" }) {
    return <div className={className}>{children}</div>;
  }
  const STORAGE_KEY = "karteikarten_trainer_final_v1";

  const LEVELS = {
    falsch: {
      label: "Falsch",
      weight: 40,
      color: "bg-rose-100 text-rose-800 border-rose-200",
    },
    mittel: {
      label: "Mittel",
      weight: 30,
      color: "bg-amber-100 text-amber-800 border-amber-200",
    },
    gut: {
      label: "Gut",
      weight: 20,
      color: "bg-blue-100 text-blue-800 border-blue-200",
    },
    verstanden: {
      label: "Verstanden",
      weight: 10,
      color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
  };

  const LEVEL_ORDER = ["falsch", "mittel", "gut", "verstanden"];
  const DEFAULT_LEVEL = "falsch";

  function createId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function normalizeLevel(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return LEVELS[normalized] ? normalized : DEFAULT_LEVEL;
  }

  function createDeck(name = "Default", isDefault = false) {
    return {
      id: createId(),
      name: String(name || "Default").trim() || "Default",
      isDefault,
      createdAt: new Date().toISOString(),
    };
  }

  function createCard(question, answer, level = DEFAULT_LEVEL, deckId) {
    return {
      id: createId(),
      deckId,
      question: normalizeCardText(question),
      answer: normalizeCardText(answer),
      level: normalizeLevel(level),
      correctStreak: 0,
      totalAnswered: 0,
      partialCount: 0,
      wrongCount: 0,
      lastResult: null,
      createdAt: new Date().toISOString(),
      lastAnsweredAt: null,
    };
  }

  function loadStoredData() {
    const defaultDeck = createDeck("Default", true);

    if (typeof window === "undefined") {
      return { decks: [defaultDeck], cards: [], error: null };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return { decks: [defaultDeck], cards: [], error: null };

      const parsed = JSON.parse(stored);

      // Alte Karten hatten keine deckId. Nach der vereinbarten Umstellung
      // werden sie verworfen und die Speicherung beim nächsten Render ersetzt.
      if (Array.isArray(parsed)) {
        return { decks: [defaultDeck], cards: [], error: null };
      }

      if (!Array.isArray(parsed?.decks) || !Array.isArray(parsed?.cards)) {
        return { decks: [defaultDeck], cards: [], error: null };
      }

      const decks = parsed.decks
        .map((deck) => ({
          id: deck.id || createId(),
          name: String(deck.name || "").trim(),
          isDefault: Boolean(deck.isDefault),
          createdAt: deck.createdAt || new Date().toISOString(),
        }))
        .filter((deck) => deck.name);

      if (!decks.length) decks.push(defaultDeck);

      const deckIds = new Set(decks.map((deck) => deck.id));
      const cards = parsed.cards
        .map((card) => ({
          ...createCard(card.question, card.answer, card.level, card.deckId),
          id: card.id || createId(),
          deckId: card.deckId,
          correctStreak: Number(card.correctStreak || 0),
          totalAnswered: Number(card.totalAnswered || 0),
          partialCount: Number(card.partialCount || 0),
          wrongCount: Number(card.wrongCount || 0),
          lastResult: card.lastResult || null,
          createdAt: card.createdAt || new Date().toISOString(),
          lastAnsweredAt: card.lastAnsweredAt || null,
        }))
        .filter((card) => card.question && card.answer && deckIds.has(card.deckId));

      return { decks, cards, error: null };
    } catch {
      return {
        decks: [defaultDeck],
        cards: [],
        error: "Gespeicherte Karteikarten konnten nicht geladen werden.",
      };
    }
  }

  function moveLevel(level, direction) {
    const currentIndex = LEVEL_ORDER.indexOf(normalizeLevel(level));
    const nextIndex = Math.min(
      Math.max(currentIndex + direction, 0),
      LEVEL_ORDER.length - 1
    );

    return LEVEL_ORDER[nextIndex];
  }

  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === "," || char === ";") && !inQuotes) {
        row.push(cell.trim());
        cell = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i += 1;

        row.push(cell.trim());

        if (row.some((value) => value !== "")) {
          rows.push(row);
        }

        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    row.push(cell.trim());

    if (row.some((value) => value !== "")) {
      rows.push(row);
    }

    return rows;
  }

  function importCardsFromCsv(text) {
    const rows = parseCsvRows(String(text || "").replace(/^\uFEFF/, ""));

    if (!rows.length) return [];

    const header = rows[0].map((value) => value.toLowerCase());

    const hasHeader = header.some((value) =>
      ["frage", "question", "antwort", "answer", "kategorie", "level",
      "stufe"].includes(value)
    );

    const dataRows = hasHeader ? rows.slice(1) : rows;

    const questionIndex = hasHeader
      ? Math.max(header.indexOf("frage"), header.indexOf("question"))
      : 0;

    const answerIndex = hasHeader
      ? Math.max(header.indexOf("antwort"), header.indexOf("answer"))
      : 1;

    const levelIndex = hasHeader
      ? Math.max(
          header.indexOf("kategorie"),
          header.indexOf("level"),
          header.indexOf("stufe")
        )
      : 2;

    return dataRows
      .map((row) => ({
        question: String(row[questionIndex] || row[0] || "").trim(),
        answer: String(row[answerIndex] || row[1] || "").trim(),
        level: normalizeLevel(row[levelIndex]),
      }))
      .filter((card) => card.question && card.answer);
  }

  function exportCardsToCsv(cards) {
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

    const rows = [
      ["Frage", "Antwort", "Kategorie", "Richtig-Serie", "Beantwortet",
      "Teilweise", "Falsch"],
      ...cards.map((card) => [
        cardTextToCsvText(card.question),
        cardTextToCsvText(card.answer),
        card.level,
        card.correctStreak,
        card.totalAnswered,
        card.partialCount,
        card.wrongCount,
      ]),
    ];

    return rows.map((row) => row.map(escape).join(",")).join("\n");
  }

  function pickWeightedCard(cards, excludedId = null) {
    const usableCards = cards.filter((card) => card.id !== excludedId);
    const pool = usableCards.length ? usableCards : cards;

    if (!pool.length) return null;

    const availableLevels = LEVEL_ORDER.filter((level) =>
      pool.some((card) => card.level === level)
    );

    const totalWeight = availableLevels.reduce(
      (sum, level) => sum + LEVELS[level].weight,
      0
    );

    let random = Math.random() * totalWeight;

    for (const level of availableLevels) {
      random -= LEVELS[level].weight;

      if (random <= 0) {
        const cardsInLevel = pool.filter((card) => card.level === level);

        return cardsInLevel[Math.floor(Math.random() * cardsInLevel.length)];
      }
    }

    return pool[Math.floor(Math.random() * pool.length)];
  }

  function normalizeCardText(value) {
    const source = String(value ?? "");
    const hasLegacyHtml = /<\/?(?:strong|b|ul|li|br|div|p)[\s>]/i.test(source);

    if (!hasLegacyHtml || typeof DOMParser === "undefined") return source.trim();

    const document = new DOMParser().parseFromString(source, "text/html");

    function convert(node) {
      if (node.nodeType === 3) return node.textContent;
      if (node.nodeType !== 1) return "";

      const tag = node.tagName.toLowerCase();
      const children = Array.from(node.childNodes).map(convert).join("");
      if (tag === "strong" || tag === "b") return `**${children}**`;
      if (tag === "br") return "\n";
      if (tag === "li") return `- ${children.trim()}\n`;
      if (tag === "ul" || tag === "div" || tag === "p") return `${children}\n`;
      return children;
    }

    return Array.from(document.body.childNodes)
      .map(convert)
      .join("")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function cardTextToPlainText(value) {
    return normalizeCardText(value)
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/^[-*]\s+/gm, "")
      .trim();
  }

  function cardTextToCsvText(value) {
    return normalizeCardText(value)
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .split("\n")
      .map((line) => line.replace(/^[-*]\s+/, "• ").trim())
      .filter(Boolean)
      .join(" · ");
  }

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

  function RichTextEditor({ value, onChange, label }) {
    const editorRef = useRef(null);

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
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
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
    const [initialData] = useState(loadStoredData);
    const [decks, setDecks] = useState(initialData.decks);
    const [cards, setCards] = useState(initialData.cards);
    const [currentDeckId, setCurrentDeckId] = useState(
      initialData.decks.find((deck) => deck.isDefault)?.id || initialData.decks[0]?.id
    );
    const [currentId, setCurrentId] = useState(null);
    const [showAnswer, setShowAnswer] = useState(false);
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [message, setMessage] = useState(
      initialData.error || "Bereit zum Lernen."
    );
    const [ratingResult, setRatingResult] = useState(null);
    const [pendingImportCards, setPendingImportCards] = useState([]);
    const [importDeckId, setImportDeckId] = useState(
      initialData.decks.find((deck) => deck.isDefault)?.id || initialData.decks[0]?.id || ""
    );
    const [importNewDeckName, setImportNewDeckName] = useState("");
    const [draggedCardId, setDraggedCardId] = useState(null);
    const [dropDeckId, setDropDeckId] = useState(null);
    const [isAddCardDialogOpen, setIsAddCardDialogOpen] = useState(false);
    const [editingCard, setEditingCard] = useState(null);
    const [editQuestion, setEditQuestion] = useState("");
    const [editAnswer, setEditAnswer] = useState("");
    const [deckDialog, setDeckDialog] = useState(null);
    const [deckDialogName, setDeckDialogName] = useState("");
    const [isCollectionOpen, setIsCollectionOpen] = useState(true);

    const fileInputRef = useRef(null);

    useEffect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ decks, cards }));
    }, [decks, cards]);

    const activeDeck = decks.find((deck) => deck.id === currentDeckId) || decks[0];
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

    const filteredCards = useMemo(() => {
      const term = searchTerm.trim().toLowerCase();

      if (!term) return activeCards;

      return activeCards.filter((card) => {
        return (
          cardTextToPlainText(card.question).toLowerCase().includes(term) ||
          cardTextToPlainText(card.answer).toLowerCase().includes(term) ||
          LEVELS[card.level].label.toLowerCase().includes(term)
        );
      });
    }, [activeCards, searchTerm]);

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
    }

    function createNewDeck(name) {
      const trimmedName = String(name || "").trim();

      if (!trimmedName) {
        setMessage("Bitte einen Namen für das Deck eingeben.");
        return null;
      }

      const deck = createDeck(trimmedName);
      setDecks((previous) => [...previous, deck]);
      selectDeck(deck);
      setMessage(`Deck „${deck.name}“ angelegt.`);
      return deck;
    }

    function renameDeck(targetDeck, name) {
      if (!targetDeck) return;
      const trimmedName = name.trim();

      if (!trimmedName) {
        setMessage("Ein Deck braucht einen Namen.");
        return;
      }

      setDecks((previous) =>
        previous.map((deck) =>
          deck.id === targetDeck.id ? { ...deck, name: trimmedName } : deck
        )
      );
      setDeckDialog(null);
      setMessage(`Deck in „${trimmedName}“ umbenannt.`);
    }

    function deleteDeck(deck) {
      if (!deck) return;

      if (decks.length <= 1) {
        setMessage("Mindestens ein Deck muss erhalten bleiben.");
        return;
      }

      const remainingDecks = decks.filter((item) => item.id !== deck.id);
      const nextDeck = remainingDecks.find((deck) => deck.isDefault) || remainingDecks[0];

      setDecks(remainingDecks);
      setCards((previous) => previous.filter((card) => card.deckId !== deck.id));
      if (deck.id === activeDeck?.id) selectDeck(nextDeck);
      setDeckDialog(null);
      setMessage(`Deck „${deck.name}“ gelöscht.`);
    }

    function openDeckDialog(type, deck = null) {
      setDeckDialog({ type, deck });
      setDeckDialogName(type === "rename" ? deck.name : "");
    }

    function moveCardToDeck(cardId, targetDeck) {
      const card = cards.find((item) => item.id === cardId);

      if (!card || card.deckId === targetDeck.id) return;

      setCards((previous) =>
        previous.map((item) =>
          item.id === cardId ? { ...item, deckId: targetDeck.id } : item
        )
      );

      if (cardId === currentId) {
        setCurrentId(activeCards.find((item) => item.id !== cardId)?.id || null);
        setShowAnswer(false);
      }

      setMessage(`Karte in Deck „${targetDeck.name}“ verschoben.`);
    }

    function addCard() {
      if (!question.trim() || !answer.trim()) {
        setMessage("Bitte Frage und Antwort ausfüllen.");
        return;
      }

      if (!activeDeck) {
        setMessage("Bitte zuerst ein Deck auswählen.");
        return;
      }

      const newCard = createCard(question, answer, DEFAULT_LEVEL, activeDeck.id);

      setCards((previous) => [newCard, ...previous]);
      setCurrentId(newCard.id);
      setShowAnswer(false);
      setQuestion("");
      setAnswer("");
      setIsAddCardDialogOpen(false);
      setMessage("Karteikarte angelegt. Neue Karten starten bei Falsch.");
    }

    function openEditCard(card) {
      setEditingCard(card);
      setEditQuestion(card.question);
      setEditAnswer(card.answer);
    }

    function saveEditedCard() {
      if (!editingCard) return;

      const nextQuestion = editQuestion.trim();
      const nextAnswer = editAnswer.trim();

      if (!nextQuestion || !nextAnswer) {
        setMessage("Bitte Frage und Antwort ausfüllen.");
        return;
      }

      setCards((previous) =>
        previous.map((card) =>
          card.id === editingCard.id
            ? { ...card, question: nextQuestion, answer: nextAnswer }
            : card
        )
      );
      setEditingCard(null);
      setMessage("Karteikarte gespeichert.");
    }

    function rateCard(result) {
      if (!currentCard || ratingResult) return;

      let nextLevel = currentCard.level;
      let nextStreak = currentCard.correctStreak;
      let nextPartialCount = currentCard.partialCount;
      let nextWrongCount = currentCard.wrongCount;

      if (result === "richtig") {
        nextStreak += 1;

        if (nextStreak >= 3) {
          nextLevel = moveLevel(currentCard.level, 1);
          nextStreak = 0;
        }
      }

      if (result === "teilweise") {
        nextPartialCount += 1;
        nextStreak = 0;
      }

      if (result === "falsch") {
        nextWrongCount += 1;
        nextStreak = 0;
        nextLevel = moveLevel(currentCard.level, -1);
      }

      const updatedCards = cards.map((card) =>
        card.id === currentCard.id
          ? {
              ...card,
              level: nextLevel,
              correctStreak: nextStreak,
              partialCount: nextPartialCount,
              wrongCount: nextWrongCount,
              totalAnswered: card.totalAnswered + 1,
              lastResult: result,
              lastAnsweredAt: new Date().toISOString(),
            }
          : card
      );

      setRatingResult(result);

      window.setTimeout(() => {
        const nextCard = pickWeightedCard(
          updatedCards.filter((card) => card.deckId === activeDeck.id),
          currentCard.id
        );

        setCards(updatedCards);
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

    function deleteCard(id) {
      const remaining = cards.filter((card) => card.id !== id);

      setCards(remaining);

      if (id === currentId) {
        setCurrentId(
          remaining.find((card) => card.deckId === activeDeck?.id)?.id || null
        );
        setShowAnswer(false);
      }

      setMessage("Karteikarte gelöscht.");
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

    function finishImport() {
      if (!pendingImportCards.length) return;

      let targetDeck = decks.find((deck) => deck.id === importDeckId);

      if (importDeckId === "new") {
        const name = importNewDeckName.trim();
        if (!name) {
          setMessage("Bitte einen Namen für das neue Deck eingeben.");
          return;
        }

        targetDeck = createDeck(name);
        setDecks((previous) => [...previous, targetDeck]);
      }

      if (!targetDeck) {
        setMessage("Bitte ein Ziel-Deck auswählen.");
        return;
      }

      const imported = pendingImportCards.map((card) =>
        createCard(card.question, card.answer, card.level, targetDeck.id)
      );

      setCards((previous) => [...imported, ...previous]);
      setCurrentDeckId(targetDeck.id);
      setCurrentId(imported[0]?.id || null);
      setShowAnswer(false);
      setPendingImportCards([]);
      setMessage(`${imported.length} Karteikarten in „${targetDeck.name}“ importiert.`);
    }

    function exportCsv() {
      const csv = exportCardsToCsv(activeCards);
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${activeDeck?.name || "karteikarten"}.csv`;
      link.click();

      URL.revokeObjectURL(url);
      setMessage("CSV exportiert.");
    }

    function resetProgress() {
      setCards((previous) =>
        previous.map((card) =>
          card.deckId !== activeDeck?.id
            ? card
            : ({
          ...card,
          level: DEFAULT_LEVEL,
          correctStreak: 0,
          totalAnswered: 0,
          partialCount: 0,
          wrongCount: 0,
          lastResult: null,
          lastAnsweredAt: null,
        })
        )
      );

      setMessage("Fortschritt dieses Decks zurückgesetzt.");
    }

    function clearAllCards() {
      setCards((previous) =>
        previous.filter((card) => card.deckId !== activeDeck?.id)
      );
      setCurrentId(null);
      setShowAnswer(false);
      setMessage("Alle Karten dieses Decks wurden gelöscht.");
    }

    const rulesPanel = (
        <Card className="rules-panel deck-rules-panel rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-slate-600" />
              <h2 className="text-xl font-bold">Speichern & Regeln</h2>
            </div>

            <p className="text-sm leading-6 text-slate-600">
              Alles wird automatisch im Browser gespeichert. CSV-Format: <strong>Frage,
              Antwort, Kategorie</strong>. Kategorien sind falsch, mittel, gut oder
              verstanden. Ohne Kategorie startet eine Karte bei <strong>Falsch</strong>.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify({ decks, cards }));
                  setMessage("Karteikarten gespeichert.");
                }}
                variant="outline"
                className="rounded-2xl"
              >
                <Save className="mr-2 h-4 w-4" />
                Jetzt speichern
              </Button>

              <Button
                onClick={resetProgress}
                disabled={!activeCards.length}
                variant="outline"
                className="rounded-2xl"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Fortschritt zurücksetzen
              </Button>

              <Button
                onClick={clearAllCards}
                disabled={!activeCards.length}
                variant="outline"
                className="rounded-2xl border-rose-200 text-rose-700"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Alles löschen
              </Button>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-100 p-3 text-sm text-slate-600">
              {message}
            </div>
          </CardContent>
        </Card>
    );

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
                          openDeckDialog("rename", deck);
                        }}
                        aria-label={`Deck ${deck.name} umbenennen`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="deck-icon-button delete"
                        onClick={(event) => {
                          event.stopPropagation();
                          openDeckDialog("delete", deck);
                        }}
                        disabled={decks.length <= 1}
                        aria-label={`Deck ${deck.name} löschen`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
                              className="rounded-xl p-2 text-slate-400 hover:bg-violet-50 hover:text-violet-600"
                              aria-label="Karte bearbeiten"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCard(card.id)}
                              className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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
          </main>
          {rulesPanel}
          </div>

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
