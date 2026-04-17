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

export const IMAGE_MAX_MB = 25;
export const AUDIO_MAX_MB = 100;

const uploadImageMw = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: IMAGE_MAX_MB * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		if (IMAGE_MIMES.includes(file.mimetype)) cb(null, true);
		else cb(new Error("Only image files are allowed"));
	},
}).single("file");

const uploadAudioMw = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: AUDIO_MAX_MB * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		if (AUDIO_MIMES.includes(file.mimetype)) cb(null, true);
		else cb(new Error("Only audio files are allowed"));
	},
}).single("file");

function wrapUpload(mw: any, maxMb: number, kind: string) {
	return (req: Request, res: Response, next: NextFunction) => {
		mw(req, res, (err: any) => {
			if (!err) return next();
			if (err.code === "LIMIT_FILE_SIZE") {
				return res.status(413).json({
					error: `El ${kind} supera el tamaño máximo de ${maxMb} MB`,
					maxSizeMB: maxMb,
				});
			}
			return res.status(400).json({ error: err.message || "Upload failed" });
		});
	};
}

export const uploadImage = wrapUpload(uploadImageMw, IMAGE_MAX_MB, "imagen");
export const uploadAudio = wrapUpload(uploadAudioMw, AUDIO_MAX_MB, "audio");

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

		// desktop: max 1280px wide, WebP quality 80
		await sharp(req.file.buffer)
			.resize({ width: 1280, withoutEnlargement: true })
			.webp({ quality: 80 })
			.toFile(fullPath);

		// mobile: max 640px wide, WebP quality 75
		await sharp(req.file.buffer)
			.resize({ width: 640, withoutEnlargement: true })
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
