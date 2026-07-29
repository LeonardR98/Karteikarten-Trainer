-- Allow reading the basic profile (email, display_name) of other users you
-- share at least one deck with. Without this, `profiles_select_own` (RLS)
-- only lets you see your own profile row, so the deck-members list in
-- Deck-Einstellungen -> Zusammenarbeit can never resolve other members'
-- names/emails and silently falls back to showing their raw user id.
--
-- This is an additional permissive `select` policy on top of the existing
-- `profiles_select_own` policy; Postgres combines multiple permissive
-- policies for the same command with OR, so this only widens access, it
-- does not replace or narrow the existing policy.

create policy "profiles_select_shared_deck_members" on profiles
  for select using (
    exists (
      select 1
      from deck_members dm1
      join deck_members dm2 on dm1.deck_id = dm2.deck_id
      where dm1.user_id = auth.uid()
        and dm2.user_id = profiles.id
    )
  );
