CREATE DATABASE IF NOT EXISTS cardinal;
USE cardinal;

-- --------------------------------------------------------
-- PROJECTS
-- --------------------------------------------------------
CREATE TABLE projects (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255)    NOT NULL,
    name_en     VARCHAR(255)    NULL,
    writeup     TEXT            NOT NULL,
    writeup_en  TEXT            NULL,
    slug        VARCHAR(255)    NULL,
    img_url     VARCHAR(512)    NOT NULL,
    audio_url   VARCHAR(512)    NULL,
    is_deleted  TINYINT(1)      NOT NULL DEFAULT 0,
    date_created TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_project_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- SERVICES
-- --------------------------------------------------------
CREATE TABLE services (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255)    NOT NULL,
    name_en     VARCHAR(255)    NULL,
    description TEXT            NOT NULL,
    description_en TEXT         NULL,
    slug        VARCHAR(255)    NULL,
    is_deleted  TINYINT(1)      NOT NULL DEFAULT 0,
    date_created TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_service_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- PROJECTS_SERVICES (join table)
-- --------------------------------------------------------
CREATE TABLE projects_services (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id  INT UNSIGNED    NOT NULL,
    service_id  INT UNSIGNED    NOT NULL,
    date_created TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_project_service (project_id, service_id),

    CONSTRAINT fk_ps_project FOREIGN KEY (project_id)
        REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_ps_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- BLOG
-- --------------------------------------------------------
CREATE TABLE blog (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category    VARCHAR(100)    NOT NULL,
    type        VARCHAR(20)     NOT NULL,
    audio_url   VARCHAR(512)    NULL,
    writeup     TEXT            NULL,
    writeup_en  TEXT            NULL,
    title       VARCHAR(255)    NOT NULL,
    title_en    VARCHAR(255)    NULL,
    slug        VARCHAR(255)    NULL,
    is_deleted  TINYINT(1)      NOT NULL DEFAULT 0,
    date_created TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_blog_slug (slug),
    CONSTRAINT chk_blog_type CHECK (type IN ('post', 'audio', 'note'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- USERS
-- --------------------------------------------------------
CREATE TABLE users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(255)    NOT NULL,
    password_hash VARCHAR(255)    NOT NULL,
    name          VARCHAR(255)    NOT NULL,
    is_deleted    TINYINT(1)      NOT NULL DEFAULT 0,
    date_created  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_updated  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- CONTACT MESSAGES
-- --------------------------------------------------------
CREATE TABLE contact_messages (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(255)    NOT NULL,
    email        VARCHAR(255)    NOT NULL,
    message      TEXT            NOT NULL,
    date_created TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
