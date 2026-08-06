import type { Request, Response, NextFunction } from "express";
import type { RowDataPacket } from "mysql2";
import jwt from "jsonwebtoken";
import pool from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "cardinal-dev-secret";

export interface AuthPayload {
  userId: number;
  email: string;
}

/**
 * Verify the bearer token AND confirm the user still exists.
 *
 * Signature verification alone is not enough: tokens last 7 days, so a
 * soft-deleted user kept full write access for up to a week after being
 * removed. Login and /auth/me both refused them, which made the CMS look
 * revoked while the API still accepted their writes.
 *
 * This costs one indexed primary-key lookup per authenticated request. That is
 * acceptable for a CMS with a handful of editors; if the admin surface ever
 * gets chatty, the alternative is a short token TTL plus a refresh endpoint.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  let payload: AuthPayload;
  try {
    payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthPayload;
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM users WHERE id = ? AND is_deleted = 0`,
      [payload.userId]
    );
    if (!rows.length) {
      return res.status(401).json({ error: "Invalid token" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Authentication check failed" });
  }

  (req as any).user = payload;
  next();
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}
