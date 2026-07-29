import { LEVELS, normalizeLevel } from "../../lib/storage.js";

export function Badge({ level }) {
  const safeLevel = normalizeLevel(level);
  const item = LEVELS[safeLevel];

  return (
    <span className={`status-badge status-${safeLevel} rounded-full border px-3 py-1 text-xs font-semibold
    ${item.color}`}>
      {item.label}
    </span>
  );
}
