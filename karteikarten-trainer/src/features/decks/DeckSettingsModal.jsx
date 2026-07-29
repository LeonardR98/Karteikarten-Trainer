import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Merge, Pencil, RotateCcw, Search, Trash2, X } from "lucide-react";
import { Button } from "../../components/Button.jsx";
import { TagBadgeList } from "../../components/TagBadgeList.jsx";
import { listMembers } from "../../data/supabaseBackend.js";
import { createInvite } from "../../data/invites.js";
import { cardTextToPlainText } from "../../lib/storage.js";

const SECTIONS = ["Allgemein", "Themen", "Zusammenarbeit"];
const NO_TOPIC_LABEL = "Ohne Thema";

// Module-level cache so re-opening the same deck's settings (or switching
// tabs back and forth) doesn't re-fetch members that are already known.
const membersCache = new Map();

export function DeckSettingsModal({
  deck,
  cards,
  otherDecks,
  isCloud,
  canManage,
  onClose,
  onRename,
  onDelete,
  onEditCard,
  onDeleteCard,
  onMergeInto,
  onResetProgress,
  onClearAllCards,
}) {
  const [section, setSection] = useState("Allgemein");
  const [name, setName] = useState(deck.name);
  const [isResettingProgress, setIsResettingProgress] = useState(false);
  const [isClearingCards, setIsClearingCards] = useState(false);
  const [members, setMembers] = useState(null);
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviteExpiresHours, setInviteExpiresHours] = useState(72);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const isLoadingMembers = members === null;
  const [justCopied, setJustCopied] = useState(false);
  const copyTimeoutRef = useRef(null);
  const [mergeTargetId, setMergeTargetId] = useState(otherDecks?.[0]?.id || "");
  const [isMerging, setIsMerging] = useState(false);
  const [topicSearch, setTopicSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");

  const allTopics = useMemo(() => {
    const names = new Set();
    for (const card of cards || []) {
      if (card.tags?.length) card.tags.forEach((tag) => names.add(tag));
      else names.add(NO_TOPIC_LABEL);
    }
    return Array.from(names).sort((a, b) => {
      if (a === NO_TOPIC_LABEL) return 1;
      if (b === NO_TOPIC_LABEL) return -1;
      return a.localeCompare(b);
    });
  }, [cards]);

  const groupedByTopic = useMemo(() => {
    const term = topicSearch.trim().toLowerCase();
    const groups = new Map();

    for (const card of cards || []) {
      const matchesSearch =
        !term ||
        cardTextToPlainText(card.question).toLowerCase().includes(term) ||
        cardTextToPlainText(card.answer).toLowerCase().includes(term);

      if (!matchesSearch) continue;

      const topics = card.tags?.length ? card.tags : [NO_TOPIC_LABEL];
      for (const topic of topics) {
        if (topicFilter !== "all" && topic !== topicFilter) continue;
        if (!groups.has(topic)) groups.set(topic, []);
        groups.get(topic).push(card);
      }
    }

    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === NO_TOPIC_LABEL) return 1;
      if (b === NO_TOPIC_LABEL) return -1;
      return a.localeCompare(b);
    });
  }, [cards, topicSearch, topicFilter]);

  const mergeTargetDeck = otherDecks?.find((otherDeck) => otherDeck.id === mergeTargetId);

  async function handleMerge() {
    if (!mergeTargetId || !mergeTargetDeck) return;

    const confirmed = window.confirm(
      `„${deck.name}“ wirklich in „${mergeTargetDeck.name}“ integrieren? Alle Karten werden verschoben und „${deck.name}“ wird anschließend gelöscht.`
    );
    if (!confirmed) return;

    setIsMerging(true);
    try {
      await onMergeInto(mergeTargetId);
    } finally {
      setIsMerging(false);
    }
  }

  async function handleResetProgress() {
    setIsResettingProgress(true);
    try {
      await onResetProgress();
    } finally {
      setIsResettingProgress(false);
    }
  }

  async function handleClearAllCards() {
    const confirmed = window.confirm(
      `Wirklich alle Karten in „${deck.name}“ unwiderruflich löschen?`
    );
    if (!confirmed) return;

    setIsClearingCards(true);
    try {
      await onClearAllCards();
    } finally {
      setIsClearingCards(false);
    }
  }

  // Fetch members as soon as the modal opens (not gated on the
  // "Zusammenarbeit" tab being active) so the data is usually already there
  // by the time the user clicks that tab, and cache per deck so reopening
  // the modal or switching tabs back and forth doesn't refetch.
  useEffect(() => {
    if (!isCloud) return;

    let cancelled = false;
    const cached = membersCache.get(deck.id);

    Promise.resolve(cached || listMembers(deck.id))
      .then((result) => {
        if (cancelled) return;
        membersCache.set(deck.id, result);
        setMembers(result);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isCloud, deck.id]);

  useEffect(() => {
    return () => window.clearTimeout(copyTimeoutRef.current);
  }, []);

  async function handleCreateInvite() {
    setIsCreatingInvite(true);
    setInviteError("");
    setInviteUrl("");
    setJustCopied(false);

    try {
      const result = await createInvite(deck.id, inviteRole, Number(inviteExpiresHours));
      setInviteUrl(result.url);
    } catch (error) {
      setInviteError(error.message);
    } finally {
      setIsCreatingInvite(false);
    }
  }

  function handleCopyInvite() {
    navigator.clipboard?.writeText(inviteUrl);
    setJustCopied(true);
    window.clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = window.setTimeout(() => setJustCopied(false), 1500);
  }

  return (
      <section className="deck-settings-modal" role="dialog" aria-modal="true" aria-labelledby="deck-settings-title">
        <div className="flex items-center justify-between">
          <h2 id="deck-settings-title">Deck-Einstellungen</h2>
          <button type="button" onClick={onClose} className="deck-icon-button" aria-label="Schließen">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="deck-settings-tabs">
          {SECTIONS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`deck-settings-tab ${section === tab ? "is-active" : ""}`}
              onClick={() => setSection(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="deck-settings-body" key={section}>
          {section === "Allgemein" && (
            <>
              <div className="deck-settings-card">
                <label>
                  Deckname
                  <input value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <div className="import-dialog-actions">
                  <Button
                    onClick={() => onRename(name)}
                    className="rounded-xl"
                    disabled={!canManage}
                  >
                    Speichern
                  </Button>
                </div>
              </div>

              {otherDecks?.length > 0 && (
                <div className="deck-settings-card">
                  <h3 className="deck-settings-card-title">In anderes Deck integrieren</h3>
                  <p className="deck-settings-card-hint">
                    Alle {cards?.length || 0} Karten aus „{deck.name}“ werden in das Zieldeck verschoben.
                    Anschließend wird „{deck.name}“ gelöscht.
                  </p>
                  <label>
                    Zieldeck
                    <select
                      value={mergeTargetId}
                      onChange={(event) => setMergeTargetId(event.target.value)}
                    >
                      {otherDecks.map((otherDeck) => (
                        <option key={otherDeck.id} value={otherDeck.id}>
                          {otherDeck.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="import-dialog-actions">
                    <Button
                      onClick={handleMerge}
                      disabled={!canManage || isMerging || !mergeTargetId}
                      variant="outline"
                      className="rounded-xl"
                    >
                      <Merge className="mr-2 h-4 w-4" />
                      {isMerging ? "Integriere…" : "Deck integrieren"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="deck-settings-card">
                <h3 className="deck-settings-card-title">Fortschritt & Karten verwalten</h3>
                <p className="deck-settings-card-hint">
                  Setzt die Lernstufen aller Karten in diesem Deck zurück, ohne die Karten selbst zu löschen.
                </p>
                <div className="import-dialog-actions">
                  <Button
                    onClick={handleResetProgress}
                    disabled={!canManage || isResettingProgress || !cards?.length}
                    variant="outline"
                    className="rounded-xl"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {isResettingProgress ? "Setze zurück…" : "Fortschritt zurücksetzen"}
                  </Button>
                </div>
              </div>

              <div className="deck-settings-danger-zone">
                <h3>Alle Karten löschen</h3>
                <p>Alle Karten in diesem Deck werden unwiderruflich gelöscht, das Deck selbst bleibt bestehen.</p>
                <Button
                  onClick={handleClearAllCards}
                  disabled={!canManage || isClearingCards || !cards?.length}
                  className="rounded-xl deck-delete-confirm"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isClearingCards ? "Lösche…" : "Alle Karten löschen"}
                </Button>
              </div>

              <div className="deck-settings-danger-zone">
                <h3>Deck löschen</h3>
                <p>Das Deck und alle enthaltenen Karten werden unwiderruflich gelöscht.</p>
                <Button
                  onClick={() => onDelete()}
                  disabled={!canManage}
                  className="rounded-xl deck-delete-confirm"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Deck löschen
                </Button>
              </div>
            </>
          )}

          {section === "Themen" && (
            <>
              {cards?.length ? (
                <>
                  <div className="deck-settings-topic-toolbar">
                    <div className="deck-settings-search">
                      <Search className="h-4 w-4" />
                      <input
                        className="deck-settings-search-input"
                        value={topicSearch}
                        onChange={(event) => setTopicSearch(event.target.value)}
                        placeholder="Karten durchsuchen…"
                      />
                    </div>
                    <select
                      value={topicFilter}
                      onChange={(event) => setTopicFilter(event.target.value)}
                      className="deck-settings-topic-select"
                    >
                      <option value="all">Alle Themen</option>
                      {allTopics.map((topic) => (
                        <option key={topic} value={topic}>
                          {topic}
                        </option>
                      ))}
                    </select>
                  </div>

                  {groupedByTopic.length ? (
                    <div className="deck-settings-topics-scroll">
                      {groupedByTopic.map(([topic, topicCards]) => (
                        <div key={topic} className="deck-settings-topic-group">
                          <h3 className="deck-settings-topic-title">
                            {topic} <span className="deck-settings-topic-count">({topicCards.length})</span>
                          </h3>

                          <div className="deck-settings-topic-cards">
                            {topicCards.map((card) => (
                              <div key={card.id} className="deck-settings-topic-card">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate font-semibold">
                                      {cardTextToPlainText(card.question)}
                                    </div>
                                    <div className="mt-1 truncate text-sm">
                                      {cardTextToPlainText(card.answer)}
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <button
                                      type="button"
                                      onClick={() => onEditCard(card)}
                                      className="deck-settings-topic-card-action"
                                      aria-label="Karte bearbeiten"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onDeleteCard(card.id)}
                                      className="deck-settings-topic-card-action is-danger"
                                      aria-label="Karte löschen"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>

                                <TagBadgeList tags={card.tags} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Keine Karten gefunden.</p>
                  )}
                </>
              ) : (
                <p>Noch keine Karten in diesem Deck.</p>
              )}
            </>
          )}

          {section === "Zusammenarbeit" && (
            <>
              {!isCloud ? (
                <div className="deck-settings-card">
                  <p className="deck-settings-card-hint">
                    Zusammenarbeit steht erst zur Verfügung, sobald du angemeldet bist.
                  </p>
                </div>
              ) : (
                <>
                  <div className="deck-settings-card">
                    <h3 className="deck-settings-card-title">Mitglieder</h3>

                    {isLoadingMembers ? (
                      <p className="deck-settings-card-hint">Lade Mitglieder…</p>
                    ) : members.length ? (
                      <ul className="deck-settings-member-list">
                        {members.map((member) => {
                          const label = member.displayName || member.email;
                          return (
                            <li key={member.userId}>
                              <span className="deck-settings-member-identity">
                                <span className="deck-settings-member-avatar">
                                  {(label || "?").charAt(0).toUpperCase()}
                                </span>
                                <span>{label}</span>
                              </span>
                              <span className="deck-settings-role-badge">{member.role}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="deck-settings-card-hint">Noch keine weiteren Mitglieder.</p>
                    )}
                  </div>

                  {canManage ? (
                    <div className="deck-settings-card">
                      <h3 className="deck-settings-card-title">Einladungslink erstellen</h3>
                      <div className="deck-settings-invite-form">
                        <label>
                          Rolle
                          <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </label>
                        <label>
                          Gültig für (Stunden)
                          <input
                            type="number"
                            min="1"
                            value={inviteExpiresHours}
                            onChange={(event) => setInviteExpiresHours(event.target.value)}
                          />
                        </label>
                      </div>

                      <div className="import-dialog-actions">
                        <Button
                          onClick={handleCreateInvite}
                          disabled={isCreatingInvite}
                          className="rounded-xl"
                        >
                          {isCreatingInvite ? "Erstelle…" : "Link erstellen"}
                        </Button>
                      </div>

                      {inviteError && <p className="text-sm text-rose-700">{inviteError}</p>}

                      {inviteUrl && (
                        <div className="deck-settings-invite-url">
                          <input readOnly value={inviteUrl} onFocus={(event) => event.target.select()} />
                          <button
                            type="button"
                            onClick={handleCopyInvite}
                            className={`deck-settings-copy-button ${justCopied ? "is-copied" : ""}`}
                            aria-label="Link kopieren"
                          >
                            {justCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="deck-settings-card">
                      <p className="deck-settings-card-hint">Nur der Besitzer kann Einladungen erstellen.</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>
  );
}
