-- Migration: add link_url column to services
-- A service with link_url set links straight to an external URL (e.g. a PDF)
-- instead of its internal /servicios/{slug} detail page.
-- Run against existing cardinal database.

ALTER TABLE services
  ADD COLUMN link_url VARCHAR(512) NULL AFTER slug;
