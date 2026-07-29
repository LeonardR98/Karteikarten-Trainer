// Shared by CollectionPanel.jsx and DeckSettingsModal.jsx so both group
// cards by topic identically. Pure grouping only — search/filter happens
// upstream in each caller before the (already narrowed) list gets here.
export const NO_TOPIC_LABEL = "Ohne Thema";

export function groupCardsByTopic(cards) {
  const groups = new Map();

  for (const card of cards || []) {
    const topics = card.tags?.length ? card.tags : [NO_TOPIC_LABEL];
    for (const topic of topics) {
      if (!groups.has(topic)) groups.set(topic, []);
      groups.get(topic).push(card);
    }
  }

  return Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === NO_TOPIC_LABEL) return 1;
    if (b === NO_TOPIC_LABEL) return -1;
    return a.localeCompare(b);
  });
}
