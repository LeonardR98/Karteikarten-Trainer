import { getSupabaseAdmin, getUserFromRequest } from "../_supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const user = await getUserFromRequest(req, supabaseAdmin);

  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const { inviteId } = req.body || {};
  if (!inviteId) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("deck_invites")
    .select("id, deck_id, role, expires_at")
    .eq("id", inviteId)
    .maybeSingle();

  if (inviteError) {
    res.status(500).json({ error: "lookup_failed" });
    return;
  }

  if (!invite) {
    res.status(404).json({ error: "invalid" });
    return;
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    res.status(410).json({ error: "expired" });
    return;
  }

  const { error: memberError } = await supabaseAdmin
    .from("deck_members")
    .upsert(
      { deck_id: invite.deck_id, user_id: user.id, role: invite.role },
      { onConflict: "deck_id,user_id", ignoreDuplicates: true }
    );

  if (memberError) {
    res.status(500).json({ error: "join_failed" });
    return;
  }

  await supabaseAdmin
    .from("deck_invite_uses")
    .insert({ invite_id: invite.id, user_id: user.id })
    .then(
      () => {},
      () => {}
    );

  res.status(200).json({ deckId: invite.deck_id, role: invite.role });
}
