-- Optional images on cards (question/answer). Only the URL is stored in
-- Postgres; the actual image bytes live in the "card-images" Storage
-- bucket — much cheaper than storing base64 in a text column (raw bytes
-- vs. base64's ~33% overhead, and Storage quotas are far larger than
-- database quotas on Supabase's plans), and it isn't re-downloaded as part
-- of every fetchState() row like an inline column would be.
alter table cards add column if not exists image_question_url text;
alter table cards add column if not exists image_answer_url text;

insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do nothing;

-- Public bucket: reading an image just needs the (unguessable, uuid-named)
-- URL, no auth round-trip. Writing/deleting is restricted to signed-in
-- users — matches this app's existing "any authenticated user can manage
-- their own decks' content" posture rather than adding a new per-object
-- ownership model.
create policy "card_images_public_read" on storage.objects
  for select using (bucket_id = 'card-images');

create policy "card_images_authenticated_write" on storage.objects
  for insert with check (bucket_id = 'card-images' and auth.role() = 'authenticated');

create policy "card_images_authenticated_update" on storage.objects
  for update using (bucket_id = 'card-images' and auth.role() = 'authenticated');

create policy "card_images_authenticated_delete" on storage.objects
  for delete using (bucket_id = 'card-images' and auth.role() = 'authenticated');
