import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { LoginModal } from "./LoginModal.jsx";
import { acceptInvite } from "../data/invites.js";
import { Button } from "../components/Button.jsx";

export function AcceptInviteScreen({ inviteId }) {
  const { status } = useAuth();
  const [state, setState] = useState("idle"); // idle | accepting | done | error
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "authenticated" || state !== "idle") return;

    setState("accepting");
    acceptInvite(inviteId)
      .then(() => setState("done"))
      .catch((err) => {
        setError(err.message);
        setState("error");
      });
  }, [status, state, inviteId]);

  function goToApp() {
    window.location.href = "/";
  }

  return (
    <div className="concept-app min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold mb-4">Deck-Einladung</h1>

        {status !== "authenticated" && (
          <>
            <p className="mb-4">Melde dich an, um die Einladung anzunehmen.</p>
            <LoginModal onClose={() => {}} />
          </>
        )}

        {status === "authenticated" && state === "accepting" && <p>Einladung wird angenommen…</p>}

        {status === "authenticated" && state === "done" && (
          <>
            <p className="mb-4">Einladung angenommen — das Deck ist jetzt in deiner Übersicht.</p>
            <Button onClick={goToApp} className="rounded-xl">
              Zur App
            </Button>
          </>
        )}

        {status === "authenticated" && state === "error" && (
          <>
            <p className="mb-4 text-rose-700">
              Einladung konnte nicht angenommen werden: {error}
            </p>
            <Button onClick={goToApp} variant="outline" className="rounded-xl">
              Zur App
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
