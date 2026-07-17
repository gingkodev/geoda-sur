import "../shared/styles.css";
import { initCursor } from "../shared/cursor";
import { initNav, initMobileNav } from "../shared/nav";
import { getBlog, type BlogEntry } from "../shared/api";
import { t } from "../shared/i18n";

// Blog cards: light box, black type, dashed outline at rest; hover inverts to a
// solid black box with light type (the dashed border vanishes against black).
const CARD_BG = "#F9F9F9";
const CARD_TEXT = "#000000";
const HOVER_BG = "#000000";
const HOVER_TEXT = "#F9F9F9";

// p5.js globals
declare const createCanvas: any;
declare const windowWidth: number;
declare const windowHeight: number;
declare const resizeCanvas: any;
declare const clear: any;
declare const push: any;
declare const pop: any;
declare const translate: any;
declare const rotate: any;
declare const image: any;
declare const loadImage: any;
declare const frameCount: number;
declare const drawingContext: any;
declare const width: number;
declare const height: number;
declare const mouseX: number;
declare const mouseY: number;

// --- State ---
let offsetX = 0;
let offsetY = 0;
let targetOffsetX = 0;
let targetOffsetY = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

interface BlogCanvasItem extends BlogEntry {
	x: number;
	y: number;
	w: number;
	h: number;
	bgColor: string;
}

let items: BlogCanvasItem[] = [];
let cardEls: HTMLElement[] = [];
let selectedItem: number | null = null;
let audioElements: Record<number, HTMLAudioElement> = {};

interface Doodle {
	x: number; // world rest position
	y: number;
	imgIndex: number;
	size: number;
	phaseX: number; // idle-drift phase, per axis so the path loops instead of tracing a line
	phaseY: number;
	ox: number; // push displacement from rest (world units)
	oy: number;
	vx: number; // push velocity
	vy: number;
}

let doodles: Doodle[] = [];

// Doodle PNGs — uniform random pick per doodle, glob order doesn't matter here.
const DOODLE_IMAGE_URLS = Object.values(
	import.meta.glob("./doodles/*.png", { eager: true, query: "?url", import: "default" })
) as string[];
let doodleImages: any[] = [];

const DOODLE_SIZE_MIN = 96;// px — PNGs carry more detail than the old procedural primitives
const DOODLE_SIZE_MAX = 130;

// Idle drift — small per-doodle wander so the field feels alive at rest.
const DRIFT_AMP = 24; // px
const DRIFT_SPEED = 0.01; // rad/frame — ~10.5s period at 60fps

// Mouse-velocity push — doodles near the cursor get shoved away, then spring home.
const PUSH_RADIUS = 140; // world px
const PUSH_STRENGTH = 0.08; // tune to taste — scales (falloff * mouse speed) into a velocity impulse
const DAMPING = 0.88;
const SPRING_K = 0.02;
const MOUSE_SPEED_CLAMP = 60; // px/frame, clamps tracked cursor speed before it drives the push

let mouseVelX = 0;
let mouseVelY = 0;

const worldEl = document.getElementById("world");
const viewportEl = document.getElementById("viewport");

const isMobile = window.innerWidth < 768;

// --- Init ---
initCursor();
if (isMobile) {
	initMobileNav(document.getElementById("nav"));
} else {
	initNav(document.getElementById("nav"));
}

// --- Fetch + render ---
// Translate empty state
const blogEmptyEl = document.getElementById("mobile-blog-empty");
if (blogEmptyEl) blogEmptyEl.textContent = t("blog.empty");

getBlog(0, 40)
	.then((res) => {
		if (isMobile) {
			renderMobileBlog(res.data);
			document.getElementById("mobile-blog")!.style.display = "block";
			if (location.hash) {
				const target = document.getElementById(location.hash.slice(1));
				if (target) target.scrollIntoView({ behavior: "smooth" });
			}
		} else {
			buildBlogItems(res.data);
			if (viewportEl) viewportEl.style.display = "";
			if (location.hash) {
				const slug = location.hash.slice(1);
				const idx = res.data.findIndex((e) => e.slug === slug);
				if (idx !== -1) selectItem(idx);
			}
		}
	})
	.catch((err) => {
		console.error("Blog fetch failed:", err);
		if (isMobile) {
			document.getElementById("mobile-blog")!.style.display = "block";
			document.getElementById("mobile-blog-empty")!.classList.remove("hidden");
		}
	});

