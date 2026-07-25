import { supabase } from "../lib/supabaseClient.js";
import { DEFAULT_LEVEL, normalizeTags } from "../lib/storage.js";
import { moveLevel } from "../lib/srs.js";

// Same action surface as localBackend.js, but backed by Supabase. Unlike
// localBackend's pure (state, ...args) => state functions, these are async
// and always refetch the authoritative state from the database after a
// mutation — simpler and safer than hand-merging optimistic updates, at the
// cost of an extra round trip per action. Fine at this app's scale.

function mapCard(row, progressByCardId, tagsByCardId) {
  const progress = progressByCardId?.[row.id];

  return {
    id: row.id,
    deckId: row.deck_id,
    question: row.question,
    answer: row.answer,
    level: progress?.level || DEFAULT_LEVEL,
    tags: tagsByCardId?.[row.id] || [],
    correctStreak: progress?.correct_streak || 0,
    totalAnswered: progress?.total_answered || 0,
    partialCount: progress?.partial_count || 0,
    wrongCount: progress?.wrong_count || 0,
    lastResult: progress?.last_result || null,
    createdAt: row.created_at,
    lastAnsweredAt: progress?.last_answered_at || null,
  };
}

// Resolves tag names to tag ids for a deck, creating any that don't exist
// yet. Used both for setting a card's tags and for auto-creating matching
// tags in the target deck when a card is moved cross-deck.
async function resolveTagIds(deckId, tagNames) {
  const names = normalizeTags(tagNames);
  if (!names.length) return [];

  const { data: existing, error: selectError } = await supabase
    .from("tags")
    .select("id, name")
    .eq("deck_id", deckId)
    .in("name", names);

  if (selectError) throw selectError;

  const existingByName = Object.fromEntries(
    (existing || []).map((tag) => [tag.name.toLowerCase(), tag.id])
  );
  const missing = names.filter((name) => !existingByName[name.toLowerCase()]);

  if (missing.length) {
    const { data: created, error: insertError } = await supabase
      .from("tags")
      .insert(missing.map((name) => ({ deck_id: deckId, name })))
      .select("id, name");

    if (insertError) throw insertError;

    for (const tag of created || []) {
      existingByName[tag.name.toLowerCase()] = tag.id;
    }
  }

  return names.map((name) => existingByName[name.toLowerCase()]);
}

async function setCardTags(cardId, deckId, tagNames) {
  const tagIds = await resolveTagIds(deckId, tagNames);

  const { error: deleteError } = await supabase.from("card_tags").delete().eq("card_id", cardId);
  if (deleteError) throw deleteError;

  if (tagIds.length) {
    const { error: insertError } = await supabase
      .from("card_tags")
      .insert(tagIds.map((tagId) => ({ card_id: cardId, tag_id: tagId })));

    if (insertError) throw insertError;
  }
}

async function fetchState(userId) {
  const { data: deckRows, error: decksError } = await supabase
    .from("decks")
    .select("id, name, owner_id, created_at")
    .order("created_at", { ascending: true });

  if (decksError) throw decksError;

  const deckIdsForRole = (deckRows || []).map((deck) => deck.id);
  let myRoleByDeckId = {};

  if (deckIdsForRole.length) {
    const { data: memberRows, error: memberError } = await supabase
      .from("deck_members")
      .select("deck_id, role")
      .eq("user_id", userId)
      .in("deck_id", deckIdsForRole);

    if (memberError) throw memberError;
    myRoleByDeckId = Object.fromEntries((memberRows || []).map((row) => [row.deck_id, row.role]));
  }

  const decks = (deckRows || []).map((deck) => ({
    id: deck.id,
    name: deck.name,
    isDefault: false,
    createdAt: deck.created_at,
    ownerId: deck.owner_id,
    myRole: myRoleByDeckId[deck.id] || "viewer",
  }));

  const deckIds = decks.map((deck) => deck.id);

  if (!deckIds.length) return { decks, cards: [] };

  const { data: cardRows, error: cardsError } = await supabase
    .from("cards")
    .select("id, deck_id, question, answer, created_at")
    .in("deck_id", deckIds)
    .order("created_at", { ascending: false });

  if (cardsError) throw cardsError;

  const cardIds = (cardRows || []).map((card) => card.id);
  let progressByCardId = {};
  let tagsByCardId = {};

  if (cardIds.length) {
    const { data: progressRows, error: progressError } = await supabase
      .from("user_card_progress")
      .select("*")
      .eq("user_id", userId)
      .in("card_id", cardIds);

    if (progressError) throw progressError;

    progressByCardId = Object.fromEntries(
      (progressRows || []).map((row) => [row.card_id, row])
    );

    const { data: cardTagRows, error: cardTagsError } = await supabase
      .from("card_tags")
      .select("card_id, tags(name)")
      .in("card_id", cardIds);

    if (cardTagsError) throw cardTagsError;

    tagsByCardId = {};
    for (const row of cardTagRows || []) {
      const name = row.tags?.name;
      if (!name) continue;
      (tagsByCardId[row.card_id] ||= []).push(name);
    }
  }

  const cards = (cardRows || []).map((row) => mapCard(row, progressByCardId, tagsByCardId));

  return { decks, cards };
}

