import multer from "multer";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Request, Response, NextFunction } from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, "..", "..", "public", "uploads");
const IMAGES_DIR = path.join(UPLOADS_ROOT, "images");
const MOBILE_DIR = path.join(IMAGES_DIR, "mobile");
const AUDIO_DIR = path.join(UPLOADS_ROOT, "audio");

export async function ensureUploadDirs() {
	await fs.mkdir(MOBILE_DIR, { recursive: true });
	await fs.mkdir(AUDIO_DIR, { recursive: true });
}

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const AUDIO_MIMES = [
	"audio/mpeg",
	"audio/mp3",
	"audio/wav",
	"audio/ogg",
	"audio/flac",
	"audio/aac",
	"audio/mp4",
	"audio/x-m4a"
];

export const uploadImage = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 10 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		if (IMAGE_MIMES.includes(file.mimetype)) cb(null, true);
		else cb(new Error("Only image files are allowed"));
	},
}).single("file");

export const uploadAudio = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 50 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		if (AUDIO_MIMES.includes(file.mimetype)) cb(null, true);
		else cb(new Error("Only audio files are allowed"));
	},
}).single("file");

export async function processImage(
	req: Request,
	res: Response,
	next: NextFunction
) {
	if (!req.file) return res.status(400).json({ error: "No file provided" });

	try {
		const filename = `${randomUUID()}.webp`;
		const fullPath = path.join(IMAGES_DIR, filename);
		const mobilePath = path.join(MOBILE_DIR, filename);

		// full-size: max 1920px wide, WebP quality 80
		await sharp(req.file.buffer)
			.resize({ width: 1920, withoutEnlargement: true })
			.webp({ quality: 80 })
			.toFile(fullPath);

		// mobile: max 800px wide, WebP quality 75
		await sharp(req.file.buffer)
			.resize({ width: 800, withoutEnlargement: true })
			.webp({ quality: 75 })
			.toFile(mobilePath);

		(req as any).uploadResult = {
			url: `/uploads/images/${filename}`,
			mobileUrl: `/uploads/images/mobile/${filename}`,
		};
		next();
	} catch (err) {
		console.error("Image processing failed:", err);
		res.status(500).json({ error: "Image processing failed" });
	}
}

export async function processAudio(
	req: Request,
	res: Response,
	next: NextFunction
) {
	if (!req.file) return res.status(400).json({ error: "No file provided" });

	try {
		const ext = path.extname(req.file.originalname).toLowerCase() || ".mp3";
		const filename = `${randomUUID()}${ext}`;
		const filePath = path.join(AUDIO_DIR, filename);

		await fs.writeFile(filePath, req.file.buffer);

		(req as any).uploadResult = {
			url: `/uploads/audio/${filename}`,
		};
		next();
	} catch (err) {
		console.error("Audio save failed:", err);
		res.status(500).json({ error: "Audio save failed" });
	}
}
