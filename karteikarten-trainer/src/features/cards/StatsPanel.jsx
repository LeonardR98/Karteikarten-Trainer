import { Card, CardContent } from "../../components/Button.jsx";
import { LEVELS, LEVEL_ORDER } from "../../lib/storage.js";
import { Badge } from "./CardDisplay.jsx";

export function StatsPanel({ stats, activeDeckSummary }) {
  return (
    <section className="concept-stats grid gap-4 md:grid-cols-4">
      {LEVEL_ORDER.slice()
        .reverse()
        .map((level) => (
          <Card key={level} className="rounded-3xl border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <Badge level={level} />
                <span className="text-sm font-medium text-slate-500">
                  {LEVELS[level].weight}%
                </span>
              </div>

              <div className="mt-4 text-3xl font-bold">{stats[level]}</div>
              <div className="text-sm text-slate-500">
                Karten in dieser Kategorie
              </div>
            </CardContent>
          </Card>
        ))}
      <div className="stats-progress-summary">
        <span>Lernfortschritt in diesem Deck</span>
        <span className="stats-progress-bar" aria-label={`${activeDeckSummary?.completionPercent || 0}% abgeschlossen`}>
          {LEVEL_ORDER.map((level) => (
            <span
              key={level}
              className={`deck-progress-segment ${level}`}
              style={{
                width: `${activeDeckSummary?.cardCount ? (activeDeckSummary.levelCounts[level] / activeDeckSummary.cardCount) * 100 : 0}%`,
              }}
            />
          ))}
        </span>
        <strong>{activeDeckSummary?.completionPercent || 0}% abgeschlossen</strong>
      </div>
    </section>
  );
}
