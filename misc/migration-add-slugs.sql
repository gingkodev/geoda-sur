-- Migration: add slug column to projects, services, blog
-- Run against existing cardinal database

ALTER TABLE projects
  ADD COLUMN slug VARCHAR(255) NULL AFTER name_en,
  ADD UNIQUE KEY uq_project_slug (slug);

ALTER TABLE services
  ADD COLUMN slug VARCHAR(255) NULL AFTER name_en,
  ADD UNIQUE KEY uq_service_slug (slug);

ALTER TABLE blog
  ADD COLUMN slug VARCHAR(255) NULL AFTER title_en,
  ADD UNIQUE KEY uq_blog_slug (slug);

-- Backfill existing rows: lowercase name/title, replace non-alphanumeric with hyphens, trim
UPDATE projects SET slug = TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-'), '-+', '-'))) WHERE slug IS NULL;
UPDATE services SET slug = TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-'), '-+', '-'))) WHERE slug IS NULL;
UPDATE blog SET slug = TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-'), '-+', '-'))) WHERE slug IS NULL;
