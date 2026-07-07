-- Formación page: singleton editable intro + uploadable image grid

CREATE TABLE formacion_page (
    id           TINYINT UNSIGNED PRIMARY KEY,
    intro        TEXT NOT NULL,
    intro_en     TEXT NULL,
    date_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO formacion_page (id, intro, intro_en) VALUES (
    1,
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    NULL
);

CREATE TABLE formacion_images (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    img_url        VARCHAR(512) NOT NULL,
    mobile_img_url VARCHAR(512) NULL,
    sort_order     INT NOT NULL DEFAULT 0,
    date_created   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
