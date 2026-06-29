import app from "./app.js";
import { ensureUploadDirs } from "./middleware/upload.js";
import { runMigrations } from "./migrate.js";

const PORT = process.env.PORT ?? 3000;

// Apply pending DB migrations on boot. Fail-fast: if this throws, the process
// exits non-zero (container restarts) rather than serving a half-migrated DB.
await runMigrations();
await ensureUploadDirs();

app.listen(PORT, () => {
  console.log(`Cardinal running on :${PORT}`);
});
