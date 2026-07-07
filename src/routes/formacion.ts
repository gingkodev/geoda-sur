import { Router } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { getLang, resolveRow, cacheHeaders } from "../lang.js";

const router = Router();

const I18N_FIELDS = ["intro"];

// GET /api/formacion — singleton page: intro text + image grid
router.get("/", async (req, res) => {
  try {
    const lang = getLang(req);

    const [pages] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM formacion_page WHERE id = 1`
    );
    if (!pages.length) return res.status(404).json({ error: "Not found" });

    const [images] = await pool.query<RowDataPacket[]>(
      `SELECT id, img_url, mobile_img_url, sort_order FROM formacion_images ORDER BY sort_order, id`
    );

    resolveRow(pages[0], lang, I18N_FIELDS);

    const headers = cacheHeaders(lang);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);

    res.json({ ...pages[0], images });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch formacion" });
  }
});

// PUT /api/formacion — update intro text
router.put("/", requireAuth, async (req, res) => {
  try {
    const { intro, intro_en } = req.body;
    if (!intro) return res.status(400).json({ error: "intro is required" });

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE formacion_page SET intro = ?, intro_en = ? WHERE id = 1`,
      [intro, intro_en ?? null]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Not found" });
    res.json({ updated: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update formacion" });
  }
});

// POST /api/formacion/images
router.post("/images", requireAuth, async (req, res) => {
  try {
    const { img_url, mobile_img_url, sort_order } = req.body;
    if (!img_url) return res.status(400).json({ error: "img_url is required" });

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO formacion_images (img_url, mobile_img_url, sort_order) VALUES (?, ?, ?)`,
      [img_url, mobile_img_url ?? null, sort_order ?? 0]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add image" });
  }
});

// DELETE /api/formacion/images/:id
router.delete("/images/:id", requireAuth, async (req, res) => {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM formacion_images WHERE id = ?`,
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Not found" });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

export default router;
