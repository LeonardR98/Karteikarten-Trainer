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

  const { deckId, role, expiresInHours } = req.body || {};

  if (!deckId || !["editor", "viewer"].includes(role)) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("deck_members")
    .select("role")
    .eq("deck_id", deckId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    res.status(500).json({ error: "lookup_failed" });
    return;
  }

  if (membership?.role !== "owner") {
    res.status(403).json({ error: "not_owner" });
    return;
  }

  const hours = Number(expiresInHours) > 0 ? Number(expiresInHours) : 72;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  const { data: invite, error: insertError } = await supabaseAdmin
    .from("deck_invites")
    .insert({ deck_id: deckId, role, created_by: user.id, expires_at: expiresAt })
    .select()
    .single();

  if (insertError) {
    res.status(500).json({ error: "create_failed" });
    return;
  }

  const origin = req.headers.origin || `https://${req.headers.host}`;

  res.status(200).json({
    inviteId: invite.id,
    url: `${origin}/invite/${invite.id}`,
    expiresAt: invite.expires_at,
  });
}
