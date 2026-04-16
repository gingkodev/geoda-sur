import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app.js";
import { seedUser, getAuthToken, seedService } from "./helpers.js";

describe("Services Routes", () => {
  let token: string;

  beforeEach(async () => {
    const user = await seedUser();
    token = getAuthToken(user.id, user.email);
  });

  describe("GET /api/services", () => {
    it("returns empty array when no services", async () => {
      const res = await request(app).get("/api/services");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("returns all non-deleted services", async () => {
      await seedService("Service A");
      await seedService("Service B");
      const res = await request(app).get("/api/services");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it("excludes soft-deleted services", async () => {
      await seedService();
      const { default: pool } = await import("../db.js");
      await pool.query("UPDATE services SET is_deleted = 1");
      const res = await request(app).get("/api/services");
      expect(res.body).toEqual([]);
    });
  });

  describe("GET /api/services/:id", () => {
    it("returns a single service", async () => {
      const service = await seedService("My Service", "Does things");
      const res = await request(app).get(`/api/services/${service.id}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("My Service");
      expect(res.body.description).toBe("Does things");
    });

    it("returns 404 for non-existent service", async () => {
      const res = await request(app).get("/api/services/9999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/services", () => {
    it("creates a service", async () => {
      const res = await request(app)
        .post("/api/services")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "New Service", description: "New desc" });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });

    it("rejects unauthenticated create", async () => {
      const res = await request(app)
        .post("/api/services")
        .send({ name: "New Service", description: "New desc" });
      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/services/:id", () => {
    it("updates a service", async () => {
      const service = await seedService();
      const res = await request(app)
        .put(`/api/services/${service.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated", description: "Updated desc" });
      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(true);
    });

    it("returns 404 for non-existent service", async () => {
      const res = await request(app)
        .put("/api/services/9999")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "X", description: "X" });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/services/:id", () => {
    it("soft-deletes a service", async () => {
      const service = await seedService();
      const res = await request(app)
        .delete(`/api/services/${service.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);

      const get = await request(app).get(`/api/services/${service.id}`);
      expect(get.status).toBe(404);
    });

    it("returns 404 for already-deleted service", async () => {
      const service = await seedService();
      await request(app)
        .delete(`/api/services/${service.id}`)
        .set("Authorization", `Bearer ${token}`);
      const res = await request(app)
        .delete(`/api/services/${service.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
