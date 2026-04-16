import "dotenv/config";
import { beforeEach, afterAll } from "vitest";

process.env.JWT_SECRET = "test-secret";

const TABLES = ["projects_services", "blog", "projects", "services", "users"];

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
