import { Router } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import { signToken, requireAuth } from "../middleware/auth.js";

const router = Router();

// POST /api/auth/register — only existing admins can create new users
router.post("/register", requireAuth, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "email, password, and name are required" });
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM users WHERE email = ? AND is_deleted = 0`,
      [email]
    );
    if (existing.length) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)`,
      [email, hash, name]
    );

    res.status(201).json({ id: result.insertId, email, name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, password_hash, name FROM users WHERE email = ? AND is_deleted = 0`,
      [email]
    );
    if (!rows.length) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken({ userId: user.id, email: user.email });
    res.json({ token, name: user.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// GET /api/auth/me — verify token, return user info
router.get("/me", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, name FROM users WHERE id = ? AND is_deleted = 0`,
      [userId]
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
