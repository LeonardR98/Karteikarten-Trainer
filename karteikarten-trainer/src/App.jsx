import {
  BarChart3,
  Brain,
  Download,
  Plus,
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

  function createCard(question, answer, level = DEFAULT_LEVEL) {
    return {
      id: createId(),
      question: String(question || "").trim(),
      answer: String(answer || "").trim(),
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

  function loadStoredCards() {
    if (typeof window === "undefined") return { cards: [], error: null };

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return { cards: [], error: null };

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return { cards: [], error: null };

      const cards = parsed
        .map((card) => ({
          ...createCard(card.question, card.answer, card.level),
          id: card.id || createId(),
          correctStreak: Number(card.correctStreak || 0),
          totalAnswered: Number(card.totalAnswered || 0),
          partialCount: Number(card.partialCount || 0),
          wrongCount: Number(card.wrongCount || 0),
          lastResult: card.lastResult || null,
          createdAt: card.createdAt || new Date().toISOString(),
          lastAnsweredAt: card.lastAnsweredAt || null,
        }))
        .filter((card) => card.question && card.answer);

      return { cards, error: null };
    } catch {
      return {
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
      .map((row) =>
        createCard(
          row[questionIndex] || row[0],
          row[answerIndex] || row[1],
          row[levelIndex]
        )
      )
      .filter((card) => card.question && card.answer);
  }

  function exportCardsToCsv(cards) {
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

    const rows = [
      ["Frage", "Antwort", "Kategorie", "Richtig-Serie", "Beantwortet",
      "Teilweise", "Falsch"],
      ...cards.map((card) => [
        card.question,
        card.answer,
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

  function Badge({ level }) {
    const safeLevel = normalizeLevel(level);
    const item = LEVELS[safeLevel];

    return (
      <span className={`rounded-full border px-3 py-1 text-xs font-semibold
      ${item.color}`}>
        {item.label}
      </span>
    );
  }

  export default function KarteikartenTrainer() {
    const [initialData] = useState(loadStoredCards);
    const [cards, setCards] = useState(initialData.cards);
    const [currentId, setCurrentId] = useState(initialData.cards[0]?.id || null);
    const [showAnswer, setShowAnswer] = useState(false);
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [message, setMessage] = useState(
      initialData.error || "Bereit zum Lernen."
    );
    const [ratingResult, setRatingResult] = useState(null);

    const fileInputRef = useRef(null);

    useEffect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    }, [cards]);

    const currentCard = cards.find((card) => card.id === currentId) || null;

    const stats = useMemo(() => {
      return LEVEL_ORDER.reduce((acc, level) => {
        acc[level] = cards.filter((card) => card.level === level).length;
        return acc;
      }, {});
    }, [cards]);

    const filteredCards = useMemo(() => {
      const term = searchTerm.trim().toLowerCase();

      if (!term) return cards;

      return cards.filter((card) => {
        return (
          card.question.toLowerCase().includes(term) ||
          card.answer.toLowerCase().includes(term) ||
          LEVELS[card.level].label.toLowerCase().includes(term)
        );
      });
    }, [cards, searchTerm]);

    function selectNextCard(excludedId = null) {
      const nextCard = pickWeightedCard(cards, excludedId);

      setCurrentId(nextCard?.id || null);
      setShowAnswer(false);

      if (nextCard) {
        setMessage(
          `Nächste Karte: ${LEVELS[nextCard.level].label}
          (${LEVELS[nextCard.level].weight}% Kategorie-Gewichtung).`
        );
      }
    }

    function addCard() {
      if (!question.trim() || !answer.trim()) {
        setMessage("Bitte Frage und Antwort ausfüllen.");
        return;
      }

      const newCard = createCard(question, answer, DEFAULT_LEVEL);

      setCards((previous) => [newCard, ...previous]);
      setCurrentId(newCard.id);
      setShowAnswer(false);
      setQuestion("");
      setAnswer("");
      setMessage("Karteikarte angelegt. Neue Karten starten bei Falsch.");
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
        const nextCard = pickWeightedCard(updatedCards, currentCard.id);

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
        setCurrentId(remaining[0]?.id || null);
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

        setCards((previous) => [...importedCards, ...previous]);
        setCurrentId(importedCards[0].id);
        setShowAnswer(false);

        setMessage(
          `${importedCards.length} Karteikarten importiert. Karten ohne Kategorie
          starten bei Falsch.`
        );

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

    function exportCsv() {
      const csv = exportCardsToCsv(cards);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "karteikarten.csv";
      link.click();

      URL.revokeObjectURL(url);
      setMessage("CSV exportiert.");
    }

    function resetProgress() {
      setCards((previous) =>
        previous.map((card) => ({
          ...card,
          level: DEFAULT_LEVEL,
          correctStreak: 0,
          totalAnswered: 0,
          partialCount: 0,
          wrongCount: 0,
          lastResult: null,
          lastAnsweredAt: null,
        }))
      );

      setMessage("Fortschritt zurückgesetzt. Alle Karten sind wieder Falsch.");
    }

    function clearAllCards() {
      setCards([]);
      setCurrentId(null);
      setShowAnswer(false);
      setMessage("Alle Karteikarten wurden gelöscht.");
    }

    return (
      <div className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-col gap-4 md:flex-row md:items-end
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
                disabled={!cards.length}
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

          <section className="grid gap-4 md:grid-cols-4">
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
          </section>

          <main className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
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
                      disabled={!cards.length || Boolean(ratingResult)}
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
                              <span className="flashcard-question">
                                {currentCard.question}
                              </span>
                              <span className="flashcard-hint">
                                Karte anklicken, um die Antwort zu sehen
                              </span>
                            </span>

                            <span className="flashcard-face flashcard-back">
                              <span className="flashcard-question-preview">
                                {currentCard.question}
                              </span>
                              <span className="flashcard-label">Antwort</span>
                              <span className="flashcard-answer">
                                {currentCard.answer}
                              </span>
                            </span>
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

              <Card className="rounded-3xl border-0 shadow-sm">
                <CardContent className="p-6">
                  <h2 className="mb-4 text-xl font-bold">Neue Karteikarte</h2>

                  <div className="grid gap-3">
                    <textarea
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      placeholder="Frage"
                      className="min-h-24 rounded-2xl border bg-white p-4
                      outline-none ring-blue-200 focus:ring-4"
                    />

                    <textarea
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      placeholder="Antwort"
                      className="min-h-24 rounded-2xl border bg-white p-4
                      outline-none ring-blue-200 focus:ring-4"
                    />

                    <Button
                      onClick={addCard}
                      className="w-fit rounded-2xl"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Karte anlegen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>

            <aside className="space-y-6">
              <Card className="rounded-3xl border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold">Sammlung</h2>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm
                    font-medium">
                      {cards.length} Karten
                    </span>
                  </div>

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
                        className={`rounded-2xl border bg-white p-3 ${
                          card.id === currentId ? "ring-2 ring-blue-300" : ""
                        }`}
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
                              {card.question}
                            </div>

                            <div className="mt-1 truncate text-sm text-slate-500">
                              {card.answer}
                            </div>
                          </button>

                          <button
                            onClick={() => deleteCard(card.id)}
                            className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Karte löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-0 shadow-sm">
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
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
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
                      disabled={!cards.length}
                      variant="outline"
                      className="rounded-2xl"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Fortschritt zurücksetzen
                    </Button>

                    <Button
                      onClick={clearAllCards}
                      disabled={!cards.length}
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
            </aside>
          </main>
        </div>
      </div>
    );
  }
