import type { ResultSetHeader } from "mysql2";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";

// Lazy import pool to ensure env vars are set
async function getPool() {
  const { default: pool } = await import("../db.js");
  return pool;
}

export async function seedUser(
  email = "test@test.com",
  password = "password123",
  name = "Test User"
) {
  const pool = await getPool();
  const hash = await bcrypt.hash(password, 4); // low rounds for speed
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)`,
    [email, hash, name]
  );
  return { id: result.insertId, email, name, password };
}

export function getAuthToken(userId: number, email: string) {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "1h" });
}

export async function seedProject(
  name = "Test Project",
  writeup = "A test project",
  img_url = "/uploads/images/test.webp"
) {
  const pool = await getPool();
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO projects (name, writeup, img_url) VALUES (?, ?, ?)`,
    [name, writeup, img_url]
  );
  return { id: result.insertId, name, writeup, img_url };
}

export async function seedService(
  name = "Test Service",
  description = "A test service"
) {
  const pool = await getPool();
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO services (name, description) VALUES (?, ?)`,
    [name, description]
  );
  return { id: result.insertId, name, description };
}

export async function seedBlogEntry(
  title = "Test Post",
  category = "general",
  type = "post",
  writeup = "Some content"
) {
  const pool = await getPool();
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO blog (title, category, type, writeup) VALUES (?, ?, ?, ?)`,
    [title, category, type, writeup]
  );
  return { id: result.insertId, title, category, type, writeup };
}

export async function linkProjectService(
  projectId: number,
  serviceId: number
) {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO projects_services (project_id, service_id) VALUES (?, ?)`,
    [projectId, serviceId]
  );
}

// Minimal 1x1 transparent PNG (68 bytes)
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

// Minimal valid-ish MP3 buffer (just enough bytes with .mp3 extension)
export const TINY_MP3 = Buffer.from(
  "//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVV",
  "base64"
);
