import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app.js";
import {
  seedUser,
  getAuthToken,
  seedProject,
  seedService,
  seedBlogEntry,
} from "./helpers.js";

/**
 * Property-based regression net for the write endpoints.
 *
 * The invariant, stated once and enforced everywhere:
 *
 *     No client input may ever produce a 5xx.
 *
 * Bad input is the client's problem (4xx). A 5xx means the server fell over —
 * which is exactly what used to happen: `slugify(name)` and `name?.trim()` ran
 * before anything was checked, so a missing field, a number, an array or an
 * over-length string threw from inside slugify/mysql2 and surfaced as
 * "Failed to create project" with a 500 and a stack trace in the logs.
 *
 * Each endpoint is swept as one test that loops over every field × every
 * hostile value, collecting violations rather than failing on the first. A
 * failure therefore names every broken combination at once instead of hiding
 * the rest behind the first assertion.
 *
 * Adding an endpoint to WRITE_ENDPOINTS is all it takes to bring it under the
 * same guarantee — that is the point of doing this as a table rather than as
 * per-case tests.
 */

/** Inputs a hostile or careless client can realistically send. */
const HOSTILE_VALUES: { label: string; value: unknown }[] = [
  { label: "missing", value: undefined },
  { label: "null", value: null },
  { label: "number", value: 123 },
  { label: "zero", value: 0 },
  { label: "true", value: true },
  { label: "false", value: false },
  { label: "array", value: ["a", "b"] },
  { label: "object", value: { a: 1 } },
  { label: "empty string", value: "" },
  { label: "whitespace only", value: "   " },
  { label: "10k chars", value: "A".repeat(10_000) },
  { label: "70k bytes", value: "\u{1F600}".repeat(20_000) },
];

interface EndpointCase {
  name: string;
  method: "post" | "put";
  /** Built per-test so it can reference rows seeded in beforeEach. */
  path: () => string;
  /** A body that must succeed, proving validation is not simply refusing all. */
  valid: () => Record<string, unknown>;
  /** Fields to substitute hostile values into. */
  fields: string[];
  auth: boolean;
}

