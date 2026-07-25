import { LEVELS, LEVEL_ORDER, normalizeLevel } from "./storage.js";

export function moveLevel(level, direction) {
  const currentIndex = LEVEL_ORDER.indexOf(normalizeLevel(level));
  const nextIndex = Math.min(
    Math.max(currentIndex + direction, 0),
    LEVEL_ORDER.length - 1
  );

  return LEVEL_ORDER[nextIndex];
}

export function pickWeightedCard(cards, excludedId = null) {
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
