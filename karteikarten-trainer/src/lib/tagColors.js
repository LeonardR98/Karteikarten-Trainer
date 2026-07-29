// Fixed palette instead of free color choice — every entry is pre-paired
// with a readable text color, so there is no runtime contrast calculation
// and the result always matches the app's existing pastel badge look (see
// LEVELS in storage.js), in both light and dark mode alike.
export const TAG_COLOR_PALETTE = [
  { value: "rose", label: "Rosé", background: "#ffe4e6", foreground: "#9f1239" },
  { value: "orange", label: "Orange", background: "#ffedd5", foreground: "#9a3412" },
  { value: "amber", label: "Amber", background: "#fef3c7", foreground: "#92400e" },
  { value: "lime", label: "Lime", background: "#ecfccb", foreground: "#3f6212" },
  { value: "emerald", label: "Smaragd", background: "#d1fae5", foreground: "#065f46" },
  { value: "teal", label: "Türkis", background: "#ccfbf1", foreground: "#115e59" },
  { value: "cyan", label: "Cyan", background: "#cffafe", foreground: "#155e75" },
  { value: "blue", label: "Blau", background: "#dbeafe", foreground: "#1e40af" },
  { value: "violet", label: "Violett", background: "#ede9fe", foreground: "#5b21b6" },
  { value: "fuchsia", label: "Fuchsia", background: "#fae8ff", foreground: "#86198f" },
];

const PALETTE_BY_VALUE = Object.fromEntries(
  TAG_COLOR_PALETTE.map((entry) => [entry.value, entry])
);

// tagColors is the { [tagNameLowerCase]: paletteValue } map for one deck.
export function getTagColorStyle(tagName, tagColors) {
  const value = tagColors?.[String(tagName || "").toLowerCase()];
  const entry = value && PALETTE_BY_VALUE[value];
  if (!entry) return undefined;

  return { backgroundColor: entry.background, color: entry.foreground, borderColor: entry.foreground };
}
