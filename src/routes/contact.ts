import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { handleRouteError } from "../route-errors.js";
import {
  requiredVarchar,
  requiredText,
  parsePagination,
  singleLine,
  multiLine,
} from "../validate.js";

const router = Router();

// GET /api/contact — admin inbox, newest first. Auth-gated: these are private
// messages from the public form, so unlike the other GET routes this one is
// never anonymous. Paginated like /api/blog (same clamp rules).
router.get("/", requireAuth, async (req, res) => {
  try {
    const { offset, limit } = parsePagination(req.query.offset, req.query.limit, 50);

    const [[{ total }]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM contact_messages`
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, email, message, date_created
       FROM contact_messages
       ORDER BY date_created DESC, id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json({ data: rows, total, limit, offset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch contact messages" });
  }
});

// POST /api/contact
router.post("/", async (req, res) => {
  try {
    // `name?.trim()` only guarded null/undefined — a number, boolean, array or
    // object reached .trim() and threw, so bad client input returned 500.
    const name = singleLine(requiredVarchar(req.body.name, "name", 255));
    const email = requiredVarchar(req.body.email, "email", 255);
    const message = multiLine(requiredText(req.body.message, "message"));

    // Basic email format check. Runs on the trimmed value so a passing address
    // is exactly the one that gets stored.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Stripping control characters can empty a field that was only control
    // characters to begin with.
    if (!name || !message) {
      return res.status(400).json({ error: "name and message are required" });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)`,
      [name, email, message]
    );

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    handleRouteError(err, res, "Failed to submit contact message");
  }
});

export default router;
