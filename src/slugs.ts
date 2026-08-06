import type { RowDataPacket } from "mysql2";
import pool from "./db.js";
import { slugify } from "./slugify.js";

/**
 * Slug allocation for the tables whose `slug` column carries a UNIQUE index
 * (added in migration 0002).
 *
 * Two inputs used to collide with that index and surface as a 500:
 *   - two rows with the same name produce the same slug;
 *   - a name with no ASCII alphanumerics ("日本語", "---") slugifies to "",
 *     so the first such row takes the empty slug and every later one fails.
 *
 * Both are ordinary user input, not errors, so we pick the next free suffix
 * (-2, -3, …) instead. There is still a narrow race between the SELECT and the
 * INSERT, so callers must also map ER_DUP_ENTRY to a 409 as a backstop.
 */

// The table name is interpolated into SQL, so it is restricted to this fixed
// set. Never pass a caller-supplied value here.
const SLUG_TABLES = new Set(["projects", "services", "blog"]);

/** Fallback base when a name has nothing sluggable in it. */
const FALLBACK_BASE = "item";

export async function uniqueSlug(
	table: string,
	name: string,
	excludeId?: number | string
): Promise<string> {
	if (!SLUG_TABLES.has(table)) {
		throw new Error(`uniqueSlug: unsupported table "${table}"`);
	}

	const base = slugify(name) || FALLBACK_BASE;

	// Pull every slug that could conflict in one query: the base itself plus
	// anything already carrying a numeric suffix.
	let sql = `SELECT slug FROM ${table} WHERE (slug = ? OR slug LIKE ?)`;
	const params: (string | number)[] = [base, `${base}-%`];
	if (excludeId !== undefined) {
		sql += ` AND id <> ?`;
		params.push(excludeId);
	}

	const [rows] = await pool.query<RowDataPacket[]>(sql, params);
	const taken = new Set(rows.map((r) => r.slug));

	if (!taken.has(base)) return base;
	for (let n = 2; ; n++) {
		const candidate = `${base}-${n}`;
		if (!taken.has(candidate)) return candidate;
	}
}

/** True when a mysql2 error is a UNIQUE-constraint violation. */
export function isDuplicateEntry(err: unknown): boolean {
	return (err as { code?: string })?.code === "ER_DUP_ENTRY";
}