describe("Input validation — no client input may produce a 5xx", () => {
  let token: string;
  let projectId: number;
  let serviceId: number;
  let blogId: number;

  beforeEach(async () => {
    const user = await seedUser();
    token = getAuthToken(user.id, user.email);

    projectId = (await seedProject()).id;
    serviceId = (await seedService()).id;
    blogId = (await seedBlogEntry()).id;

    // formacion_page is a singleton that neither db_build.sql nor the
    // migrations seed, so PUT /api/formacion would 404 before reaching the
    // happy-path assertion. Create row 1 if it is not already there.
    const { default: pool } = await import("../db.js");
    await pool.query(
      `INSERT INTO formacion_page (id, intro) VALUES (1, 'seed intro')
       ON DUPLICATE KEY UPDATE intro = VALUES(intro)`
    );
  });

  const ENDPOINTS = (): EndpointCase[] => [
    {
      name: "POST /api/projects",
      method: "post",
      path: () => "/api/projects",
      valid: () => ({ name: "Valid Project", writeup: "w", img_url: "/i.webp" }),
      fields: ["name", "writeup", "img_url"],
      auth: true,
    },
    {
      name: "PUT /api/projects/:id",
      method: "put",
      path: () => `/api/projects/${projectId}`,
      valid: () => ({ name: "Renamed", writeup: "w", img_url: "/i.webp" }),
      fields: ["name", "writeup", "img_url"],
      auth: true,
    },
    {
      name: "POST /api/services",
      method: "post",
      path: () => "/api/services",
      valid: () => ({ name: "Valid Service", description: "d" }),
      fields: ["name", "description"],
      auth: true,
    },
    {
      name: "PUT /api/services/:id",
      method: "put",
      path: () => `/api/services/${serviceId}`,
      valid: () => ({ name: "Renamed Service", description: "d" }),
      fields: ["name", "description"],
      auth: true,
    },
    {
      name: "POST /api/blog",
      method: "post",
      path: () => "/api/blog",
      valid: () => ({ title: "Valid Post", category: "general", type: "post" }),
      fields: ["title", "category", "type", "writeup"],
      auth: true,
    },
    {
      name: "PUT /api/blog/:id",
      method: "put",
      path: () => `/api/blog/${blogId}`,
      valid: () => ({ title: "Renamed Post", category: "general", type: "post" }),
      fields: ["title", "category", "type", "writeup"],
      auth: true,
    },
    {
      name: "POST /api/services/:id/images",
      method: "post",
      path: () => `/api/services/${serviceId}/images`,
      valid: () => ({ img_url: "/uploads/images/x.webp" }),
      fields: ["img_url", "mobile_img_url", "caption", "sort_order"],
      auth: true,
    },
    {
      name: "POST /api/formacion/images",
      method: "post",
      path: () => "/api/formacion/images",
      valid: () => ({ img_url: "/uploads/images/x.webp" }),
      fields: ["img_url", "mobile_img_url", "sort_order"],
      auth: true,
    },
    {
      name: "PUT /api/formacion",
      method: "put",
      path: () => "/api/formacion",
      valid: () => ({ intro: "Some intro copy" }),
      fields: ["intro", "intro_en"],
      auth: true,
    },
    {
      name: "POST /api/projects/:id/services",
      method: "post",
      path: () => `/api/projects/${projectId}/services`,
      valid: () => ({ service_id: serviceId }),
      fields: ["service_id"],
      auth: true,
    },
    {
      // Public and unauthenticated — the only one a stranger can reach, and the
      // one where `name?.trim()` used to throw on any non-string.
      name: "POST /api/contact",
      method: "post",
      path: () => "/api/contact",
      valid: () => ({ name: "Ana", email: "ana@example.com", message: "hola" }),
      fields: ["name", "email", "message"],
      auth: false,
    },
  ];

  for (const endpoint of ENDPOINTS()) {
    it(`${endpoint.name} — never 5xx on hostile input`, async () => {
      const violations: string[] = [];

      for (const field of endpoint.fields) {
        for (const { label, value } of HOSTILE_VALUES) {
          const body: Record<string, unknown> = { ...endpoint.valid() };
          if (value === undefined) delete body[field];
          else body[field] = value;

          let req = request(app)[endpoint.method](endpoint.path());
          if (endpoint.auth) req = req.set("Authorization", `Bearer ${token}`);
          const res = await req.send(body);

          // 429 would also be "< 500" but proves nothing about validation, so
          // it is treated as a violation: the limiter must not mask a crash.
          if (res.status >= 500 || res.status === 429) {
            violations.push(`${field}=${label} -> ${res.status}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  }

  // A validator that rejected everything would satisfy the sweep above while
  // breaking the CMS, so pin the happy path too.
  for (const endpoint of ENDPOINTS()) {
    it(`${endpoint.name} — still accepts a valid body`, async () => {
      let req = request(app)[endpoint.method](endpoint.path());
      if (endpoint.auth) req = req.set("Authorization", `Bearer ${token}`);
      const res = await req.send(endpoint.valid());
      expect(res.status).toBeLessThan(400);
    });
  }
});

describe("Slug allocation never 500s", () => {
  let token: string;

  beforeEach(async () => {
    const user = await seedUser();
    token = getAuthToken(user.id, user.email);
  });

  it("accepts a duplicate name by suffixing the slug", async () => {
    const body = { name: "Repeated Name", description: "d" };
    const first = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    const second = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const { default: pool } = await import("../db.js");
    const [rows]: any = await pool.query(
      "SELECT slug FROM services WHERE name = ? ORDER BY id",
      [body.name]
    );
    expect(rows.map((r: any) => r.slug)).toEqual([
      "repeated-name",
      "repeated-name-2",
    ]);
  });

  it("handles names with no ASCII alphanumerics", async () => {
    // slugify() returns "" for these; the UNIQUE index used to reject the
    // second one with ER_DUP_ENTRY, surfaced as a 500.
    for (const name of ["日本語", "---", "???"]) {
      const res = await request(app)
        .post("/api/services")
        .set("Authorization", `Bearer ${token}`)
        .send({ name, description: "d" });
      expect(res.status).toBe(201);
    }

    const { default: pool } = await import("../db.js");
    const [rows]: any = await pool.query("SELECT slug FROM services");
    const slugs = rows.map((r: any) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length); // all distinct
    expect(slugs).not.toContain("");
  });

  it("keeps a row's own slug when re-saved unchanged", async () => {
    const created = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Stable Name", description: "d" });

    await request(app)
      .put(`/api/services/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Stable Name", description: "changed" });

    const { default: pool } = await import("../db.js");
    const [rows]: any = await pool.query(
      "SELECT slug FROM services WHERE id = ?",
      [created.body.id]
    );
    // Must not drift to stable-name-2 just because the row matched itself.
    expect(rows[0].slug).toBe("stable-name");
  });
});

describe("Malformed requests answer JSON, not an HTML stack trace", () => {
  it("returns a JSON 400 for an unparseable body", async () => {
    const res = await request(app)
      .post("/api/contact")
      .set("Content-Type", "application/json")
      .send("not json at all");

    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: "Invalid JSON body" });
  });

  it("never leaks a filesystem path or stack frame", async () => {
    const res = await request(app)
      .post("/api/contact")
      .set("Content-Type", "application/json")
      .send("{ broken");

    const raw = res.text ?? JSON.stringify(res.body);
    expect(raw).not.toMatch(/node_modules/);
    expect(raw).not.toMatch(/\bat .*:\d+:\d+/); // stack frame
  });

  it("rejects an oversized body as JSON", async () => {
    const res = await request(app)
      .post("/api/contact")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ name: "a", email: "a@b.co", message: "x".repeat(200_000) }));

    expect(res.status).toBe(413);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });
});

