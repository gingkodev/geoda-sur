import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app.js";
import { seedUser, getAuthToken, seedBlogEntry } from "./helpers.js";

describe("Blog Routes", () => {
  let token: string;

  beforeEach(async () => {
    const user = await seedUser();
    token = getAuthToken(user.id, user.email);
  });

  describe("GET /api/blog", () => {
    it("returns paginated empty result", async () => {
      const res = await request(app).get("/api/blog");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
      expect(res.body.limit).toBe(20);
      expect(res.body.offset).toBe(0);
    });

    it("returns blog entries in data array", async () => {
      await seedBlogEntry("Post 1");
      await seedBlogEntry("Post 2");
      const res = await request(app).get("/api/blog");
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it("filters by type", async () => {
      await seedBlogEntry("A Post", "cat", "post");
      await seedBlogEntry("A Note", "cat", "note");
      const res = await request(app).get("/api/blog?type=note");
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe("A Note");
      expect(res.body.total).toBe(1);
    });

    it("respects limit parameter", async () => {
      for (let i = 0; i < 5; i++) await seedBlogEntry(`Post ${i}`);
      const res = await request(app).get("/api/blog?limit=2");
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(5);
      expect(res.body.limit).toBe(2);
    });

    it("respects offset parameter", async () => {
      for (let i = 0; i < 5; i++) await seedBlogEntry(`Post ${i}`);
      const res = await request(app).get("/api/blog?limit=2&offset=2");
      expect(res.body.data).toHaveLength(2);
      expect(res.body.offset).toBe(2);
    });

    it("caps limit at 100", async () => {
      const res = await request(app).get("/api/blog?limit=999");
      expect(res.body.limit).toBe(100);
    });

    it("defaults negative offset to 0", async () => {
      const res = await request(app).get("/api/blog?offset=-5");
      expect(res.body.offset).toBe(0);
    });

    it("excludes soft-deleted entries", async () => {
      await seedBlogEntry();
      const { default: pool } = await import("../db.js");
      await pool.query("UPDATE blog SET is_deleted = 1");
      const res = await request(app).get("/api/blog");
      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it("combines type filter with pagination", async () => {
      for (let i = 0; i < 5; i++) await seedBlogEntry(`Post ${i}`, "cat", "post");
      for (let i = 0; i < 3; i++) await seedBlogEntry(`Note ${i}`, "cat", "note");
      const res = await request(app).get("/api/blog?type=post&limit=2&offset=1");
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(5);
    });
  });

  describe("GET /api/blog/:id", () => {
    it("returns a single blog entry", async () => {
      const entry = await seedBlogEntry("My Post");
      const res = await request(app).get(`/api/blog/${entry.id}`);
      expect(res.status).toBe(200);
      expect(res.body.title).toBe("My Post");
    });

    it("returns 404 for non-existent entry", async () => {
      const res = await request(app).get("/api/blog/9999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/blog", () => {
    it("creates a blog entry", async () => {
      const res = await request(app)
        .post("/api/blog")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "New", category: "tech", type: "post", writeup: "Content" });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });

    it("rejects unauthenticated create", async () => {
      const res = await request(app)
        .post("/api/blog")
        .send({ title: "New", category: "tech", type: "post" });
      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/blog/:id", () => {
    it("updates a blog entry", async () => {
      const entry = await seedBlogEntry();
      const res = await request(app)
        .put(`/api/blog/${entry.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Updated", category: "new", type: "post", writeup: "New" });
      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(true);
    });

    it("returns 404 for non-existent entry", async () => {
      const res = await request(app)
        .put("/api/blog/9999")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "X", category: "X", type: "post" });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/blog/:id", () => {
    it("soft-deletes a blog entry", async () => {
      const entry = await seedBlogEntry();
      const res = await request(app)
        .delete(`/api/blog/${entry.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
    });
  });
});