export async function createNewDeck(context, name) {
  const trimmedName = String(name || "").trim();

  if (!trimmedName) {
    const state = await fetchState(context.userId);
    return { ...state, message: "Bitte einen Namen für das Deck eingeben." };
  }

  const { data, error } = await supabase
    .from("decks")
    .insert({ name: trimmedName, owner_id: context.userId })
    .select()
    .single();

  if (error) throw error;

  const state = await fetchState(context.userId);
  const newDeck = state.decks.find((deck) => deck.id === data.id);

  return { ...state, message: `Deck „${trimmedName}“ angelegt.`, newDeck };
}

export async function renameDeck(context, targetDeck, name) {
  const trimmedName = String(name || "").trim();

  if (!trimmedName) {
    const state = await fetchState(context.userId);
    return { ...state, message: "Ein Deck braucht einen Namen." };
  }

  const { error } = await supabase
    .from("decks")
    .update({ name: trimmedName })
    .eq("id", targetDeck.id);

  if (error) throw error;

  const state = await fetchState(context.userId);
  return { ...state, message: `Deck in „${trimmedName}“ umbenannt.` };
}

export async function deleteDeck(context, deck) {
  const before = await fetchState(context.userId);

  if (before.decks.length <= 1) {
    return { ...before, message: "Mindestens ein Deck muss erhalten bleiben." };
  }

  const { error } = await supabase.from("decks").delete().eq("id", deck.id);
  if (error) throw error;

  const state = await fetchState(context.userId);
  const nextDeck = state.decks[0];

  return { ...state, message: `Deck „${deck.name}“ gelöscht.`, nextDeck };
}

export async function moveCardToDeck(context, cardId, targetDeck) {
  const before = await fetchState(context.userId);
  const card = before.cards.find((item) => item.id === cardId);

  const { error } = await supabase
    .from("cards")
    .update({ deck_id: targetDeck.id })
    .eq("id", cardId);

  if (error) throw error;

  // Tags are deck-local: auto-create matching tag names in the target deck
  // and relink, so the card keeps its tags across the move.
  if (card?.tags?.length) {
    await setCardTags(cardId, targetDeck.id, card.tags);
  }

  const state = await fetchState(context.userId);
  return { ...state, message: `Karte in Deck „${targetDeck.name}“ verschoben.`, movedCardId: cardId };
}

export async function addCard(context, deckId, question, answer, tags = []) {
  if (!String(question || "").trim() || !String(answer || "").trim()) {
    const state = await fetchState(context.userId);
    return { ...state, message: "Bitte Frage und Antwort ausfüllen." };
  }

  if (!deckId) {
    const state = await fetchState(context.userId);
    return { ...state, message: "Bitte zuerst ein Deck auswählen." };
  }

  const { data, error } = await supabase
    .from("cards")
    .insert({
      deck_id: deckId,
      question: String(question).trim(),
      answer: String(answer).trim(),
      created_by: context.userId,
    })
    .select()
    .single();

  if (error) throw error;

  if (tags?.length) {
    await setCardTags(data.id, deckId, tags);
  }

  const state = await fetchState(context.userId);
  const newCard = state.cards.find((card) => card.id === data.id);

  return { ...state, message: "Karteikarte angelegt. Neue Karten starten bei Falsch.", newCard };
}

