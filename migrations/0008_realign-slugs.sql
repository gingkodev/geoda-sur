-- Realign stored slugs with the slugs slugify() produces.
--
-- Migration 0002 backfilled slugs with an ASCII-only regex that maps an accented
-- letter to '-' ("Dirección" -> "direcci-n"), where slugify() folds it to the
-- base letter ("direccion"). 0007 then filled the remaining NULLs in that same
-- old style, appending the row id for uniqueness. 0007 deliberately left the
-- divergence alone to avoid rewriting live URLs.
--
-- That divergence was not cosmetic. routes/services.ts resolved
-- GET /api/services/by-slug/:slug by recomputing slugify(name) and comparing,
-- while every link in the app is built from the STORED slug — so 4 of 5 service
-- detail pages 404'd on links the app itself emitted. That route now queries the
-- slug column, which makes the stored value authoritative and makes this repair
-- the thing that gives the column clean values.
--
-- Safe to run now: the site is not publicly linked yet, so there are no external
-- URLs to break.
--
-- Uniqueness: a clean base can collide — several blog rows share a title (the
-- seed ran twice), and every live service/project has a soft-deleted twin from an
-- earlier seed. Rows are ranked is_deleted first so a LIVE row always wins the
-- bare slug; losers get '-<id>' appended, unique by construction. Ranking by id
-- alone would park the clean URL on a deleted row and push live content to
-- "direccion-musical-creativa-5".
--
-- Each table is rewritten in two passes. Assigning final values directly can
-- transiently violate the UNIQUE index when one row takes a slug another row has
-- not released yet; parking every row on a per-id placeholder first removes any
-- ordering dependency.

UPDATE projects SET slug = CONCAT('__slug_migrating__-', id);

UPDATE projects tgt
JOIN (
  SELECT id, base,
         ROW_NUMBER() OVER (PARTITION BY base ORDER BY is_deleted ASC, id ASC) AS rn
  FROM (SELECT id, is_deleted, COALESCE(NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(name),'á','a'),'à','a'),'â','a'),'ä','a'),'ã','a'),'é','e'),'è','e'),'ê','e'),'ë','e'),'í','i'),'ì','i'),'î','i'),'ï','i'),'ó','o'),'ò','o'),'ô','o'),'ö','o'),'õ','o'),'ú','u'),'ù','u'),'û','u'),'ü','u'),'ñ','n'),'ç','c'),'[^a-z0-9]+','-'),'-+','-')),''),'item') AS base FROM projects) AS computed
) AS ranked ON ranked.id = tgt.id
SET tgt.slug = IF(ranked.rn = 1, ranked.base, CONCAT(ranked.base, '-', tgt.id));

UPDATE services SET slug = CONCAT('__slug_migrating__-', id);

UPDATE services tgt
JOIN (
  SELECT id, base,
         ROW_NUMBER() OVER (PARTITION BY base ORDER BY is_deleted ASC, id ASC) AS rn
  FROM (SELECT id, is_deleted, COALESCE(NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(name),'á','a'),'à','a'),'â','a'),'ä','a'),'ã','a'),'é','e'),'è','e'),'ê','e'),'ë','e'),'í','i'),'ì','i'),'î','i'),'ï','i'),'ó','o'),'ò','o'),'ô','o'),'ö','o'),'õ','o'),'ú','u'),'ù','u'),'û','u'),'ü','u'),'ñ','n'),'ç','c'),'[^a-z0-9]+','-'),'-+','-')),''),'item') AS base FROM services) AS computed
) AS ranked ON ranked.id = tgt.id
SET tgt.slug = IF(ranked.rn = 1, ranked.base, CONCAT(ranked.base, '-', tgt.id));

UPDATE blog SET slug = CONCAT('__slug_migrating__-', id);

UPDATE blog tgt
JOIN (
  SELECT id, base,
         ROW_NUMBER() OVER (PARTITION BY base ORDER BY is_deleted ASC, id ASC) AS rn
  FROM (SELECT id, is_deleted, COALESCE(NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(title),'á','a'),'à','a'),'â','a'),'ä','a'),'ã','a'),'é','e'),'è','e'),'ê','e'),'ë','e'),'í','i'),'ì','i'),'î','i'),'ï','i'),'ó','o'),'ò','o'),'ô','o'),'ö','o'),'õ','o'),'ú','u'),'ù','u'),'û','u'),'ü','u'),'ñ','n'),'ç','c'),'[^a-z0-9]+','-'),'-+','-')),''),'item') AS base FROM blog) AS computed
) AS ranked ON ranked.id = tgt.id
SET tgt.slug = IF(ranked.rn = 1, ranked.base, CONCAT(ranked.base, '-', tgt.id));
