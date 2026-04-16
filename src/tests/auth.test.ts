import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app.js";
import { seedUser, getAuthToken } from "./helpers.js";

describe("Auth Routes", () => {
  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await seedUser("admin@test.com", "secret123", "Admin");
    });

    it("returns token on valid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "admin@test.com", password: "secret123" });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.name).toBe("Admin");
    });

    it("rejects wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "admin@test.com", password: "wrong" });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid credentials");
    });

    it("rejects non-existent email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nope@test.com", password: "secret123" });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid credentials");
    });

    it("rejects missing email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ password: "secret123" });
      expect(res.status).toBe(400);
    });

    it("rejects missing password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "admin@test.com" });
      expect(res.status).toBe(400);
    });

    it("rejects empty body", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/register", () => {
    let token: string;

    beforeEach(async () => {
      const user = await seedUser("admin@test.com", "secret123", "Admin");
      token = getAuthToken(user.id, user.email);
    });

    it("creates a new user when authenticated", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "new@test.com", password: "pass123", name: "New User" });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.email).toBe("new@test.com");
    });

    it("rejects duplicate email", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "admin@test.com", password: "pass123", name: "Dupe" });
      expect(res.status).toBe(409);
    });

    it("rejects unauthenticated register", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "new@test.com", password: "pass123", name: "New" });
      expect(res.status).toBe(401);
    });

    it("rejects missing fields", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "new@test.com" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns user info with valid token", async () => {
      const user = await seedUser();
      const token = getAuthToken(user.id, user.email);
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe("test@test.com");
      expect(res.body.name).toBe("Test User");
    });

    it("returns 404 for deleted user with valid token", async () => {
      const user = await seedUser();
      const token = getAuthToken(user.id, user.email);
      const { default: pool } = await import("../db.js");
      await pool.query("UPDATE users SET is_deleted = 1 WHERE id = ?", [user.id]);
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it("rejects unauthenticated request", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });
  });
});
