import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { RowDataPacket } from "mysql2";
import pool from "./db.js";

// migrations/ lives at the project root: one ordered source of truth, shipped to
// prod (it's NOT gitignored, unlike misc/). Commands always run from the project
// root (npm scripts; docker WORKDIR=/app), so resolve from cwd.
const MIGRATIONS_DIR = join(process.cwd(), "migrations");

// MySQL error codes meaning "this object already exists / is already gone".
// Tolerated ONLY on the first (baseline) run, to converge schemas that were
// built from db_build.sql or hand-migrated before this runner existed.
const ALREADY_APPLIED = new Set([
  1050, // ER_TABLE_EXISTS_ERROR
  1060, // ER_DUP_FIELDNAME       (column already exists)
  1061, // ER_DUP_KEYNAME         (index already exists)
  1091, // ER_CANT_DROP_FIELD_OR_KEY (drop target already gone)
]);

// Naive splitter: strips `-- ` line comments and splits on `;`. Fine for plain
// DDL/DML migrations. A migration needing internal semicolons (stored proc /
// trigger with a DELIMITER block) would need different handling — avoid those.
function splitStatements(sql: string): string[] {
  return sql
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function runMigrations(): Promise<void> {
  // Did the bookkeeping table exist BEFORE this boot? If not, this is the first
  // adoption run → lenient: swallow "already exists" so any prior schema state
  // (fresh-from-db_build, or dev DBs migrated by hand) baselines cleanly.
  const [tables] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schema_migrations'`
  );
  const firstRun = tables.length === 0;

  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename   VARCHAR(255) PRIMARY KEY,
       applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  const [appliedRows] = await pool.query<RowDataPacket[]>(
    "SELECT filename FROM schema_migrations"
  );
  const applied = new Set(appliedRows.map((r) => r.filename));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (firstRun) {
    console.log("[migrate] first run — baselining existing schema (lenient)");
  }

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const statements = splitStatements(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));

    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err: any) {
        if (firstRun && ALREADY_APPLIED.has(err?.errno)) {
          console.warn(`[migrate] ${file}: already applied (errno ${err.errno}), skipping statement`);
          continue;
        }
        console.error(`[migrate] ${file} FAILED:`, err?.sqlMessage ?? err);
        throw err;
      }
    }

    await pool.query("INSERT INTO schema_migrations (filename) VALUES (?)", [file]);
    console.log(`[migrate] applied ${file}`);
    ran++;
  }

  console.log(`[migrate] up to date (${ran} new, ${files.length} total)`);
}

// Standalone entry: `npm run migrate` (runs migrations, then exits).
// Skipped when imported by server.ts.
const invokedDirectly =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  runMigrations()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error("[migrate] aborted:", err);
      await pool.end().catch(() => {});
      process.exit(1);
    });
}
