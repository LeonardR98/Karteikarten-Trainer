import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { STORAGE_KEY, loadStoredData } from "../lib/storage.js";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../auth/AuthContext.jsx";
import * as localBackend from "./localBackend.js";
import * as supabaseBackend from "./supabaseBackend.js";
import { hasLocalData, hasMigrated, markMigrated, previewImport, runImport } from "./migration.js";

// Central data layer. Local (localStorage) while signed out, Supabase once
// authenticated — the actions surface is identical either way, so UI
// components never need to know which backend is active.

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user, status: authStatus } = useAuth();
  const isCloud = authStatus === "authenticated";

  const [initialData] = useState(loadStoredData);
  const [decks, setDecks] = useState(initialData.decks);
  const [cards, setCards] = useState(initialData.cards);
  const [message, setMessage] = useState(initialData.error || "Bereit zum Lernen.");
  const [cloudLoadedForUserId, setCloudLoadedForUserId] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const isLoadingCloud = isCloud && cloudLoadedForUserId !== user?.id;

  // Persist to localStorage only while in local (signed-out) mode.
  useEffect(() => {
    if (isCloud) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ decks, cards }));
  }, [decks, cards, isCloud]);

  // On sign-in, load the user's cloud decks/cards once.
  useEffect(() => {
    if (!isCloud || !user) return;

    let cancelled = false;

    supabaseBackend
      .fetchState(user.id)
      .then((state) => {
        if (cancelled) return;
        setDecks(state.decks);
        setCards(state.cards);

        if (hasLocalData() && !hasMigrated()) {
          setImportPreview(previewImport());
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setMessage(`Cloud-Daten konnten nicht geladen werden: ${error.message}`);
      })
      .finally(() => {
        if (!cancelled) setCloudLoadedForUserId(user.id);
      });

    return () => {
      cancelled = true;
    };
  }, [isCloud, user]);

  // Live-sync: refetch when another member changes cards/tags on any deck
  // we belong to. Simple and correct at this app's scale; a future
  // optimization could scope subscriptions to just the open deck.
  useEffect(() => {
    if (!isCloud || !user || !supabase) return;

    let refetchTimer = null;
    function scheduleRefetch() {
      window.clearTimeout(refetchTimer);
      refetchTimer = window.setTimeout(() => {
        supabaseBackend.fetchState(user.id).then((state) => {
          setDecks(state.decks);
          setCards(state.cards);
          setMessage("Diese Ansicht wurde durch eine Änderung eines anderen Mitglieds aktualisiert.");
        });
      }, 400);
    }

    const channel = supabase
      .channel(`deck-sync-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cards" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "tags" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "card_tags" }, scheduleRefetch)
      .subscribe();

    return () => {
      window.clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
    };
  }, [isCloud, user]);

  const actions = useMemo(() => {
    function apply(result) {
      setDecks(result.decks);
      setCards(result.cards);
      if (result.message) setMessage(result.message);
      return result;
    }

    if (isCloud && user) {
      const context = { userId: user.id };

      return {
        async saveNow() {
          setMessage("In der Cloud wird automatisch bei jeder Änderung gespeichert.");
        },
        createDeck: (name) => supabaseBackend.createNewDeck(context, name).then(apply),
        renameDeck: (deck, name) => supabaseBackend.renameDeck(context, deck, name).then(apply),
        deleteDeck: (deck) => supabaseBackend.deleteDeck(context, deck).then(apply),
        moveCardToDeck: (cardId, targetDeck) =>
          supabaseBackend.moveCardToDeck(context, cardId, targetDeck).then(apply),
        addCard: (deckId, question, answer, tags) =>
          supabaseBackend.addCard(context, deckId, question, answer, tags).then(apply),
        saveEditedCard: (cardId, question, answer, tags) =>
          supabaseBackend.saveEditedCard(context, cardId, question, answer, tags).then(apply),
        rateCard: (cardId, result) => supabaseBackend.rateCard(context, cardId, result).then(apply),
        deleteCard: (cardId) => supabaseBackend.deleteCard(context, cardId).then(apply),
        finishImport: (importedCards, targetDeckId, newDeckName) =>
          supabaseBackend
            .finishImport(context, importedCards, targetDeckId, newDeckName)
            .then(apply),
        resetProgress: (deckId) => supabaseBackend.resetProgress(context, deckId).then(apply),
        clearAllCards: (deckId) => supabaseBackend.clearAllCards(context, deckId).then(apply),
      };
    }

    // Local mode: wrap the synchronous localBackend results in resolved
    // promises so every action has the same async surface regardless of
    // which backend is active.
    return {
      async saveNow() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ decks, cards }));
        setMessage("Karteikarten gespeichert.");
      },
      async createDeck(name) {
        return apply(localBackend.createNewDeck({ decks, cards }, name));
      },
      async renameDeck(deck, name) {
        return apply(localBackend.renameDeck({ decks, cards }, deck, name));
      },
      async deleteDeck(deck) {
        return apply(localBackend.deleteDeck({ decks, cards }, deck));
      },
      async moveCardToDeck(cardId, targetDeck) {
        return apply(localBackend.moveCardToDeck({ decks, cards }, cardId, targetDeck));
      },
      async addCard(deckId, question, answer, tags) {
        return apply(localBackend.addCard({ decks, cards }, deckId, question, answer, tags));
      },
      async saveEditedCard(cardId, question, answer, tags) {
        return apply(localBackend.saveEditedCard({ decks, cards }, cardId, question, answer, tags));
      },
      async rateCard(cardId, result) {
        return apply(localBackend.rateCard({ decks, cards }, cardId, result));
      },
      async deleteCard(cardId) {
        return apply(localBackend.deleteCard({ decks, cards }, cardId));
      },
      async finishImport(importedCards, targetDeckId, newDeckName) {
        return apply(
          localBackend.finishImport({ decks, cards }, importedCards, targetDeckId, newDeckName)
        );
      },
      async resetProgress(deckId) {
        return apply(localBackend.resetProgress({ decks, cards }, deckId));
      },
      async clearAllCards(deckId) {
        return apply(localBackend.clearAllCards({ decks, cards }, deckId));
      },
    };
  }, [decks, cards, isCloud, user]);

  async function importLocalData() {
    if (!user) return;
    setIsImporting(true);

    try {
      await runImport(user.id);
      const state = await supabaseBackend.fetchState(user.id);
      setDecks(state.decks);
      setCards(state.cards);
      setMessage("Lokale Karteikarten wurden importiert.");
    } catch (error) {
      setMessage(`Import fehlgeschlagen: ${error.message}`);
    } finally {
      setIsImporting(false);
      setImportPreview(null);
    }
  }

  function skipLocalImport() {
    if (user) markMigrated(user.id, true);
    setImportPreview(null);
  }

  const value = useMemo(
    () => ({
      decks,
      cards,
      message,
      setMessage,
      actions,
      isCloud,
      isLoadingCloud,
      importPreview,
      isImporting,
      importLocalData,
      skipLocalImport,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [decks, cards, message, actions, isCloud, isLoadingCloud, importPreview, isImporting, user]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within a DataProvider");
  return context;
}
