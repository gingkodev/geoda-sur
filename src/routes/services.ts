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
  requiredText,
  optionalText,
  optionalInt,
} from "../validate.js";

const router = Router();

const I18N_FIELDS = ["name", "description"];
const MAX_SERVICE_IMAGES = 3;

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

    // Look the slug up in the `slug` column rather than recomputing it from the
    // name. The stored value is the one the UNIQUE index guards, the one POST/PUT
    // allocate via uniqueSlug() (including its -2/-3 collision suffixes), and the
    // one every link in the app is built from. Recomputing the slug from the name
    // here silently disagreed with all three: a service whose slug had been
    // suffixed, or whose stored slug predates the current slug rules, was
    // unreachable and answered 404 on a link the app itself had emitted.
    const [services] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM services WHERE slug = ? AND is_deleted = 0`,
      [req.params.slug]
    );
    if (!services.length) return res.status(404).json({ error: "Not found" });
    const service = services[0];

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
    const name = requiredVarchar(req.body.name, "name", 255);
    const name_en = optionalVarchar(req.body.name_en, "name_en", 255);
    const description = requiredText(req.body.description, "description");
    const description_en = optionalText(req.body.description_en, "description_en");
    const link_url = optionalVarchar(req.body.link_url, "link_url", 512);

    const slug = await uniqueSlug("services", name);

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO services (name, name_en, slug, description, description_en, link_url) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, name_en, slug, description, description_en, link_url]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    handleRouteError(err, res, "Failed to create service");
  }
});

// PUT /api/services/:id
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const name = requiredVarchar(req.body.name, "name", 255);
    const name_en = optionalVarchar(req.body.name_en, "name_en", 255);
    const description = requiredText(req.body.description, "description");
    const description_en = optionalText(req.body.description_en, "description_en");
    const link_url = optionalVarchar(req.body.link_url, "link_url", 512);

    const slug = await uniqueSlug("services", name, String(req.params.id));

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE services SET name = ?, name_en = ?, slug = ?, description = ?, description_en = ?, link_url = ? WHERE id = ? AND is_deleted = 0`,
      [name, name_en, slug, description, description_en, link_url, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Not found" });
    res.json({ updated: true });
  } catch (err) {
    handleRouteError(err, res, "Failed to update service");
  }
});

// POST /api/services/:id/images
router.post("/:id/images", requireAuth, async (req, res) => {
  let img_url: string;
  let mobile_img_url: string | null;
  let caption: string | null;
  let sort_order: number;
  try {
    img_url = requiredVarchar(req.body.img_url, "img_url", 512);
    mobile_img_url = optionalVarchar(req.body.mobile_img_url, "mobile_img_url", 512);
    caption = optionalVarchar(req.body.caption, "caption", 255);
    sort_order = optionalInt(req.body.sort_order, "sort_order", 0);
  } catch (err) {
    return handleRouteError(err, res, "Failed to add image");
  }

  // Counting then inserting on the pool let concurrent requests all observe the
  // same pre-insert count and sail past the cap (10 parallel POSTs stored 7).
  // Taking a row lock on the parent service serialises every image insert for
  // that service, so the count is read under the same lock that guards the write.
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [services] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM services WHERE id = ? AND is_deleted = 0 FOR UPDATE`,
      [req.params.id]
    );
    if (!services.length) {
      await conn.rollback();
      return res.status(404).json({ error: "Not found" });
    }

    const [countRows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM service_images WHERE service_id = ?`,
      [req.params.id]
    );
    if (Number(countRows[0].count) >= MAX_SERVICE_IMAGES) {
      await conn.rollback();
      return res.status(400).json({
        error: `Este servicio ya tiene el máximo de ${MAX_SERVICE_IMAGES} imágenes.`,
      });
    }

    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO service_images (service_id, img_url, mobile_img_url, caption, sort_order) VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, img_url, mobile_img_url, caption, sort_order]
    );

    await conn.commit();
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    await conn.rollback().catch(() => {});
    handleRouteError(err, res, "Failed to add image");
  } finally {
    conn.release();
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
