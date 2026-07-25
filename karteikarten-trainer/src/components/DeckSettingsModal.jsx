import { useEffect, useMemo, useState } from "react";
import { X, Copy, Merge, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "./Button.jsx";
import { TagBadgeList } from "./TagBadgeList.jsx";
import { listMembers } from "../data/supabaseBackend.js";
import { createInvite } from "../data/invites.js";
import { cardTextToPlainText } from "../lib/storage.js";

const SECTIONS = ["Allgemein", "Themen", "Zusammenarbeit"];
const NO_TOPIC_LABEL = "Ohne Thema";

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
}) {
  const [section, setSection] = useState("Allgemein");
  const [name, setName] = useState(deck.name);
  const [members, setMembers] = useState([]);
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviteExpiresHours, setInviteExpiresHours] = useState(72);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
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

  async function handleMerge() {
    if (!mergeTargetId) return;
    setIsMerging(true);
    try {
      await onMergeInto(mergeTargetId);
    } finally {
      setIsMerging(false);
    }
  }

  useEffect(() => {
    if (section !== "Zusammenarbeit" || !isCloud) return;
    listMembers(deck.id)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [section, isCloud, deck.id]);

  async function handleCreateInvite() {
    setIsCreatingInvite(true);
    setInviteError("");
    setInviteUrl("");

    try {
      const result = await createInvite(deck.id, inviteRole, Number(inviteExpiresHours));
      setInviteUrl(result.url);
    } catch (error) {
      setInviteError(error.message);
    } finally {
      setIsCreatingInvite(false);
    }
  }

  return (
    <div className="import-dialog-backdrop" role="presentation">
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

        <div className="deck-settings-body">
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
                    Alle Karten werden in das Zieldeck verschoben, anschließend wird „{deck.name}“ gelöscht.
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
                <p>Zusammenarbeit steht erst zur Verfügung, sobald du angemeldet bist.</p>
              ) : (
                <>
                  <h3>Mitglieder</h3>
                  <ul className="deck-settings-member-list">
                    {members.map((member) => (
                      <li key={member.userId}>
                        <span>{member.displayName || member.email}</span>
                        <span className="deck-settings-role-badge">{member.role}</span>
                      </li>
                    ))}
                  </ul>

                  {canManage ? (
                    <>
                      <h3>Einladungslink erstellen</h3>
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
                      <Button
                        onClick={handleCreateInvite}
                        disabled={isCreatingInvite}
                        className="rounded-xl"
                      >
                        {isCreatingInvite ? "Erstelle…" : "Link erstellen"}
                      </Button>

                      {inviteError && <p className="text-sm text-rose-700">{inviteError}</p>}

                      {inviteUrl && (
                        <div className="deck-settings-invite-url">
                          <input readOnly value={inviteUrl} onFocus={(event) => event.target.select()} />
                          <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(inviteUrl)}
                            aria-label="Link kopieren"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p>Nur der Besitzer kann Einladungen erstellen.</p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
