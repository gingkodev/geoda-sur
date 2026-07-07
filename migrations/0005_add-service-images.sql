-- Per-service image gallery (uploaded via CMS, shown on /servicios/<slug>)

CREATE TABLE service_images (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id     INT UNSIGNED NOT NULL,
    img_url        VARCHAR(512) NOT NULL,
    mobile_img_url VARCHAR(512) NULL,
    caption        VARCHAR(255) NULL,
    sort_order     INT NOT NULL DEFAULT 0,
    date_created   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_si_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