// --- Mobile ---
function renderMobileBlog(entries: BlogEntry[]) {
	const container = document.getElementById("mobile-blog-cards")!;
	if (!entries.length) {
		document.getElementById("mobile-blog-empty")!.classList.remove("hidden");
		return;
	}
	for (const entry of entries) {
		const card = document.createElement("div");
		card.className = "p-3.5 text-[11px] leading-[15px] border border-dashed border-black/60";
		card.style.backgroundColor = CARD_BG;
		card.style.color = CARD_TEXT;
		if (entry.slug) card.id = entry.slug;
		card.innerHTML = `
      <div class="flex justify-between items-start mb-1">
        <span>${new Date(entry.date_created).toLocaleDateString()}</span>
        <div class="text-right">
          <div>${entry.category.toUpperCase()}</div>
          <div class="mt-0.5">${entry.type.toUpperCase()}</div>
        </div>
      </div>
      <div class="font-medium mb-1">${entry.title.toUpperCase()}</div>
      ${entry.writeup ? `<div class="mt-1.5 overflow-hidden">${truncate(entry.writeup.toUpperCase(), 200)}</div>` : ""}
      ${entry.audio_url ? `<audio controls src="${entry.audio_url}" class="mt-2 w-full h-6"></audio>` : ""}
    `;
		container.appendChild(card);
	}
}

function truncate(str: string, max: number) {
	return str.length <= max ? str : str.substring(0, max).trimEnd() + "...";
}

// --- Desktop canvas items ---
const typeStyles: Record<string, { bgColor: string; w: number; h: number }> = {
	post: { bgColor: CARD_BG, w: 380, h: 220 },
	audio: { bgColor: CARD_BG, w: 350, h: 72 },
	note: { bgColor: CARD_BG, w: 340, h: 140 },
};

function buildBlogItems(entries: BlogEntry[]) {
	items = entries.map((entry) => {
		const style = typeStyles[entry.type] ?? typeStyles.post;
		const r = Math.pow(Math.random(), 0.5) * 600 + 100;
		const angle = Math.random() * Math.PI * 2;
		return {
			...entry,
			x: Math.cos(angle) * r,
			y: Math.sin(angle) * r,
			w: style.w + (Math.random() - 0.5) * 40,
			h: style.h + (Math.random() - 0.5) * 20,
			bgColor: style.bgColor,
		};
	});
	separateItems();
	generateDoodles();
	renderCards();
}

function separateItems() {
	for (let pass = 0; pass < 80; pass++) {
		let moved = false;
		for (let i = 0; i < items.length; i++) {
			for (let j = i + 1; j < items.length; j++) {
				const a = items[i];
				const b = items[j];
				const pad = 35;
				const ox1 = Math.max(a.x - pad, b.x - pad);
				const oy1 = Math.max(a.y - pad, b.y - pad);
				const ox2 = Math.min(a.x + a.w + pad, b.x + b.w + pad);
				const oy2 = Math.min(a.y + a.h + pad, b.y + b.h + pad);
				if (ox2 <= ox1 || oy2 <= oy1) continue;

				const overlapX = ox2 - ox1;
				const overlapY = oy2 - oy1;
				if (overlapX < overlapY) {
					const p = overlapX * 0.55 * (a.x < b.x ? -1 : 1);
					a.x += p;
					b.x -= p;
				} else {
					const p = overlapY * 0.55 * (a.y < b.y ? -1 : 1);
					a.y += p;
					b.y -= p;
				}
				moved = true;
			}
		}
		if (!moved) break;
	}
}

