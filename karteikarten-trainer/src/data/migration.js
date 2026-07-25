import { supabase } from "../lib/supabaseClient.js";
import { loadStoredData } from "../lib/storage.js";

const MIGRATION_FLAG_KEY = "karteikarten_trainer_migrated_v1";

export function hasLocalData() {
  const { decks, cards } = loadStoredData();
  return decks.length > 0 && cards.length > 0;
}

export function hasMigrated() {
  return Boolean(localStorage.getItem(MIGRATION_FLAG_KEY));
}

export function markMigrated(userId, skipped = false) {
  localStorage.setItem(
    MIGRATION_FLAG_KEY,
    JSON.stringify({ migratedAt: new Date().toISOString(), userId, skipped })
  );
}

export function previewImport() {
  const { decks, cards } = loadStoredData();
  return {
    deckCount: decks.length,
    cardCount: cards.length,
    deckNames: decks.map((deck) => deck.name),
  };
}

export async function runImport(userId) {
  const { decks, cards } = loadStoredData();
  let importedDecks = 0;
  let importedCards = 0;

  for (const deck of decks) {
    const deckCards = cards.filter((card) => card.deckId === deck.id);
    if (!deckCards.length) continue;

    const { data: newDeck, error: deckError } = await supabase
      .from("decks")
      .insert({ name: deck.name, owner_id: userId })
      .select()
      .single();

    if (deckError) throw deckError;
    importedDecks += 1;

    for (const card of deckCards) {
      const { data: newCard, error: cardError } = await supabase
        .from("cards")
        .insert({
          deck_id: newDeck.id,
          question: card.question,
          answer: card.answer,
          created_by: userId,
        })
        .select()
        .single();

      if (cardError) throw cardError;
      importedCards += 1;

      if (card.totalAnswered > 0 || card.level !== "falsch") {
        const { error: progressError } = await supabase.from("user_card_progress").insert({
          card_id: newCard.id,
          user_id: userId,
          level: card.level,
          correct_streak: card.correctStreak,
          total_answered: card.totalAnswered,
          partial_count: card.partialCount,
          wrong_count: card.wrongCount,
          last_result: card.lastResult,
          last_answered_at: card.lastAnsweredAt,
        });

        if (progressError) throw progressError;
      }
    }
  }

  markMigrated(userId, false);
  return { importedDecks, importedCards };
}
