-- Migration: add _en columns for ES/EN language support
-- Run against existing cardinal database

ALTER TABLE projects
  ADD COLUMN name_en VARCHAR(255) NULL AFTER name,
  ADD COLUMN writeup_en TEXT NULL AFTER writeup;

ALTER TABLE services
  ADD COLUMN name_en VARCHAR(255) NULL AFTER name,
  ADD COLUMN description_en TEXT NULL AFTER description;

ALTER TABLE blog
  ADD COLUMN title_en VARCHAR(255) NULL AFTER title,
  ADD COLUMN writeup_en TEXT NULL AFTER writeup;