// --- Doodles ---
function poissonDiskSampling(w: number, h: number, minDist: number, k = 30) {
	const cellSize = minDist / Math.sqrt(2);
	const cols = Math.ceil(w / cellSize);
	const rows = Math.ceil(h / cellSize);
	const grid: ({ x: number; y: number } | null)[] = new Array(cols * rows).fill(null);
	const active: { x: number; y: number }[] = [];
	const points: { x: number; y: number }[] = [];

	const x0 = Math.random() * w;
	const y0 = Math.random() * h;
	const p0 = { x: x0, y: y0 };
	points.push(p0);
	active.push(p0);
	grid[Math.floor(x0 / cellSize) + Math.floor(y0 / cellSize) * cols] = p0;

	while (active.length > 0) {
		const randIdx = Math.floor(Math.random() * active.length);
		const pos = active[randIdx];
		let found = false;

		for (let n = 0; n < k; n++) {
			const ang = Math.random() * Math.PI * 2;
			const r = minDist + Math.random() * minDist;
			const x = pos.x + r * Math.cos(ang);
			const y = pos.y + r * Math.sin(ang);
			if (x < 0 || x >= w || y < 0 || y >= h) continue;

			const col = Math.floor(x / cellSize);
			const row = Math.floor(y / cellSize);
			let ok = true;
			for (let di = -1; di <= 1 && ok; di++) {
				for (let dj = -1; dj <= 1 && ok; dj++) {
					const ni = col + di;
					const nj = row + dj;
					if (ni >= 0 && ni < cols && nj >= 0 && nj < rows) {
						const neighbor = grid[ni + nj * cols];
						if (neighbor) {
							const dx = neighbor.x - x;
							const dy = neighbor.y - y;
							if (dx * dx + dy * dy < minDist * minDist) ok = false;
						}
					}
				}
			}

			if (ok) {
				const np = { x, y };
				points.push(np);
				active.push(np);
				grid[col + row * cols] = np;
				found = true;
				break;
			}
		}

		if (!found) active.splice(randIdx, 1);
	}

	return points;
}

function generateDoodles() {
	doodles = [];
	const points = poissonDiskSampling(2400, 1800, 250);
	for (const pt of points) {
		doodles.push({
			x: pt.x - 1200,
			y: pt.y - 900,
			imgIndex: Math.floor(Math.random() * DOODLE_IMAGE_URLS.length),
			size: DOODLE_SIZE_MIN + Math.random() * (DOODLE_SIZE_MAX - DOODLE_SIZE_MIN),
			phaseX: Math.random() * Math.PI * 2,
			phaseY: Math.random() * Math.PI * 2,
			ox: 0,
			oy: 0,
			vx: 0,
			vy: 0,
		});
	}
}

// Push-physics + spring-back integration, run every frame for every doodle
// (only ~100 of them — trivial). Runs unconditionally, independent of
// which doodles are actually on-screen, so off-screen ones keep springing
// home instead of freezing mid-displacement.
function updateDoodlePhysics() {
	const worldMouseX = mouseX - width / 2 + offsetX;
	const worldMouseY = mouseY - height / 2 + offsetY;
	const mouseSpeed = Math.sqrt(mouseVelX * mouseVelX + mouseVelY * mouseVelY);

	for (const d of doodles) {
		const px = d.x + d.ox;
		const py = d.y + d.oy;
		const dx = px - worldMouseX;
		const dy = py - worldMouseY;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist > 0.01 && dist < PUSH_RADIUS) {
			const t = 1 - dist / PUSH_RADIUS;
			const falloff = t * t; // smooth ease-out toward the radius edge
			const impulse = PUSH_STRENGTH * falloff * mouseSpeed;
			d.vx += (dx / dist) * impulse;
			d.vy += (dy / dist) * impulse;
		}

		// Spring back to rest, then damp.
		d.vx += -d.ox * SPRING_K;
		d.vy += -d.oy * SPRING_K;
		d.vx *= DAMPING;
		d.vy *= DAMPING;
		d.ox += d.vx;
		d.oy += d.vy;
	}

	// Tracked speed decays on its own between mousemove events so a
	// stationary cursor stops pushing shortly after motion stops.
	mouseVelX *= 0.85;
	mouseVelY *= 0.85;
}

