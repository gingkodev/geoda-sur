import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  uploadImage,
  uploadAudio,
  processImage,
  processAudio,
} from "../middleware/upload.js";
import type { Request, Response } from "express";

const router = Router();

router.post(
  "/image",
  requireAuth,
  uploadImage,
  processImage,
  (req: Request, res: Response) => {
    res.json((req as any).uploadResult);
  }
);

router.post(
  "/audio",
  requireAuth,
  uploadAudio,
  processAudio,
  (req: Request, res: Response) => {
    res.json((req as any).uploadResult);
  }
);

export default router;
