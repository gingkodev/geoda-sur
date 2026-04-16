import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app.js";
import { seedUser, getAuthToken } from "../helpers.js";

describe("Auth Middleware", () => {
  let token: string;

  beforeEach(async () => {
    const user = await seedUser();
    token = getAuthToken(user.id, user.email);
  });

  it("allows request with valid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("test@test.com");
  });

  it("rejects request with no Authorization header", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("No token provided");
  });

  it("rejects request with no Bearer prefix", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", token);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("No token provided");
  });

  it("rejects malformed token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not.a.real.token");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid token");
  });

  it("rejects expired token", async () => {
    const expired = jwt.sign(
      { userId: 1, email: "test@test.com" },
      process.env.JWT_SECRET ?? "test-secret",
      { expiresIn: "0s" }
    );
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it("rejects token signed with wrong secret", async () => {
    const tampered = jwt.sign(
      { userId: 1, email: "test@test.com" },
      "wrong-secret",
      { expiresIn: "1h" }
    );
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it("rejects token with empty Bearer value", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer ");
    expect(res.status).toBe(401);
  });
});