function drawDoodles() {
	const dimmed = selectedItem !== null;
	if (dimmed) drawingContext.globalAlpha = 0.3;

	for (const d of doodles) {
		const img = doodleImages[d.imgIndex];
		if (!img || !img.width) continue; // not decoded yet — skip this frame

		const driftX = Math.sin(frameCount * DRIFT_SPEED + d.phaseX) * DRIFT_AMP;
		const driftY = Math.sin(frameCount * DRIFT_SPEED + d.phaseY) * DRIFT_AMP;

		const worldX = d.x + d.ox + driftX;
		const worldY = d.y + d.oy + driftY;
		const sx = worldX - offsetX + width / 2;
		const sy = worldY - offsetY + height / 2;
		if (sx < -50 || sx > width + 50 || sy < -50 || sy > height + 50) continue;

		push();
		translate(sx, sy);
		image(img, -d.size / 2, -d.size / 2, d.size, d.size);
		pop();
	}

	if (dimmed) drawingContext.globalAlpha = 1;
}

// --- DOM cards ---
function renderCards() {
	if (!worldEl) return;
	worldEl.innerHTML = "";
	cardEls = [];

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const el = document.createElement("div");
		el.className = "absolute text-[9px] leading-[13px] p-3.5 overflow-hidden select-none";
		el.dataset.index = String(i);
		el.dataset.type = item.type;
		el.style.cssText = `
      left: ${item.x}px; top: ${item.y}px;
      width: ${Math.round(item.w)}px; height: ${Math.round(item.h)}px;
      background-color: ${item.bgColor};
      color: ${CARD_TEXT};
      border: 1px dashed rgba(0,0,0,0.6);
      transition: border 0.15s, background-color 0.15s, color 0.15s;
    `;
		el.innerHTML = buildCardHTML(item, false);

		el.addEventListener("click", (e) => {
			e.stopPropagation();
			selectItem(i);
		});

		el.addEventListener("mouseenter", () => {
			if (!el.classList.contains("blog-selected")) {
				el.style.backgroundColor = HOVER_BG;
				el.style.color = HOVER_TEXT;
				el.style.border = "1px dashed rgba(0,0,0,0.6)";
			}
		});
		el.addEventListener("mouseleave", () => {
			if (!el.classList.contains("blog-selected")) {
				el.style.backgroundColor = item.bgColor;
				el.style.color = CARD_TEXT;
				el.style.border = "1px dashed rgba(0,0,0,0.6)";
			}
		});

		worldEl.appendChild(el);
		cardEls.push(el);
	}
}

function buildCardHTML(item: BlogCanvasItem, expanded: boolean): string {
	const date = new Date(item.date_created).toLocaleDateString();

	if (item.type === "audio") {
		return `
      <div class="flex justify-between items-start">
        <span>${date}</span>
        <div class="text-right">
          <div>AUDIO</div>
          <div class="mt-0.5">${item.category.toUpperCase()}</div>
        </div>
      </div>
      <div class="absolute bottom-3.5 left-3.5 right-3.5 flex items-center gap-2.5">
        <div class="w-0 h-0 border-l-[10px] border-l-current border-y-[6px] border-y-transparent shrink-0 cursor-pointer play-btn"></div>
        <div class="flex-1 h-px bg-current"></div>
      </div>
    `;
	}

	if (item.type === "note") {
		const body = item.writeup
			? expanded
				? item.writeup.toUpperCase()
				: truncate(item.writeup.toUpperCase(), 100)
			: "";
		return `<div class="mt-1.5 overflow-hidden">${body}</div>`;
	}

	// post
	const body = item.writeup
		? expanded
			? item.writeup.toUpperCase()
			: truncate(item.writeup.toUpperCase(), 120)
		: "";
	return `
    <div class="flex justify-between items-start">
      <span>${date}</span>
      <div class="text-right">
        <div>${item.category.toUpperCase()}</div>
        <div class="mt-0.5">${item.title.toUpperCase()}</div>
      </div>
    </div>
    <div class="mt-1.5 overflow-hidden">${body}</div>
  `;
}

