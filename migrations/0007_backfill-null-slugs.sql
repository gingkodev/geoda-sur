-- Backfill rows whose slug was never set.
--
-- Migration 0002 added the slug column and backfilled what existed at the time,
-- but rows created afterwards by `npm run seed` were inserted without one. The
-- UNIQUE index permits multiple NULLs, so they accumulated silently until
-- feed.ts emitted `/blog#null` for every one of them (routes/feed.ts:69 uses the
-- stored slug for blog and project links).
--
-- Deliberately NOT touching rows that already have a slug: 0002 built those
-- with an ASCII-only regex that maps accented letters to '-' where slugify()
-- folds them to the base letter, so a repair would rewrite live URLs. That
-- divergence is left alone on purpose.
--
-- REGEXP_REPLACE mirrors 0002 so newly-filled slugs match the existing style.
-- The id suffix guarantees uniqueness even when two rows share a title or a
-- title has no ASCII alphanumerics at all (which would otherwise yield '').

UPDATE projects
SET slug = CONCAT(
    NULLIF(TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-'), '-+', '-'))), ''),
    '-', id
)
WHERE slug IS NULL;

UPDATE projects SET slug = CONCAT('item-', id) WHERE slug IS NULL;

UPDATE services
SET slug = CONCAT(
    NULLIF(TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-'), '-+', '-'))), ''),
    '-', id
)
WHERE slug IS NULL;

UPDATE services SET slug = CONCAT('item-', id) WHERE slug IS NULL;

UPDATE blog
SET slug = CONCAT(
    NULLIF(TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-'), '-+', '-'))), ''),
    '-', id
)
WHERE slug IS NULL;

UPDATE blog SET slug = CONCAT('item-', id) WHERE slug IS NULL
