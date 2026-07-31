import { describe, expect, it } from "vitest";
import { createDeck, createCard, DEFAULT_LEVEL } from "../lib/storage.js";
import * as localBackend from "./localBackend.js";

function makeState() {
  const deck = createDeck("Test-Deck", true);
  const card = createCard("Frage", "Antwort", DEFAULT_LEVEL, deck.id);
  return { decks: [deck], cards: [card] };
}

describe("localBackend.addCard", () => {
  it("rejects empty question/answer", async () => {
    const state = makeState();
    const result = await localBackend.addCard(state, state.decks[0].id, "", "");
    expect(result.newCard).toBeUndefined();
    expect(result.cards).toEqual(state.cards);
  });

  it("adds a card to the given deck", async () => {
    const state = makeState();
    const result = await localBackend.addCard(state, state.decks[0].id, "Neue Frage", "Neue Antwort");
    expect(result.newCard.deckId).toBe(state.decks[0].id);
    expect(result.cards).toHaveLength(2);
  });
});

describe("localBackend.rateCard", () => {
  it("advances a level after three correct answers in a row", () => {
    let state = makeState();
    const cardId = state.cards[0].id;

    state = localBackend.rateCard(state, cardId, "richtig");
    state = localBackend.rateCard(state, cardId, "richtig");
    state = localBackend.rateCard(state, cardId, "richtig");

    const card = state.cards.find((item) => item.id === cardId);
    expect(card.level).toBe("mittel");
    expect(card.correctStreak).toBe(0);
  });

  it("drops a level and resets the streak on a wrong answer", () => {
    let state = makeState();
    const cardId = state.cards[0].id;

    state = localBackend.rateCard(state, cardId, "richtig");
    state = localBackend.rateCard(state, cardId, "falsch");

    const card = state.cards.find((item) => item.id === cardId);
    expect(card.level).toBe(DEFAULT_LEVEL);
    expect(card.correctStreak).toBe(0);
    expect(card.wrongCount).toBe(1);
  });
});

describe("localBackend.deleteDeck", () => {
  it("refuses to delete the last remaining deck", () => {
    const state = makeState();
    const result = localBackend.deleteDeck(state, state.decks[0]);
    expect(result.decks).toEqual(state.decks);
  });

  it("deletes a deck and its cards when another deck remains", () => {
    const state = makeState();
    const secondDeck = createDeck("Zweites Deck");
    state.decks.push(secondDeck);

    const result = localBackend.deleteDeck(state, state.decks[0]);
    expect(result.decks).toHaveLength(1);
    expect(result.cards).toHaveLength(0);
  });
});
