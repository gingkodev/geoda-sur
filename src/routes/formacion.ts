import { Router } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { getLang, resolveRow, cacheHeaders } from "../lang.js";
import { handleRouteError } from "../route-errors.js";
import {
  requiredText,
  optionalText,
  requiredVarchar,
  optionalVarchar,
  optionalInt,
} from "../validate.js";

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
    // The old `if (!intro)` check passed any truthy value through, so posting an
    // object stored the string "[object Object]" and returned 200.
    const intro = requiredText(req.body.intro, "intro");
    const intro_en = optionalText(req.body.intro_en, "intro_en");

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE formacion_page SET intro = ?, intro_en = ? WHERE id = 1`,
      [intro, intro_en]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Not found" });
    res.json({ updated: true });
  } catch (err) {
    handleRouteError(err, res, "Failed to update formacion");
  }
});

// POST /api/formacion/images
router.post("/images", requireAuth, async (req, res) => {
  try {
    const img_url = requiredVarchar(req.body.img_url, "img_url", 512);
    const mobile_img_url = optionalVarchar(req.body.mobile_img_url, "mobile_img_url", 512);
    const sort_order = optionalInt(req.body.sort_order, "sort_order", 0);

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO formacion_images (img_url, mobile_img_url, sort_order) VALUES (?, ?, ?)`,
      [img_url, mobile_img_url, sort_order]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    handleRouteError(err, res, "Failed to add image");
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
