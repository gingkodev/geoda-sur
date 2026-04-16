import { Router } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { getLang, resolveRows, resolveRow, cacheHeaders } from "../lang.js";
import { slugify } from "../slugify.js";

const router = Router();

const I18N_FIELDS = ["title", "writeup"];

// GET /api/blog — supports ?type=post|audio|note filter, pagination via ?offset=&limit=
router.get("/", async (req, res) => {
  try {
    const lang = getLang(req);
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    let where = `WHERE is_deleted = 0`;
    const params: (string | number)[] = [];

    if (req.query.type) {
      where += ` AND type = ?`;
      params.push(req.query.type as string);
    }

    const [[{ total }]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM blog ${where}`,
      params
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM blog ${where} ORDER BY date_created DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    resolveRows(rows, lang, I18N_FIELDS);

    const headers = cacheHeaders(lang);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);

    res.json({ data: rows, total, limit, offset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch blog entries" });
  }
});

// GET /api/blog/:id
router.get("/:id", async (req, res) => {
  try {
    const lang = getLang(req);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM blog WHERE id = ? AND is_deleted = 0`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    resolveRow(rows[0], lang, I18N_FIELDS);

    const headers = cacheHeaders(lang);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch blog entry" });
  }
});

// POST /api/blog
router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, title_en, category, type, writeup, writeup_en, audio_url } = req.body;
    const slug = slugify(title);
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO blog (title, title_en, category, type, slug, writeup, writeup_en, audio_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, title_en ?? null, category, type, slug, writeup ?? null, writeup_en ?? null, audio_url ?? null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create blog entry" });
  }
});

// PUT /api/blog/:id
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { title, title_en, category, type, writeup, writeup_en, audio_url } = req.body;
    const slug = slugify(title);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE blog SET title = ?, title_en = ?, category = ?, type = ?, slug = ?, writeup = ?, writeup_en = ?, audio_url = ? WHERE id = ? AND is_deleted = 0`,
      [title, title_en ?? null, category, type, slug, writeup ?? null, writeup_en ?? null, audio_url ?? null, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Not found" });
    res.json({ updated: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update blog entry" });
  }
});

// DELETE /api/blog/:id — soft delete
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE blog SET is_deleted = 1 WHERE id = ? AND is_deleted = 0`,
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Not found" });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete blog entry" });
  }
});

export default router;
