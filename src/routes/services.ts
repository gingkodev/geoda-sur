import { Router } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { getLang, resolveRows, resolveRow, cacheHeaders } from "../lang.js";
import { slugify } from "../slugify.js";

const router = Router();

const I18N_FIELDS = ["name", "description"];

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

// GET /api/services/:id
router.get("/:id", async (req, res) => {
  try {
    const lang = getLang(req);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM services WHERE id = ? AND is_deleted = 0`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });

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
    const { name, name_en, description, description_en } = req.body;
    const slug = slugify(name);
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO services (name, name_en, slug, description, description_en) VALUES (?, ?, ?, ?, ?)`,
      [name, name_en ?? null, slug, description, description_en ?? null]
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
    const { name, name_en, description, description_en } = req.body;
    const slug = slugify(name);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE services SET name = ?, name_en = ?, slug = ?, description = ?, description_en = ? WHERE id = ? AND is_deleted = 0`,
      [name, name_en ?? null, slug, description, description_en ?? null, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Not found" });
    res.json({ updated: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update service" });
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
