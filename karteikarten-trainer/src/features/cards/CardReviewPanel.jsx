import { Shuffle } from "lucide-react";
import { Button, Card, CardContent } from "../../components/Button.jsx";
import { cardTextToPlainText } from "../../lib/storage.js";
import { FormattedCardText } from "../../components/FormattedCardText.jsx";
import { Badge } from "./CardDisplay.jsx";

// The main "Durchgehen" flip-card view: shows the active card's question,
// flips to the answer on click, then Richtig/Teilweise/Falsch rate it.
export function CardReviewPanel({
  activeCardsCount,
  currentCard,
  showAnswer,
  onToggleAnswer,
  ratingResult,
  onRate,
  onShuffle,
}) {
  return (
    <Card className="rounded-3xl border-0 shadow-sm">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Durchgehen</h2>
            <p className="text-sm text-slate-500">
              Erst antworten, dann Lösung anzeigen und bewerten.
            </p>
          </div>

          <Button
            onClick={onShuffle}
            disabled={!activeCardsCount || Boolean(ratingResult)}
            variant="outline"
            className="rounded-2xl"
          >
            <Shuffle className="mr-2 h-4 w-4" />
            Zufall
          </Button>
        </div>

        {currentCard ? (
          <div className="rounded-3xl bg-gradient-to-br from-white to-slate-100 p-6 shadow-inner">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <Badge level={currentCard.level} />

              <span className="text-sm text-slate-500">
                Richtig-Serie: {currentCard.correctStreak}/3 ·
                Beantwortet: {currentCard.totalAnswered}
              </span>
            </div>

            <div className="flashcard-scene">
              <button
                type="button"
                key={currentCard.id}
                className={`flashcard ${
                  showAnswer ? "is-flipped" : ""
                } ${ratingResult ? `is-rating-${ratingResult}` : ""}`}
                onClick={() => {
                  if (!ratingResult) onToggleAnswer();
                }}
                aria-label="Karte drehen und Antwort anzeigen"
              >
                <span className="flashcard-face flashcard-front">
                  <span className="flashcard-label">Frage</span>
                  {currentCard.imageQuestion && (
                    <img src={currentCard.imageQuestion} alt="" className="flashcard-image" />
                  )}
                  <FormattedCardText
                    value={currentCard.question}
                    className="flashcard-content flashcard-question"
                  />
                  <span className="flashcard-hint">
                    Karte anklicken, um die Antwort zu sehen
                  </span>
                </span>

                <span className="flashcard-face flashcard-back">
                  <span className="flashcard-question-preview">
                    {cardTextToPlainText(currentCard.question)}
                  </span>
                  <span className="flashcard-label">Antwort</span>
                  {currentCard.imageAnswer && (
                    <img src={currentCard.imageAnswer} alt="" className="flashcard-image" />
                  )}
                  <FormattedCardText
                    value={currentCard.answer}
                    className="flashcard-content flashcard-answer"
                  />
                </span>

                {ratingResult && (
                  <span
                    className={`flashcard-feedback ${
                      showAnswer ? "is-back" : ""
                    }`}
                  >
                    {ratingResult === "richtig"
                      ? "🎉 Richtig!"
                      : ratingResult === "teilweise"
                        ? "🤔 Teilweise"
                        : "❌ Falsch"}
                  </span>
                )}

                {ratingResult === "richtig" && (
                  <span
                    className={`flashcard-confetti ${
                      showAnswer ? "is-back" : ""
                    }`}
                    aria-hidden="true"
                  >
                    {Array.from({ length: 12 }, (_, index) => (
                      <i key={index} />
                    ))}
                  </span>
                )}
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                onClick={() => onRate("richtig")}
                disabled={Boolean(ratingResult)}
                variant="outline"
                className="rounded-2xl border-emerald-200 text-emerald-700"
              >
                Richtig
              </Button>

              <Button
                onClick={() => onRate("teilweise")}
                disabled={Boolean(ratingResult)}
                variant="outline"
                className="rounded-2xl border-amber-200 text-amber-700"
              >
                Teilweise
              </Button>

              <Button
                onClick={() => onRate("falsch")}
                disabled={Boolean(ratingResult)}
                variant="outline"
                className="rounded-2xl border-rose-200 text-rose-700"
              >
                Falsch
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed bg-white p-10 text-center text-slate-500">
            Noch keine Karte aktiv. Lege eine Karte an oder importiere
            eine CSV.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