export async function saveEditedCard(context, cardId, question, answer, tags) {
  const nextQuestion = String(question || "").trim();
  const nextAnswer = String(answer || "").trim();

  if (!nextQuestion || !nextAnswer) {
    const state = await fetchState(context.userId);
    return { ...state, message: "Bitte Frage und Antwort ausfüllen." };
  }

  const { data: cardRow, error } = await supabase
    .from("cards")
    .update({ question: nextQuestion, answer: nextAnswer })
    .eq("id", cardId)
    .select("deck_id")
    .single();

  if (error) throw error;

  if (tags !== undefined) {
    await setCardTags(cardId, cardRow.deck_id, tags);
  }

  const state = await fetchState(context.userId);
  return { ...state, message: "Karteikarte gespeichert." };
}

export async function rateCard(context, cardId, result) {
  const before = await fetchState(context.userId);
  const card = before.cards.find((item) => item.id === cardId);
  if (!card) return before;

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

  const { error } = await supabase.from("user_card_progress").upsert({
    card_id: cardId,
    user_id: context.userId,
    level: nextLevel,
    correct_streak: nextStreak,
    total_answered: card.totalAnswered + 1,
    partial_count: nextPartialCount,
    wrong_count: nextWrongCount,
    last_result: result,
    last_answered_at: new Date().toISOString(),
  });

  if (error) throw error;

  return fetchState(context.userId);
}

export async function deleteCard(context, cardId) {
  const { error } = await supabase.from("cards").delete().eq("id", cardId);
  if (error) throw error;

  const state = await fetchState(context.userId);
  return { ...state, message: "Karteikarte gelöscht." };
}

export async function finishImport(context, importedCards, targetDeckId, newDeckName) {
  let deckId = targetDeckId;
  let targetDeckName = null;

  if (targetDeckId === "new") {
    const name = String(newDeckName || "").trim();
    if (!name) {
      const state = await fetchState(context.userId);
      return { ...state, message: "Bitte einen Namen für das neue Deck eingeben." };
    }

    const { data, error } = await supabase
      .from("decks")
      .insert({ name, owner_id: context.userId })
      .select()
      .single();

    if (error) throw error;
    deckId = data.id;
    targetDeckName = name;
  }

  if (!deckId) {
    const state = await fetchState(context.userId);
    return { ...state, message: "Bitte ein Ziel-Deck auswählen." };
  }

  const rows = importedCards.map((card) => ({
    deck_id: deckId,
    question: card.question,
    answer: card.answer,
    created_by: context.userId,
  }));

  const { error: insertError } = await supabase.from("cards").insert(rows);
  if (insertError) throw insertError;

  const state = await fetchState(context.userId);
  const targetDeck = state.decks.find((deck) => deck.id === deckId);
  const imported = state.cards.filter((card) => card.deckId === deckId).slice(0, rows.length);

  return {
    ...state,
    message: `${rows.length} Karteikarten in „${targetDeckName || targetDeck?.name}“ importiert.`,
    targetDeck,
    imported,
  };
}

export async function resetProgress(context, deckId) {
  const state = await fetchState(context.userId);
  const cardIds = state.cards.filter((card) => card.deckId === deckId).map((card) => card.id);

  if (cardIds.length) {
    const { error } = await supabase
      .from("user_card_progress")
      .delete()
      .eq("user_id", context.userId)
      .in("card_id", cardIds);

    if (error) throw error;
  }

  const next = await fetchState(context.userId);
  return { ...next, message: "Fortschritt dieses Decks zurückgesetzt." };
}

export async function clearAllCards(context, deckId) {
  const { error } = await supabase.from("cards").delete().eq("deck_id", deckId);
  if (error) throw error;

  const state = await fetchState(context.userId);
  return { ...state, message: "Alle Karten dieses Decks wurden gelöscht." };
}

export async function listMembers(deckId) {
  const { data, error } = await supabase
    .from("deck_members")
    .select("user_id, role, profiles(email, display_name)")
    .eq("deck_id", deckId);

  if (error) throw error;

  return (data || []).map((row) => ({
    userId: row.user_id,
    role: row.role,
    email: row.profiles?.email || row.user_id,
    displayName: row.profiles?.display_name || null,
  }));
}

export { fetchState };
