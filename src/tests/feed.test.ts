import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";
import { seedProject, seedService, seedBlogEntry } from "./helpers.js";

describe("Feed Routes", () => {
  describe("GET /api/feed", () => {
    it("returns empty feed", async () => {
      const res = await request(app).get("/api/feed");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it("returns mixed content types", async () => {
      await seedProject("My Project");
      await seedService("My Service");
      await seedBlogEntry("My Post");

      const res = await request(app).get("/api/feed");
      expect(res.body.data).toHaveLength(3);
      expect(res.body.total).toBe(3);

      const types = res.body.data.map((d: any) => d.type).sort();
      expect(types).toEqual(["blog", "project", "service"]);
    });

    it("paginates results", async () => {
      for (let i = 0; i < 5; i++) await seedBlogEntry(`Post ${i}`);
      const res = await request(app).get("/api/feed?limit=2&offset=0");
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(5);
    });

    it("includes image field on each item (null when no images.json)", async () => {
      await seedProject();
      const res = await request(app).get("/api/feed");
      expect(res.body.data[0]).toHaveProperty("image");
    });

    it("excludes soft-deleted content", async () => {
      await seedProject();
      const { default: pool } = await import("../db.js");
      await pool.query("UPDATE projects SET is_deleted = 1");
      const res = await request(app).get("/api/feed");
      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
    });
  });
});
