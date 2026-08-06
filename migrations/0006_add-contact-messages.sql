-- Contact form messages.
--
-- This table has been in db_build.sql since the first commit, but db_build.sql
-- only ever runs as a docker-entrypoint-initdb.d script on FIRST volume init.
-- Any database created before that line existed — the dev volume, and any prod
-- DB restored from a dev dump — never got the table, so POST /api/contact
-- fails with ER_NO_SUCH_TABLE and returns 500 on every submission.
--
-- IF NOT EXISTS keeps this a no-op on databases that were built fresh from
-- db_build.sql and already have it. Definition is kept byte-identical to the
-- one in db_build.sql so the two sources of truth cannot drift.
CREATE TABLE IF NOT EXISTS contact_messages (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(255)    NOT NULL,
    email        VARCHAR(255)    NOT NULL,
    message      TEXT            NOT NULL,
    date_created TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
