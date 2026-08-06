import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import rateLimit from "express-rate-limit";

import authRouter from "./routes/auth.js";
import projectsRouter from "./routes/projects.js";
import servicesRouter from "./routes/services.js";
import blogRouter from "./routes/blog.js";
import uploadsRouter from "./routes/uploads.js";
import feedRouter from "./routes/feed.js";
import contactRouter from "./routes/contact.js";
import formacionRouter from "./routes/formacion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// The app is only ever reached through a reverse proxy (host nginx, and in the
// production profile a second nginx in front of it), which sets
// X-Forwarded-For. Without this Express reports the proxy's own address as
// req.ip, so express-rate-limit bucketed every visitor on the internet into a
// single 60/min counter.
//
// A hop COUNT would be wrong here — the compose nginx sits behind a `production`
// profile, so the chain is one proxy in some deployments and two in others.
// Trusting private/loopback ranges instead is correct for both: Express walks
// X-Forwarded-For right-to-left and stops at the first address outside those
// ranges, which is the real client. A public client that forges the header
// cannot promote itself, because nginx appends its true address to the right.
app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"]);

// Rate limit API routes. This is mounted BEFORE express.json() on purpose: a
// body-parser failure calls next(err) and skips every middleware after it, so
// with the limiter downstream a client could spend unlimited unthrottled
// requests just by sending malformed JSON.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  // Overridable only so the test suite can sweep every endpoint without
  // tripping the limiter — a 429 would mask a 500 and turn the validation
  // regression test into a false pass. Unset in every real deployment.
  max: Number(process.env.RATE_LIMIT_MAX ?? 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, try again later" },
});
app.use("/api", apiLimiter);

app.use(express.json());

// Uploads (persisted user content) — always served from public/uploads.
// nosniff stops a browser from re-interpreting a stored file as active content
// based on its bytes; the extension allow-list in middleware/upload.ts is what
// keeps the extension itself trustworthy.
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "public", "uploads"), {
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  })
);

// Banco images (portfolio image bank) — immutable hashed filenames, cache aggressively
app.use("/banco", express.static(path.join(__dirname, "..", "random-imgs", "banco-imagenes"), {
  maxAge: "6h",
}));

// Admin SPA
app.use("/admin", express.static(path.join(__dirname, "..", "admin")));

// api routes
app.use("/api/auth", authRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/services", servicesRouter);
app.use("/api/blog", blogRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/feed", feedRouter);
app.use("/api/contact", contactRouter);
app.use("/api/formacion", formacionRouter);

// Production: serve Vite-built frontend from dist/client
const clientDir = path.join(__dirname, "..", "dist", "client");
app.use(express.static(clientDir));

// Explicit routes for MPA pages
const pages = ["proyectos", "blog", "contacto", "servicios", "formacion"];
for (const page of pages) {
  app.get(`/${page}`, (_req, res) => {
    res.sendFile(path.join(clientDir, `${page}.html`));
  });
}

// Servicios detail pages — same HTML, slug parsed by client from location.pathname
app.get("/servicios/:slug", (_req, res) => {
  res.sendFile(path.join(clientDir, "servicios.html"));
});

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler. Must be last and must take four arguments for Express to
// recognise it. Without one, Express's default finalhandler answers with an
// HTML page containing err.stack — absolute paths, dependency layout and all —
// to any unauthenticated caller, unless NODE_ENV happens to be "production".
// Handling it here makes that independent of the environment variable.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err?.status ?? err?.statusCode ?? 500;

  // body-parser failures are client mistakes; report them without echoing the
  // parser's message, which quotes the offending payload back.
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large" });
  }

  if (status >= 500) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }

  res.status(status).json({ error: err?.message ?? "Bad request" });
});

export default app;
