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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

// Uploads (persisted user content) — always served from public/uploads
app.use("/uploads", express.static(path.join(__dirname, "..", "public", "uploads")));

// Banco images (portfolio image bank) — immutable hashed filenames, cache aggressively
app.use("/banco", express.static(path.join(__dirname, "..", "random-imgs", "banco-imagenes"), {
  maxAge: "6h",
}));

// Admin SPA
app.use("/admin", express.static(path.join(__dirname, "..", "admin")));

// rate limit on API routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, try again later" },
});
app.use("/api", apiLimiter);

// api routes
app.use("/api/auth", authRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/services", servicesRouter);
app.use("/api/blog", blogRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/feed", feedRouter);
app.use("/api/contact", contactRouter);

// Production: serve Vite-built frontend from dist/client
const clientDir = path.join(__dirname, "..", "dist", "client");
app.use(express.static(clientDir));

// Explicit routes for MPA pages
const pages = ["proyectos", "blog", "contacto", "servicios"];
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

export default app;
