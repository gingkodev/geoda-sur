import app from "./app.js";
import { ensureUploadDirs } from "./middleware/upload.js";

const PORT = process.env.PORT ?? 3000;

await ensureUploadDirs();

app.listen(PORT, () => {
  console.log(`Cardinal running on :${PORT}`);
});