// --- Selection ---
function selectItem(index: number) {
	selectedItem = index;
	const item = items[index];

	targetOffsetX = item.x + item.w / 2;
	targetOffsetY = item.y + item.h / 2;

	cardEls.forEach((el, idx) => {
		if (idx === index) {
			el.classList.add("blog-selected");
			el.style.backgroundColor = item.bgColor;
			el.style.color = CARD_TEXT;
			el.style.border = "1px dashed rgba(0,0,0,0.6)";
			el.style.opacity = "1";
			el.style.pointerEvents = "auto";
			el.style.zIndex = "100";
			if (item.type !== "audio") {
				el.style.height = "auto";
				el.style.maxHeight = "calc(100vh - 80px)";
				el.style.overflowY = "auto";
				el.style.minWidth = "min(460px, calc(100vw - 40px))";
				el.style.fontSize = "12px";
				el.style.lineHeight = "18px";
				el.style.padding = "20px";
				el.style.userSelect = "text";
			}
			el.innerHTML = buildCardHTML(item, true);
			if (item.type !== "audio") {
				// Re-center on the expanded card (clamped height) so long
				// writeups stay fully on-screen and can scroll inside.
				targetOffsetX = item.x + el.offsetWidth / 2;
				targetOffsetY = item.y + el.offsetHeight / 2;
			}
		} else {
			el.style.opacity = "0";
			el.style.pointerEvents = "none";
		}
	});

	if (item.type === "audio" && item.audio_url) {
		// Wire play/pause toggle on the play button
		const el = cardEls[index];
		const btn = el.querySelector(".play-btn");
		if (btn) {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				toggleAudio(item.id, item.audio_url!);
				// Update button visual
				const playing = audioElements[item.id] && !audioElements[item.id].paused;
				if (playing) {
					(btn as HTMLElement).className = "w-[10px] h-[12px] border-l-[3px] border-r-[3px] border-current shrink-0 cursor-pointer play-btn";
				} else {
					(btn as HTMLElement).className = "w-0 h-0 border-l-[10px] border-l-current border-y-[6px] border-y-transparent shrink-0 cursor-pointer play-btn";
				}
			});
		}
		playAudio(item.id, item.audio_url);
		// Show pause icon since we just started playing
		if (btn) {
			(btn as HTMLElement).className = "w-[10px] h-[12px] border-l-[3px] border-r-[3px] border-current shrink-0 cursor-pointer play-btn";
		}
	}
}

function deselectItem() {
	if (selectedItem !== null) {
		const item = items[selectedItem];
		const el = cardEls[selectedItem];
		if (item.type === "audio") {
			stopAudio(item.id);
		}
		// Reset expanded styles
		el.style.height = Math.round(item.h) + "px";
		el.style.maxHeight = "";
		el.style.overflowY = "";
		el.style.minWidth = "";
		el.style.fontSize = "";
		el.style.lineHeight = "";
		el.style.padding = "";
		el.style.userSelect = "";
		el.style.border = "1px dashed rgba(0,0,0,0.6)";
		el.style.backgroundColor = item.bgColor;
		el.style.color = CARD_TEXT;
		el.innerHTML = buildCardHTML(item, false);
	}
	selectedItem = null;

	cardEls.forEach((el) => {
		el.classList.remove("blog-selected");
		el.style.opacity = "1";
		el.style.pointerEvents = "auto";
		el.style.zIndex = "";
	});
}

// --- Audio ---
function playAudio(id: number, url: string) {
	if (!audioElements[id]) {
		audioElements[id] = new Audio(url);
		audioElements[id].loop = true;
	}
	audioElements[id].play().catch((e) => console.log("Audio play failed:", e));
}

function toggleAudio(id: number, url: string) {
	if (audioElements[id] && !audioElements[id].paused) {
		audioElements[id].pause();
	} else {
		playAudio(id, url);
	}
}

function stopAudio(id: number) {
	if (audioElements[id]) {
		audioElements[id].pause();
		audioElements[id].currentTime = 0;
	}
}

