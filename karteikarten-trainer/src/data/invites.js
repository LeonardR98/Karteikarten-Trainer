import { supabase } from "../lib/supabaseClient.js";

async function authorizedFetch(path, body) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(json.error || `Anfrage fehlgeschlagen (${response.status})`);
  }

  return json;
}

export function createInvite(deckId, role, expiresInHours) {
  return authorizedFetch("/api/decks/create-invite", { deckId, role, expiresInHours });
}

export function acceptInvite(inviteId) {
  return authorizedFetch("/api/decks/accept-invite", { inviteId });
}
