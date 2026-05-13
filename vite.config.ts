import { resolve } from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "frontend",
  plugins: [
    tailwindcss(),
    {
      name: "servicios-slug-rewrite",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && /^\/servicios\/[^/?#]+/.test(req.url)) {
            req.url = "/servicios.html";
          }
          next();
        });
      },
    },
  ],
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "frontend/index.html"),
        proyectos: resolve(__dirname, "frontend/proyectos.html"),
        blog: resolve(__dirname, "frontend/blog.html"),
        contacto: resolve(__dirname, "frontend/contacto.html"),
        servicios: resolve(__dirname, "frontend/servicios.html"),
      },
    },
  },
  server: {
    host: true,
    allowedHosts: ["cardinal.meteorobalboa.com"],
    proxy: {
      "/api": "http://localhost:3000",
      "/admin": "http://localhost:3000",
      "/uploads": "http://localhost:3000",
      "/banco/": "http://localhost:3000",
    },
  },
});
