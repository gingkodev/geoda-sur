import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "../db.js";
import { getLang, cacheHeaders } from "../lang.js";
import { slugify } from "../slugify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_PATH = path.join(__dirname, "..", "..", "images.json");

const router = Router();

async function loadImages(): Promise<string[]> {
	try {
		const raw = await fs.readFile(IMAGES_PATH, "utf-8");
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function pickImage(images: string[]): string | null {
	if (!images.length) return null;
	return images[Math.floor(Math.random() * images.length)];
}

// GET /api/feed — paginated union of all content types
router.get("/", async (req, res) => {
	try {
		const lang = getLang(req);
		const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
		const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

		const [[{ total }]] = await pool.query<RowDataPacket[]>(`
      SELECT (
        (SELECT COUNT(*) FROM blog WHERE is_deleted = 0) +
        (SELECT COUNT(*) FROM projects WHERE is_deleted = 0) +
        (SELECT COUNT(*) FROM services WHERE is_deleted = 0)
      ) AS total
    `);

		// Resolve title based on lang — COALESCE for EN fallback
		const titleBlog = lang === "en"
			? "COALESCE(title_en, title)" : "title";
		const titleProject = lang === "en"
			? "COALESCE(name_en, name)" : "name";
		const titleService = lang === "en"
			? "COALESCE(name_en, name)" : "name";

		const [rows] = await pool.query<RowDataPacket[]>(
			`(SELECT id, 'blog' AS type, ${titleBlog} AS title, date_created, slug, slug AS slug_source FROM blog WHERE is_deleted = 0)
       UNION ALL
       (SELECT id, 'project' AS type, ${titleProject} AS title, date_created, slug, slug AS slug_source FROM projects WHERE is_deleted = 0)
       UNION ALL
       (SELECT id, 'service' AS type, ${titleService} AS title, date_created, slug, name AS slug_source FROM services WHERE is_deleted = 0)
       ORDER BY date_created DESC LIMIT ? OFFSET ?`,
			[limit, offset]
		);

		const images = await loadImages();

		const data = rows.map((row) => {
			const isService = row.type === "service";
			// Services use path-based routes resolved by runtime slugify(name).
			// Blog/projects still use hash anchors against stored slug column.
			const slug = isService ? slugify(row.slug_source) : row.slug;
			const link = isService ? `/servicios/${slug}` : `/${row.type === "project" ? "proyectos" : "blog"}#${slug}`;
			return {
				id: row.id,
				type: row.type,
				title: row.title,
				image: pickImage(images),
				date_created: row.date_created,
				slug,
				link,
			};
		});

		const headers = cacheHeaders(lang);
		for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);

		res.json({ data, total, limit, offset });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Failed to fetch feed" });
	}
});

export default router;
