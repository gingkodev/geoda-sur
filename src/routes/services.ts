import { Router } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { getLang, resolveRows, resolveRow, cacheHeaders } from "../lang.js";
import { slugify } from "../slugify.js";

const router = Router();

const I18N_FIELDS = ["name", "description"];

async function fetchServiceImages(serviceId: number | string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, img_url, mobile_img_url, caption, sort_order
     FROM service_images WHERE service_id = ? ORDER BY sort_order, id`,
    [serviceId]
  );
  return rows;
}

// GET /api/services
router.get("/", async (req, res) => {
  try {
    const lang = getLang(req);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM services WHERE is_deleted = 0 ORDER BY date_created DESC`
    );

    resolveRows(rows, lang, I18N_FIELDS);

    const headers = cacheHeaders(lang);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

// GET /api/services/by-slug/:slug — service joined with its linked projects
router.get("/by-slug/:slug", async (req, res) => {
  try {
    const lang = getLang(req);

    const [services] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM services WHERE is_deleted = 0`
    );
    const service = services.find((s) => slugify(s.name) === req.params.slug);
    if (!service) return res.status(404).json({ error: "Not found" });

    const [projects] = await pool.query<RowDataPacket[]>(
      `SELECT p.* FROM projects p
       INNER JOIN projects_services ps ON ps.project_id = p.id
       WHERE ps.service_id = ? AND p.is_deleted = 0
       ORDER BY p.date_created DESC`,
      [service.id]
    );

    service.images = await fetchServiceImages(service.id);

    resolveRow(service, lang, I18N_FIELDS);
    resolveRows(projects, lang, ["name", "writeup"]);

    const headers = cacheHeaders(lang);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);

    res.json({ service, projects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch service" });
  }
});

// GET /api/services/:id
router.get("/:id", async (req, res) => {
  try {
    const lang = getLang(req);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM services WHERE id = ? AND is_deleted = 0`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    rows[0].images = await fetchServiceImages(rows[0].id);

    resolveRow(rows[0], lang, I18N_FIELDS);

    const headers = cacheHeaders(lang);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch service" });
  }
});

// POST /api/services
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, name_en, description, description_en, link_url } = req.body;
    const slug = slugify(name);
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO services (name, name_en, slug, description, description_en, link_url) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, name_en ?? null, slug, description, description_en ?? null, link_url ?? null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create service" });
  }
});

// PUT /api/services/:id
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { name, name_en, description, description_en, link_url } = req.body;
    const slug = slugify(name);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE services SET name = ?, name_en = ?, slug = ?, description = ?, description_en = ?, link_url = ? WHERE id = ? AND is_deleted = 0`,
      [name, name_en ?? null, slug, description, description_en ?? null, link_url ?? null, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Not found" });
    res.json({ updated: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update service" });
  }
});

// POST /api/services/:id/images
router.post("/:id/images", requireAuth, async (req, res) => {
  try {
    const { img_url, mobile_img_url, caption, sort_order } = req.body;
    if (!img_url) return res.status(400).json({ error: "img_url is required" });

    const [services] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM services WHERE id = ? AND is_deleted = 0`,
      [req.params.id]
    );
    if (!services.length) return res.status(404).json({ error: "Not found" });

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO service_images (service_id, img_url, mobile_img_url, caption, sort_order) VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, img_url, mobile_img_url ?? null, caption ?? null, sort_order ?? 0]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add image" });
  }
});

// DELETE /api/services/:id/images/:imageId
router.delete("/:id/images/:imageId", requireAuth, async (req, res) => {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM service_images WHERE id = ? AND service_id = ?`,
      [req.params.imageId, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Not found" });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

// DELETE /api/services/:id — soft delete
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE services SET is_deleted = 1 WHERE id = ? AND is_deleted = 0`,
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Not found" });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete service" });
  }
});

export default router;
