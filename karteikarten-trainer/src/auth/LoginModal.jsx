import { useState } from "react";
import { Mail, X } from "lucide-react";
import { Button } from "../components/Button.jsx";
import { useAuth } from "./AuthContext.jsx";

export function LoginModal({ onClose }) {
  const { signInWithMagicLink, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!email.trim()) return;

    setStatus("sending");
    setError("");

    const { error: signInError } = await signInWithMagicLink(email.trim());

    if (signInError) {
      setStatus("error");
      setError(signInError.message);
      return;
    }

    setStatus("sent");
  }

  async function handleGoogleClick() {
    setError("");
    const { error: signInError } = await signInWithGoogle();
    if (signInError) {
      setStatus("error");
      setError(signInError.message);
    }
    // On success the browser navigates away to Google, so no further state
    // change is needed here.
  }

  return (
    <div className="import-dialog-backdrop" role="presentation">
      <section className="deck-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <div className="flex items-center justify-between">
          <h2 id="login-title">Anmelden</h2>
          <button type="button" onClick={onClose} aria-label="Schließen" className="deck-icon-button">
            <X className="h-4 w-4" />
          </button>
        </div>

        {status === "sent" ? (
          <p>
            Wir haben dir einen Anmeldelink an <strong>{email}</strong> geschickt.
            Öffne ihn, um dich einzuloggen.
          </p>
        ) : (
          <>
            <Button
              type="button"
              onClick={handleGoogleClick}
              variant="outline"
              className="rounded-xl w-full"
            >
              Mit Google anmelden
            </Button>

            {status === "error" && (
              <p className="text-sm text-rose-700">{error}</p>
            )}

            <p className="text-sm text-slate-500">oder per E-Mail-Link:</p>

            <form onSubmit={handleSubmit}>
              <label>
                E-Mail-Adresse
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="du@beispiel.de"
                />
              </label>

              <div className="import-dialog-actions">
                <Button type="button" onClick={onClose} variant="outline" className="rounded-xl">
                  Abbrechen
                </Button>
                <Button type="submit" disabled={status === "sending"} className="rounded-xl">
                  <Mail className="mr-2 h-4 w-4" />
                  {status === "sending" ? "Wird gesendet…" : "Link senden"}
                </Button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
