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

    it("rejects unauthenticated update", async () => {
      const service = await seedService();
      const res = await request(app)
        .put(`/api/services/${service.id}`)
        .send({ name: "Hacked", description: "Hacked" });
      expect(res.status).toBe(401);
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

    it("rejects unauthenticated delete", async () => {
      const service = await seedService();
      const res = await request(app).delete(`/api/services/${service.id}`);
      expect(res.status).toBe(401);
    });
  });

  describe("i18n (_en fields)", () => {
    it("POST persists name_en and description_en, exposed via ?lang=en", async () => {
      const create = await request(app)
        .post("/api/services")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Mezcla",
          name_en: "Mixing",
          description: "Mezcla de audio",
          description_en: "Audio mixing",
        });
      expect(create.status).toBe(201);

      const en = await request(app).get(`/api/services/${create.body.id}?lang=en`);
      expect(en.body.name).toBe("Mixing");
      expect(en.body.description).toBe("Audio mixing");

      const es = await request(app).get(`/api/services/${create.body.id}?lang=es`);
      expect(es.body.name).toBe("Mezcla");
      expect(es.body.description).toBe("Mezcla de audio");
    });

    it("PUT updates _en fields, visible via ?lang=en", async () => {
      const service = await seedService("Original", "Desc");
      await request(app)
        .put(`/api/services/${service.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Original",
          description: "Desc",
          name_en: "Updated EN",
          description_en: "Updated EN desc",
        });
      const en = await request(app).get(`/api/services/${service.id}?lang=en`);
      expect(en.body.name).toBe("Updated EN");
      expect(en.body.description).toBe("Updated EN desc");
    });

    it("?lang=en falls back to Spanish when _en is null", async () => {
      const service = await seedService("Solo ES", "Solo descripción");
      const en = await request(app).get(`/api/services/${service.id}?lang=en`);
      expect(en.body.name).toBe("Solo ES");
      expect(en.body.description).toBe("Solo descripción");
    });
  });

  describe("slug generation", () => {
    it("POST generates slug from name (lowercased, hyphenated)", async () => {
      const create = await request(app)
        .post("/api/services")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Mezcla de Audio", description: "x" });
      const bySlug = await request(app).get("/api/services/by-slug/mezcla-de-audio");
      expect(bySlug.status).toBe(200);
      expect(bySlug.body.service.id).toBe(create.body.id);
    });

    it("PUT regenerates slug when name changes", async () => {
      const service = await seedService("Old Name", "x");
      await request(app)
        .put(`/api/services/${service.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Brand New Name", description: "x" });
      const bySlug = await request(app).get("/api/services/by-slug/brand-new-name");
      expect(bySlug.status).toBe(200);
      expect(bySlug.body.service.id).toBe(service.id);
    });
  });
});
