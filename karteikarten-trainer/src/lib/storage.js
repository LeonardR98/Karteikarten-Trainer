export const STORAGE_KEY = "karteikarten_trainer_final_v1";

export const LEVELS = {
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

export const LEVEL_ORDER = ["falsch", "mittel", "gut", "verstanden"];
export const DEFAULT_LEVEL = "falsch";

export function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeLevel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return LEVELS[normalized] ? normalized : DEFAULT_LEVEL;
}

export function normalizeCardText(value) {
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

export function cardTextToPlainText(value) {
  return normalizeCardText(value)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .trim();
}

export function cardTextToCsvText(value) {
  return normalizeCardText(value)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .split("\n")
    .map((line) => line.replace(/^[-*]\s+/, "• ").trim())
    .filter(Boolean)
    .join(" · ");
}

export function createDeck(name = "Default", isDefault = false) {
  return {
    id: createId(),
    name: String(name || "Default").trim() || "Default",
    isDefault,
    createdAt: new Date().toISOString(),
  };
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const result = [];

  for (const tag of tags) {
    const trimmed = String(tag || "").trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function createCard(question, answer, level = DEFAULT_LEVEL, deckId, tags = []) {
  return {
    id: createId(),
    deckId,
    question: normalizeCardText(question),
    answer: normalizeCardText(answer),
    level: normalizeLevel(level),
    tags: normalizeTags(tags),
    correctStreak: 0,
    totalAnswered: 0,
    partialCount: 0,
    wrongCount: 0,
    lastResult: null,
    createdAt: new Date().toISOString(),
    lastAnsweredAt: null,
  };
}

export function loadStoredData() {
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
        ...createCard(card.question, card.answer, card.level, card.deckId, card.tags),
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

export function parseCsvRows(text) {
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

export function importCardsFromCsv(text) {
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

export function exportCardsToCsv(cards) {
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
