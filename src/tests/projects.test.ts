import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app.js";
import {
  seedUser,
  getAuthToken,
  seedProject,
  seedService,
  linkProjectService,
} from "./helpers.js";

describe("Projects Routes", () => {
  let token: string;

  beforeEach(async () => {
    const user = await seedUser();
    token = getAuthToken(user.id, user.email);
  });

  describe("GET /api/projects", () => {
    it("returns empty array when no projects", async () => {
      const res = await request(app).get("/api/projects");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("returns projects with service_ids", async () => {
      const project = await seedProject();
      const service = await seedService();
      await linkProjectService(project.id, service.id);

      const res = await request(app).get("/api/projects");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("Test Project");
      expect(res.body[0].service_ids).toEqual([service.id]);
    });

    it("returns empty service_ids for project with no services", async () => {
      await seedProject();
      const res = await request(app).get("/api/projects");
      expect(res.body[0].service_ids).toEqual([]);
    });

    it("excludes soft-deleted projects", async () => {
      await seedProject();
      const { default: pool } = await import("../db.js");
      await pool.query("UPDATE projects SET is_deleted = 1");
      const res = await request(app).get("/api/projects");
      expect(res.body).toEqual([]);
    });

    it("returns multiple projects with correct service_ids", async () => {
      const p1 = await seedProject("Project A");
      const p2 = await seedProject("Project B");
      const s1 = await seedService("Service 1");
      const s2 = await seedService("Service 2");
      await linkProjectService(p1.id, s1.id);
      await linkProjectService(p1.id, s2.id);
      await linkProjectService(p2.id, s2.id);

      const res = await request(app).get("/api/projects");
      expect(res.body).toHaveLength(2);
      const projA = res.body.find((p: any) => p.name === "Project A");
      const projB = res.body.find((p: any) => p.name === "Project B");
      expect(projA.service_ids).toHaveLength(2);
      expect(projB.service_ids).toEqual([s2.id]);
    });
  });

  describe("GET /api/projects/:id", () => {
    it("returns a single project with service_ids", async () => {
      const project = await seedProject();
      const service = await seedService();
      await linkProjectService(project.id, service.id);

      const res = await request(app).get(`/api/projects/${project.id}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Test Project");
      expect(res.body.service_ids).toEqual([service.id]);
    });

    it("returns 404 for non-existent project", async () => {
      const res = await request(app).get("/api/projects/9999");
      expect(res.status).toBe(404);
    });

    it("returns 404 for soft-deleted project", async () => {
      const project = await seedProject();
      const { default: pool } = await import("../db.js");
      await pool.query("UPDATE projects SET is_deleted = 1 WHERE id = ?", [project.id]);
      const res = await request(app).get(`/api/projects/${project.id}`);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/projects", () => {
    it("creates a project", async () => {
      const res = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "New", writeup: "Content", img_url: "/img.webp" });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });

    it("rejects unauthenticated create", async () => {
      const res = await request(app)
        .post("/api/projects")
        .send({ name: "New", writeup: "Content", img_url: "/img.webp" });
      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/projects/:id", () => {
    it("updates a project", async () => {
      const project = await seedProject();
      const res = await request(app)
        .put(`/api/projects/${project.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated", writeup: "New content", img_url: "/new.webp" });
      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(true);
    });

    it("returns 404 for non-existent project", async () => {
      const res = await request(app)
        .put("/api/projects/9999")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "X", writeup: "X", img_url: "/x.webp" });
      expect(res.status).toBe(404);
    });

    it("rejects unauthenticated update", async () => {
      const project = await seedProject();
      const res = await request(app)
        .put(`/api/projects/${project.id}`)
        .send({ name: "Hacked", writeup: "Hacked", img_url: "/x.webp" });
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/projects/:id", () => {
    it("soft-deletes a project", async () => {
      const project = await seedProject();
      const res = await request(app)
        .delete(`/api/projects/${project.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);

      const get = await request(app).get(`/api/projects/${project.id}`);
      expect(get.status).toBe(404);
    });

    it("returns 404 for already-deleted project", async () => {
      const project = await seedProject();
      await request(app)
        .delete(`/api/projects/${project.id}`)
        .set("Authorization", `Bearer ${token}`);
      const res = await request(app)
        .delete(`/api/projects/${project.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it("rejects unauthenticated delete", async () => {
      const project = await seedProject();
      const res = await request(app).delete(`/api/projects/${project.id}`);
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/projects/:id/services", () => {
    it("links a service to a project", async () => {
      const project = await seedProject();
      const service = await seedService();
      const res = await request(app)
        .post(`/api/projects/${project.id}/services`)
        .set("Authorization", `Bearer ${token}`)
        .send({ service_id: service.id });
      expect(res.status).toBe(201);
      expect(res.body.linked).toBe(true);
    });

    it("rejects duplicate link", async () => {
      const project = await seedProject();
      const service = await seedService();
      await linkProjectService(project.id, service.id);
      const res = await request(app)
        .post(`/api/projects/${project.id}/services`)
        .set("Authorization", `Bearer ${token}`)
        .send({ service_id: service.id });
      expect(res.status).toBe(409);
    });

    it("rejects unauthenticated link", async () => {
      const project = await seedProject();
      const service = await seedService();
      const res = await request(app)
        .post(`/api/projects/${project.id}/services`)
        .send({ service_id: service.id });
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/projects/:id/services/:serviceId", () => {
    it("unlinks a service from a project", async () => {
      const project = await seedProject();
      const service = await seedService();
      await linkProjectService(project.id, service.id);
      const res = await request(app)
        .delete(`/api/projects/${project.id}/services/${service.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.unlinked).toBe(true);
    });

    it("returns 404 for non-existent link", async () => {
      const res = await request(app)
        .delete("/api/projects/9999/services/9999")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it("rejects unauthenticated unlink", async () => {
      const project = await seedProject();
      const service = await seedService();
      await linkProjectService(project.id, service.id);
      const res = await request(app).delete(
        `/api/projects/${project.id}/services/${service.id}`
      );
      expect(res.status).toBe(401);
    });
  });

  describe("i18n (_en fields)", () => {
    it("POST persists name_en + writeup_en, ?lang=en returns English", async () => {
      const create = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Proyecto",
          name_en: "Project",
          writeup: "Descripción",
          writeup_en: "Writeup",
          img_url: "/img.webp",
        });
      expect(create.status).toBe(201);

      const en = await request(app).get(`/api/projects/${create.body.id}?lang=en`);
      expect(en.body.name).toBe("Project");
      expect(en.body.writeup).toBe("Writeup");

      const es = await request(app).get(`/api/projects/${create.body.id}?lang=es`);
      expect(es.body.name).toBe("Proyecto");
      expect(es.body.writeup).toBe("Descripción");
    });

    it("PUT updates _en fields, visible via ?lang=en", async () => {
      const project = await seedProject("Original", "Original writeup");
      await request(app)
        .put(`/api/projects/${project.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Original",
          writeup: "Original writeup",
          name_en: "Updated EN",
          writeup_en: "Updated EN writeup",
          img_url: "/img.webp",
        });
      const en = await request(app).get(`/api/projects/${project.id}?lang=en`);
      expect(en.body.name).toBe("Updated EN");
      expect(en.body.writeup).toBe("Updated EN writeup");
    });

    it("?lang=en falls back to Spanish when _en is null", async () => {
      const project = await seedProject("Solo ES", "Solo writeup");
      const en = await request(app).get(`/api/projects/${project.id}?lang=en`);
      expect(en.body.name).toBe("Solo ES");
      expect(en.body.writeup).toBe("Solo writeup");
    });
  });

  describe("slug generation", () => {
    it("POST writes a slug derived from name", async () => {
      const create = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Sala Brut", writeup: "x", img_url: "/img.webp" });
      const { default: pool } = await import("../db.js");
      const [rows] = await pool.query<any[]>(
        "SELECT slug FROM projects WHERE id = ?",
        [create.body.id]
      );
      expect(rows[0].slug).toBe("sala-brut");
    });

    it("PUT regenerates slug when name changes", async () => {
      const project = await seedProject("Old Name", "x");
      await request(app)
        .put(`/api/projects/${project.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Brand New Name", writeup: "x", img_url: "/img.webp" });
      const { default: pool } = await import("../db.js");
      const [rows] = await pool.query<any[]>(
        "SELECT slug FROM projects WHERE id = ?",
        [project.id]
      );
      expect(rows[0].slug).toBe("brand-new-name");
    });
  });
});
