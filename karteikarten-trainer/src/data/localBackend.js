import {
  DEFAULT_LEVEL,
  createCard,
  createDeck,
  normalizeTags,
} from "../lib/storage.js";
import { moveLevel } from "../lib/srs.js";

// Pure, storage-agnostic operations on {decks, cards}. Each function takes the
// current state plus arguments and returns { decks, cards, message, ...extra }.
// DataProvider wires these to React state; supabaseBackend (added in M3) will
// expose the same method names against Supabase instead.

export function createNewDeck(state, name) {
  const trimmedName = String(name || "").trim();

  if (!trimmedName) {
    return { ...state, message: "Bitte einen Namen für das Deck eingeben." };
  }

  const deck = createDeck(trimmedName);

  return {
    decks: [...state.decks, deck],
    cards: state.cards,
    message: `Deck „${deck.name}“ angelegt.`,
    newDeck: deck,
  };
}

export function renameDeck(state, targetDeck, name) {
  if (!targetDeck) return state;
  const trimmedName = String(name || "").trim();

  if (!trimmedName) {
    return { ...state, message: "Ein Deck braucht einen Namen." };
  }

  return {
    decks: state.decks.map((deck) =>
      deck.id === targetDeck.id ? { ...deck, name: trimmedName } : deck
    ),
    cards: state.cards,
    message: `Deck in „${trimmedName}“ umbenannt.`,
  };
}

export function deleteDeck(state, deck) {
  if (!deck) return state;

  if (state.decks.length <= 1) {
    return { ...state, message: "Mindestens ein Deck muss erhalten bleiben." };
  }

  const remainingDecks = state.decks.filter((item) => item.id !== deck.id);
  const nextDeck = remainingDecks.find((item) => item.isDefault) || remainingDecks[0];

  return {
    decks: remainingDecks,
    cards: state.cards.filter((card) => card.deckId !== deck.id),
    message: `Deck „${deck.name}“ gelöscht.`,
    nextDeck,
  };
}

export function moveCardToDeck(state, cardId, targetDeck) {
  const card = state.cards.find((item) => item.id === cardId);

  if (!card || card.deckId === targetDeck.id) return state;

  return {
    decks: state.decks,
    cards: state.cards.map((item) =>
      item.id === cardId ? { ...item, deckId: targetDeck.id } : item
    ),
    message: `Karte in Deck „${targetDeck.name}“ verschoben.`,
    movedCardId: cardId,
  };
}

export function addCard(state, deckId, question, answer, tags = []) {
  if (!String(question || "").trim() || !String(answer || "").trim()) {
    return { ...state, message: "Bitte Frage und Antwort ausfüllen." };
  }

  if (!deckId) {
    return { ...state, message: "Bitte zuerst ein Deck auswählen." };
  }

  const newCard = createCard(question, answer, DEFAULT_LEVEL, deckId, tags);

  return {
    decks: state.decks,
    cards: [newCard, ...state.cards],
    message: "Karteikarte angelegt. Neue Karten starten bei Falsch.",
    newCard,
  };
}

export function saveEditedCard(state, cardId, question, answer, tags) {
  const nextQuestion = String(question || "").trim();
  const nextAnswer = String(answer || "").trim();

  if (!nextQuestion || !nextAnswer) {
    return { ...state, message: "Bitte Frage und Antwort ausfüllen." };
  }

  return {
    decks: state.decks,
    cards: state.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            question: nextQuestion,
            answer: nextAnswer,
            tags: tags === undefined ? card.tags : normalizeTags(tags),
          }
        : card
    ),
    message: "Karteikarte gespeichert.",
  };
}

export function rateCard(state, cardId, result) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return state;

  let nextLevel = card.level;
  let nextStreak = card.correctStreak;
  let nextPartialCount = card.partialCount;
  let nextWrongCount = card.wrongCount;

  if (result === "richtig") {
    nextStreak += 1;

    if (nextStreak >= 3) {
      nextLevel = moveLevel(card.level, 1);
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
    nextLevel = moveLevel(card.level, -1);
  }

  return {
    decks: state.decks,
    cards: state.cards.map((item) =>
      item.id === cardId
        ? {
            ...item,
            level: nextLevel,
            correctStreak: nextStreak,
            partialCount: nextPartialCount,
            wrongCount: nextWrongCount,
            totalAnswered: item.totalAnswered + 1,
            lastResult: result,
            lastAnsweredAt: new Date().toISOString(),
          }
        : item
    ),
  };
}

export function deleteCard(state, cardId) {
  return {
    decks: state.decks,
    cards: state.cards.filter((card) => card.id !== cardId),
    message: "Karteikarte gelöscht.",
  };
}

export function finishImport(state, importedCards, targetDeckId, newDeckName) {
  let targetDeck = state.decks.find((deck) => deck.id === targetDeckId);
  let decks = state.decks;

  if (targetDeckId === "new") {
    const name = String(newDeckName || "").trim();
    if (!name) {
      return { ...state, message: "Bitte einen Namen für das neue Deck eingeben." };
    }

    targetDeck = createDeck(name);
    decks = [...decks, targetDeck];
  }

  if (!targetDeck) {
    return { ...state, message: "Bitte ein Ziel-Deck auswählen." };
  }

  const imported = importedCards.map((card) =>
    createCard(card.question, card.answer, card.level, targetDeck.id)
  );

  return {
    decks,
    cards: [...imported, ...state.cards],
    message: `${imported.length} Karteikarten in „${targetDeck.name}“ importiert.`,
    targetDeck,
    imported,
  };
}

export function resetProgress(state, deckId) {
  return {
    decks: state.decks,
    cards: state.cards.map((card) =>
      card.deckId !== deckId
        ? card
        : {
            ...card,
            level: DEFAULT_LEVEL,
            correctStreak: 0,
            totalAnswered: 0,
            partialCount: 0,
            wrongCount: 0,
            lastResult: null,
            lastAnsweredAt: null,
          }
    ),
    message: "Fortschritt dieses Decks zurückgesetzt.",
  };
}

export function clearAllCards(state, deckId) {
  return {
    decks: state.decks,
    cards: state.cards.filter((card) => card.deckId !== deckId),
    message: "Alle Karten dieses Decks wurden gelöscht.",
  };
}
