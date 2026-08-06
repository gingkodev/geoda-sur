import "dotenv/config";
import { beforeEach, afterAll } from "vitest";

process.env.JWT_SECRET = "test-secret";

// The validation sweep issues a few hundred requests in one file, which would
// exhaust the real 60/min cap and answer 429 — a status below 500 that would
// let a genuine 500 slip through the assertion unnoticed. Raised only here.
process.env.RATE_LIMIT_MAX = "1000000";

// Child tables must be reset too. TRUNCATE resets AUTO_INCREMENT, so the next
// test's seedService() gets id=1 again — and any service_images left behind by
// the previous test still point at service_id=1, silently counting against the
// 3-image cap and failing an unrelated test.
const TABLES = [
  "projects_services",
  "service_images",
  "formacion_images",
  "contact_messages",
  "blog",
  "projects",
  "services",
  "users",
];

beforeEach(async () => {
  const { default: pool } = await import("../db.js");
  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const table of TABLES) {
    await pool.query(`TRUNCATE TABLE ${table}`);
  }
  await pool.query("SET FOREIGN_KEY_CHECKS = 1");
});

afterAll(async () => {
  const { default: pool } = await import("../db.js");
  await pool.end();
});
