import { useEffect, useState } from "react";
import { X, Copy, Trash2 } from "lucide-react";
import { Button } from "./Button.jsx";
import { listMembers } from "../data/supabaseBackend.js";
import { createInvite } from "../data/invites.js";

const SECTIONS = ["Allgemein", "Themen", "Zusammenarbeit", "Gefahrenzone"];

export function DeckSettingsModal({ deck, deckTags, isCloud, canManage, onClose, onRename, onDelete }) {
  const [section, setSection] = useState("Allgemein");
  const [name, setName] = useState(deck.name);
  const [members, setMembers] = useState([]);
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviteExpiresHours, setInviteExpiresHours] = useState(72);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);

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
            </>
          )}

          {section === "Themen" && (
            <>
              {deckTags.length ? (
                <ul className="deck-settings-tag-list">
                  {deckTags.map((tag) => (
                    <li key={tag} className="tag-chip">
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Noch keine Themen — lege welche direkt an einer Karte an.</p>
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

          {section === "Gefahrenzone" && (
            <>
              <p>Das Deck und alle enthaltenen Karten werden unwiderruflich gelöscht.</p>
              <Button
                onClick={() => onDelete()}
                disabled={!canManage}
                className="rounded-xl deck-delete-confirm"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Deck löschen
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
