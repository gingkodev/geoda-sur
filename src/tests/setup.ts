import "dotenv/config";
import { beforeEach, afterAll } from "vitest";

process.env.JWT_SECRET = "test-secret";

// Refuse to run against anything but a *_test database.
//
// beforeEach below TRUNCATEs eight tables. There is no transaction rollback and
// no schema isolation, so whatever MYSQL_DATABASE points at is emptied — and it
// defaulted to whatever .env said, i.e. the development database with real
// content in it. `npm test` sets MYSQL_DATABASE explicitly; this guard is what
// makes the damage impossible rather than merely unlikely, including when vitest
// is invoked directly.
const TARGET_DB = process.env.MYSQL_DATABASE ?? "";
if (!/_test$/.test(TARGET_DB)) {
  throw new Error(
    `Refusing to run tests against database "${TARGET_DB || "(unset)"}".\n` +
      `The suite TRUNCATEs every table, so it only runs against a database whose\n` +
      `name ends in "_test". Use \`npm test\`, which sets MYSQL_DATABASE=cardinal_test.\n` +
      `To create that database once:\n` +
      `  docker exec -i cardinal-db-1 mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e \\\n` +
      `    "CREATE DATABASE IF NOT EXISTS cardinal_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n` +
      `     GRANT ALL ON cardinal_test.* TO '$MYSQL_USER'@'%'; FLUSH PRIVILEGES;"\n` +
      `  tail -n +3 db_build.sql | docker exec -i cardinal-db-1 mysql -uroot -p"$MYSQL_ROOT_PASSWORD" cardinal_test\n` +
      `  MYSQL_DATABASE=cardinal_test npm run migrate`
  );
}

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
