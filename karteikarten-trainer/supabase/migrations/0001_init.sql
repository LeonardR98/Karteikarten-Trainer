-- Karteikarten Trainer: shared decks, cards, tags, membership, invites.
-- Run once via `supabase db push` (or the SQL Editor). Idempotent-ish via
-- IF NOT EXISTS / OR REPLACE where practical; re-running after a partial
-- failure should be safe for most statements but is not guaranteed.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists deck_members (
  deck_id uuid not null references decks (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (deck_id, user_id)
);

create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks (id) on delete cascade,
  question text not null,
  answer text not null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (deck_id, name)
);

create table if not exists card_tags (
  card_id uuid not null references cards (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (card_id, tag_id)
);

create table if not exists user_card_progress (
  card_id uuid not null references cards (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  level text not null default 'falsch',
  correct_streak integer not null default 0,
  total_answered integer not null default 0,
  partial_count integer not null default 0,
  wrong_count integer not null default 0,
  last_result text,
  last_answered_at timestamptz,
  primary key (card_id, user_id)
);

create table if not exists deck_invites (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks (id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  created_by uuid references profiles (id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists deck_invite_uses (
  invite_id uuid not null references deck_invites (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  used_at timestamptz not null default now(),
  primary key (invite_id, user_id)
);

-- ---------------------------------------------------------------------
-- Helper: role-checking function used by RLS policies below. security
-- definer + fixed search_path so it can read deck_members regardless of
-- the caller's own RLS visibility, without recursive policy evaluation.
-- ---------------------------------------------------------------------

create or replace function is_deck_member(p_deck_id uuid, p_min_role text default 'viewer')
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from deck_members dm
    where dm.deck_id = p_deck_id
      and dm.user_id = auth.uid()
      and (
        p_min_role = 'viewer'
        or (p_min_role = 'editor' and dm.role in ('editor', 'owner'))
        or (p_min_role = 'owner' and dm.role = 'owner')
      )
  );
$$;

-- ---------------------------------------------------------------------
-- Triggers: auto-create a profile on signup, auto-add deck owner as a
-- member, keep updated_at current.
-- ---------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function handle_new_deck()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into deck_members (deck_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (deck_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_deck_created on decks;
create trigger on_deck_created
  after insert on decks
  for each row execute function handle_new_deck();

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_decks_updated_at on decks;
create trigger set_decks_updated_at
  before update on decks
  for each row execute function set_updated_at();

drop trigger if exists set_cards_updated_at on cards;
create trigger set_cards_updated_at
  before update on cards
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table profiles enable row level security;
alter table decks enable row level security;
alter table deck_members enable row level security;
alter table cards enable row level security;
alter table tags enable row level security;
alter table card_tags enable row level security;
alter table user_card_progress enable row level security;
-- deck_invites / deck_invite_uses: RLS enabled, no policies defined below.
-- All access to them goes through the Vercel functions using the service
-- role key, which bypasses RLS entirely — this intentionally leaves them
-- unreadable/unwritable via the anon/authenticated client roles.
alter table deck_invites enable row level security;
alter table deck_invite_uses enable row level security;

-- profiles: users manage only their own row.
create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

-- decks: any member can read; only the owner can rename/delete; any
-- authenticated user can create a deck (they become owner via trigger).
create policy "decks_select_member" on decks
  for select using (is_deck_member(id, 'viewer') or owner_id = auth.uid());
create policy "decks_insert_self" on decks
  for insert with check (owner_id = auth.uid());
create policy "decks_update_owner" on decks
  for update using (is_deck_member(id, 'owner'));
create policy "decks_delete_owner" on decks
  for delete using (is_deck_member(id, 'owner'));

-- deck_members: members can see the roster; only the owner manages it.
create policy "deck_members_select" on deck_members
  for select using (user_id = auth.uid() or is_deck_member(deck_id, 'owner'));
create policy "deck_members_insert_owner" on deck_members
  for insert with check (is_deck_member(deck_id, 'owner'));
create policy "deck_members_update_owner" on deck_members
  for update using (is_deck_member(deck_id, 'owner'));
create policy "deck_members_delete_owner" on deck_members
  for delete using (is_deck_member(deck_id, 'owner'));

-- cards: any member can read; owner/editor can write.
create policy "cards_select_member" on cards
  for select using (is_deck_member(deck_id, 'viewer'));
create policy "cards_insert_editor" on cards
  for insert with check (is_deck_member(deck_id, 'editor'));
create policy "cards_update_editor" on cards
  for update using (is_deck_member(deck_id, 'editor'));
create policy "cards_delete_editor" on cards
  for delete using (is_deck_member(deck_id, 'editor'));

-- tags: same pattern as cards.
create policy "tags_select_member" on tags
  for select using (is_deck_member(deck_id, 'viewer'));
create policy "tags_insert_editor" on tags
  for insert with check (is_deck_member(deck_id, 'editor'));
create policy "tags_update_editor" on tags
  for update using (is_deck_member(deck_id, 'editor'));
create policy "tags_delete_editor" on tags
  for delete using (is_deck_member(deck_id, 'editor'));

-- card_tags: joins through cards.deck_id for the membership check.
create policy "card_tags_select_member" on card_tags
  for select using (
    exists (
      select 1 from cards c
      where c.id = card_tags.card_id and is_deck_member(c.deck_id, 'viewer')
    )
  );
create policy "card_tags_insert_editor" on card_tags
  for insert with check (
    exists (
      select 1 from cards c
      where c.id = card_tags.card_id and is_deck_member(c.deck_id, 'editor')
    )
  );
create policy "card_tags_delete_editor" on card_tags
  for delete using (
    exists (
      select 1 from cards c
      where c.id = card_tags.card_id and is_deck_member(c.deck_id, 'editor')
    )
  );

-- user_card_progress: strictly private per user, but only while they are
-- still (at least) a viewer on the card's deck — this is what lets
-- viewers study without granting them write access to cards/tags.
create policy "progress_select_own" on user_card_progress
  for select using (
    user_id = auth.uid()
    and exists (
      select 1 from cards c
      where c.id = user_card_progress.card_id and is_deck_member(c.deck_id, 'viewer')
    )
  );
create policy "progress_insert_own" on user_card_progress
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from cards c
      where c.id = user_card_progress.card_id and is_deck_member(c.deck_id, 'viewer')
    )
  );
create policy "progress_update_own" on user_card_progress
  for update using (
    user_id = auth.uid()
    and exists (
      select 1 from cards c
      where c.id = user_card_progress.card_id and is_deck_member(c.deck_id, 'viewer')
    )
  );

-- ---------------------------------------------------------------------
-- Realtime: broadcast row changes on the tables the client subscribes to.
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table cards;
alter publication supabase_realtime add table tags;
alter publication supabase_realtime add table card_tags;
