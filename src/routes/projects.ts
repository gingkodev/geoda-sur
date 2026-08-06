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
  requiredInt,
} from "../validate.js";

const router = Router();

const I18N_FIELDS = ["name", "writeup"];

// GET /api/projects — list all non-deleted, with service_ids
router.get("/", async (req, res) => {
  try {
    const lang = getLang(req);

    const [projects] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM projects WHERE is_deleted = 0 ORDER BY date_created DESC`
    );

    if (projects.length) {
      const projectIds = projects.map((p) => p.id);
      const [links] = await pool.query<RowDataPacket[]>(
        `SELECT project_id, service_id FROM projects_services WHERE project_id IN (?)`,
        [projectIds]
      );

      const serviceMap = new Map<number, number[]>();
      for (const link of links) {
        const arr = serviceMap.get(link.project_id) ?? [];
        arr.push(link.service_id);
        serviceMap.set(link.project_id, arr);
      }

      for (const project of projects) {
        project.service_ids = serviceMap.get(project.id) ?? [];
      }
    }

    resolveRows(projects, lang, I18N_FIELDS);

    const headers = cacheHeaders(lang);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);

    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// GET /api/projects/:id
router.get("/:id", async (req, res) => {
  try {
    const lang = getLang(req);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM projects WHERE id = ? AND is_deleted = 0`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const project = rows[0];
    const [links] = await pool.query<RowDataPacket[]>(
      `SELECT service_id FROM projects_services WHERE project_id = ?`,
      [project.id]
    );
    project.service_ids = links.map((l) => l.service_id);

    resolveRow(project, lang, I18N_FIELDS);

    const headers = cacheHeaders(lang);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);

    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

// POST /api/projects
router.post("/", requireAuth, async (req, res) => {
  try {
    const name = requiredVarchar(req.body.name, "name", 255);
    const name_en = optionalVarchar(req.body.name_en, "name_en", 255);
    const writeup = requiredText(req.body.writeup, "writeup");
    const writeup_en = optionalText(req.body.writeup_en, "writeup_en");
    const img_url = requiredVarchar(req.body.img_url, "img_url", 512);
    const audio_url = optionalVarchar(req.body.audio_url, "audio_url", 512);

    const slug = await uniqueSlug("projects", name);

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO projects (name, name_en, writeup, writeup_en, slug, img_url, audio_url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, name_en, writeup, writeup_en, slug, img_url, audio_url]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    handleRouteError(err, res, "Failed to create project");
  }
});

// PUT /api/projects/:id
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const name = requiredVarchar(req.body.name, "name", 255);
    const name_en = optionalVarchar(req.body.name_en, "name_en", 255);
    const writeup = requiredText(req.body.writeup, "writeup");
    const writeup_en = optionalText(req.body.writeup_en, "writeup_en");
    const img_url = requiredVarchar(req.body.img_url, "img_url", 512);
    const audio_url = optionalVarchar(req.body.audio_url, "audio_url", 512);

    // Exclude this row so re-saving an unchanged name keeps its current slug
    // instead of drifting to name-2.
    const slug = await uniqueSlug("projects", name, String(req.params.id));

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE projects SET name = ?, name_en = ?, writeup = ?, writeup_en = ?, slug = ?, img_url = ?, audio_url = ? WHERE id = ? AND is_deleted = 0`,
      [name, name_en, writeup, writeup_en, slug, img_url, audio_url, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Not found" });
    res.json({ updated: true });
  } catch (err) {
    handleRouteError(err, res, "Failed to update project");
  }
});

// DELETE /api/projects/:id — soft delete
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE projects SET is_deleted = 1 WHERE id = ? AND is_deleted = 0`,
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Not found" });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// POST /api/projects/:id/services — link a service
router.post("/:id/services", requireAuth, async (req, res) => {
  try {
    const service_id = requiredInt(req.body.service_id, "service_id");
    await pool.query(
      `INSERT INTO projects_services (project_id, service_id) VALUES (?, ?)`,
      [req.params.id, service_id]
    );
    res.status(201).json({ linked: true });
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Already linked" });
    }
    // A link to a service that does not exist is bad input, not a server fault.
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ error: "service_id does not exist" });
    }
    handleRouteError(err, res, "Failed to link service");
  }
});

// DELETE /api/projects/:id/services/:serviceId — unlink a service
router.delete("/:id/services/:serviceId", requireAuth, async (req, res) => {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM projects_services WHERE project_id = ? AND service_id = ?`,
      [req.params.id, req.params.serviceId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Not found" });
    res.json({ unlinked: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unlink service" });
  }
});

export default router;