// --- Coords ---
function updateCoords() {
	const wx = mouseX - width / 2 + offsetX;
	const wy = mouseY - height / 2 + offsetY;
	const lat = -wy / 100;
	const lon = wx / 100;

	const latDir = lat >= 0 ? "S" : "N";
	const lonDir = lon >= 0 ? "O" : "E";
	const aLat = Math.abs(lat);
	const aLon = Math.abs(lon);

	const latDeg = Math.floor(aLat);
	const latMin = Math.floor((aLat - latDeg) * 60);
	const latSec = ((aLat - latDeg) * 60 - latMin) * 60;
	const lonDeg = Math.floor(aLon);
	const lonMin = Math.floor((aLon - lonDeg) * 60);
	const lonSec = ((aLon - lonDeg) * 60 - lonMin) * 60;

	const str = `${latDeg}°${String(latMin).padStart(2, "0")}'${latSec.toFixed(0).padStart(2, "0")}" ${latDir}, ${lonDeg}°${String(lonMin).padStart(2, "0")}'${lonSec.toFixed(1).padStart(4, "0")}" ${lonDir}`;
	const el = document.getElementById("coords-display");
	if (el) el.textContent = str;
}

// --- p5.js + pan (desktop only) ---
if (!isMobile) {
	(window as any).setup = function() {
		const c = createCanvas(windowWidth, windowHeight);
		c.style("position", "fixed");
		c.style("top", "0");
		c.style("left", "0");
		c.style("z-index", "0");
		c.style("pointer-events", "none");

		doodleImages = DOODLE_IMAGE_URLS.map((url) => loadImage(url));
	};

	(window as any).draw = function() {
		clear();
		offsetX += (targetOffsetX - offsetX) * 0.12;
		offsetY += (targetOffsetY - offsetY) * 0.12;
		if (worldEl) worldEl.style.transform = `translate(${-offsetX}px, ${-offsetY}px)`;
		updateDoodlePhysics();
		drawDoodles();
		updateCoords();
	};

	(window as any).windowResized = function() {
		resizeCanvas(windowWidth, windowHeight);
	};

	// Pan / drag
	viewportEl?.addEventListener("mousedown", (e) => {
		if (e.button !== 0) return;
		if (selectedItem !== null) {
			const card = cardEls[selectedItem];
			if (!card.contains(e.target as Node)) deselectItem();
			return;
		}
		if ((e.target as HTMLElement).closest(".absolute")) return; // card
		isDragging = true;
		lastMouseX = e.clientX;
		lastMouseY = e.clientY;
	});

	window.addEventListener("mousemove", (e) => {
		if (!isDragging) return;
		targetOffsetX -= e.clientX - lastMouseX;
		targetOffsetY -= e.clientY - lastMouseY;
		offsetX = targetOffsetX;
		offsetY = targetOffsetY;
		lastMouseX = e.clientX;
		lastMouseY = e.clientY;
	});

	// Doodle push physics — tracks raw cursor speed independent of the pan/drag
	// state above; decayed each frame in updateDoodlePhysics().
	let lastVelMouseX = 0;
	let lastVelMouseY = 0;
	let hasLastVelMouse = false;
	window.addEventListener("mousemove", (e) => {
		if (hasLastVelMouse) {
			mouseVelX = Math.max(-MOUSE_SPEED_CLAMP, Math.min(MOUSE_SPEED_CLAMP, e.clientX - lastVelMouseX));
			mouseVelY = Math.max(-MOUSE_SPEED_CLAMP, Math.min(MOUSE_SPEED_CLAMP, e.clientY - lastVelMouseY));
		}
		lastVelMouseX = e.clientX;
		lastVelMouseY = e.clientY;
		hasLastVelMouse = true;
	});

	window.addEventListener("mouseup", () => {
		isDragging = false;
	});

	viewportEl?.addEventListener(
		"wheel",
		(e) => {
			if (selectedItem !== null) return;
			e.preventDefault();
			targetOffsetX += e.deltaX;
			targetOffsetY += e.deltaY;
		},
		{ passive: false },
	);

	window.addEventListener("keydown", (e) => {
		if (e.key === "Escape") deselectItem();
		if ((e.key === "r" || e.key === "R") && selectedItem === null) {
			targetOffsetX = 0;
			targetOffsetY = 0;
		}
	});
}
