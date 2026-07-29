-- Tags can be given a color (see src/lib/tagColors.js for the fixed
-- palette the UI offers). Nullable: a tag with no color falls back to the
-- default badge styling.
alter table tags add column if not exists color text;
