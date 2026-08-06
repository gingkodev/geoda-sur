import { Router } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { getLang, resolveRows, resolveRow, cacheHeaders } from "../lang.js";
import { uniqueSlug } from "../slugs.js";
import { handleRouteError } from "../route-errors.js";
import {
  requiredVarchar,
  optionalVarchar,
  optionalText,
  oneOf,
  parsePagination,
  optionalQueryString,
} from "../validate.js";

const router = Router();

const I18N_FIELDS = ["title", "writeup"];

// Mirrors the CMS `type` dropdown (admin/index.html). The column is a plain
// VARCHAR(20), so without this any string would be accepted and the public
// frontend — which switches rendering on these three — would silently skip it.
const BLOG_TYPES = ["post", "audio", "note"] as const;

// GET /api/blog — supports ?type=post|audio|note filter, pagination via ?offset=&limit=
router.get("/", async (req, res) => {
  try {
    const lang = getLang(req);
    const { offset, limit } = parsePagination(req.query.offset, req.query.limit);

    let where = `WHERE is_deleted = 0`;
    const params: (string | number)[] = [];

    // `?type[]=a&type[]=b` parses to an array, which mysql2 expands into a
    // comma list and broke the single-placeholder query. Only a scalar filters.
    const typeFilter = optionalQueryString(req.query.type);
    if (typeFilter) {
      where += ` AND type = ?`;
      params.push(typeFilter);
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
    const title = requiredVarchar(req.body.title, "title", 255);
    const title_en = optionalVarchar(req.body.title_en, "title_en", 255);
    const category = requiredVarchar(req.body.category, "category", 100);
    const type = oneOf(req.body.type, "type", BLOG_TYPES);
    const writeup = optionalText(req.body.writeup, "writeup");
    const writeup_en = optionalText(req.body.writeup_en, "writeup_en");
    const audio_url = optionalVarchar(req.body.audio_url, "audio_url", 512);

    const slug = await uniqueSlug("blog", title);

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO blog (title, title_en, category, type, slug, writeup, writeup_en, audio_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, title_en, category, type, slug, writeup, writeup_en, audio_url]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    handleRouteError(err, res, "Failed to create blog entry");
  }
});

// PUT /api/blog/:id
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const title = requiredVarchar(req.body.title, "title", 255);
    const title_en = optionalVarchar(req.body.title_en, "title_en", 255);
    const category = requiredVarchar(req.body.category, "category", 100);
    const type = oneOf(req.body.type, "type", BLOG_TYPES);
    const writeup = optionalText(req.body.writeup, "writeup");
    const writeup_en = optionalText(req.body.writeup_en, "writeup_en");
    const audio_url = optionalVarchar(req.body.audio_url, "audio_url", 512);

    const slug = await uniqueSlug("blog", title, String(req.params.id));

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE blog SET title = ?, title_en = ?, category = ?, type = ?, slug = ?, writeup = ?, writeup_en = ?, audio_url = ? WHERE id = ? AND is_deleted = 0`,
      [title, title_en, category, type, slug, writeup, writeup_en, audio_url, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Not found" });
    res.json({ updated: true });
  } catch (err) {
    handleRouteError(err, res, "Failed to update blog entry");
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