describe("Query parameters cannot crash a listing", () => {
  const CASES = [
    "?offset=99999999999999999999",
    "?offset=-5",
    "?limit=abc",
    "?limit=-1",
    "?limit=1e10",
    "?type[]=a&type[]=b",
    "?offset[]=1&offset[]=2",
    "?lang=notalang",
  ];

  for (const qs of CASES) {
    it(`GET /api/blog${qs} does not 5xx`, async () => {
      const res = await request(app).get(`/api/blog${qs}`);
      expect(res.status).toBeLessThan(500);
    });
  }
});

describe("Rate limiter runs before the body parser", () => {
  it("charges a malformed body against the caller's budget", async () => {
    // The limiter used to sit after express.json(), so a parse failure called
    // next(err) and skipped it entirely — unlimited unthrottled requests.
    const ip = "203.0.113.99";

    const first = await request(app)
      .post("/api/contact")
      .set("X-Forwarded-For", ip)
      .set("Content-Type", "application/json")
      .send({ name: "Ana", email: "ana@example.com", message: "hola" });

    const before = Number(first.headers["ratelimit-remaining"]);
    expect(Number.isFinite(before)).toBe(true);

    const malformed = await request(app)
      .post("/api/contact")
      .set("X-Forwarded-For", ip)
      .set("Content-Type", "application/json")
      .send("garbage");

    expect(malformed.status).toBe(400);
    const after = Number(malformed.headers["ratelimit-remaining"]);

    // The malformed request must carry limiter headers and consume budget.
    expect(Number.isFinite(after)).toBe(true);
    expect(after).toBeLessThan(before);
  });

  it("gives different client IPs separate budgets", async () => {
    // Without app.set("trust proxy", …) every visitor shared one counter,
    // so one client could lock the whole API out for everyone else.
    const a = await request(app)
      .get("/api/services")
      .set("X-Forwarded-For", "203.0.113.1");
    const b = await request(app)
      .get("/api/services")
      .set("X-Forwarded-For", "203.0.113.2");

    // Two distinct clients, each on their first request, must report the same
    // remaining budget — proving the counters are not shared.
    expect(a.headers["ratelimit-remaining"]).toBe(b.headers["ratelimit-remaining"]);
  });
});
