import "../shared/styles.css";
import { initCursor } from "../shared/cursor";
import { initNav, initMobileNav } from "../shared/nav";
import { getBlog, type BlogEntry } from "../shared/api";
import { t } from "../shared/i18n";
import { POST, AUDIO, NOTE, HOVER_BG } from "../shared/colors";

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
declare const stroke: any;
declare const strokeWeight: any;
declare const noStroke: any;
declare const fill: any;
declare const noFill: any;
declare const ellipse: any;
declare const triangle: any;
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
	x: number;
	y: number;
	type: string;
	size: number;
	rotation: number;
}

let doodles: Doodle[] = [];

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
		const bgMap: Record<string, string> = { post: POST, audio: AUDIO, note: NOTE };
		card.className = "p-3.5 text-[11px] leading-[15px] border border-transparent";
		card.style.backgroundColor = bgMap[entry.type] ?? POST;
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
	post: { bgColor: POST, w: 380, h: 220 },
	audio: { bgColor: AUDIO, w: 350, h: 72 },
	note: { bgColor: NOTE, w: 340, h: 140 },
};

function buildBlogItems(entries: BlogEntry[]) {
	items = entries.map((entry, i) => {
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
	const doodleTypes = [
		"triangle-outline",
		"triangle-filled",
		"circle-outline",
		"circle-filled",
		"double-circle-dot",
		"small-dot",
	];
	const points = poissonDiskSampling(2400, 1800, 250);
	for (const pt of points) {
		const type = doodleTypes[Math.floor(Math.random() * doodleTypes.length)];
		const isTriangle = type === "triangle-outline" || type === "triangle-filled";
		const triangleRotations = [0, Math.PI / 2, -Math.PI / 2];
		const rotation = isTriangle
			? triangleRotations[Math.floor(Math.random() * triangleRotations.length)]
			: Math.random() * Math.PI * 2;
		doodles.push({
			x: pt.x - 1200,
			y: pt.y - 900,
			type,
			size: 9 + Math.random() * 9,
			rotation,
		});
	}
}

function drawDoodles() {
	const alpha = selectedItem !== null ? 80 : 255;
	for (const d of doodles) {
		const sx = d.x - offsetX + width / 2;
		const sy = d.y - offsetY + height / 2;
		if (sx < -50 || sx > width + 50 || sy < -50 || sy > height + 50) continue;

		push();
		translate(sx, sy);
		rotate(d.rotation);
		stroke(0, alpha);
		strokeWeight(1);
		noFill();

		switch (d.type) {
			case "triangle-outline":
				triangle(-d.size / 2, d.size / 3, d.size / 2, d.size / 3, 0, -d.size / 2);
				break;
			case "triangle-filled":
				fill(0, alpha);
				noStroke();
				triangle(-d.size / 2, d.size / 3, d.size / 2, d.size / 3, 0, -d.size / 2);
				break;
			case "circle-outline":
				ellipse(0, 0, d.size, d.size);
				break;
			case "circle-filled":
				fill(0, alpha);
				noStroke();
				ellipse(0, 0, d.size * 0.4, d.size * 0.4);
				break;
			case "double-circle-dot":
				ellipse(0, 0, d.size, d.size);
				ellipse(d.size * 0.5, 0, d.size * 0.6, d.size * 0.6);
				fill(0, alpha);
				noStroke();
				ellipse(d.size * 0.5, 0, d.size * 0.2, d.size * 0.2);
				break;
			case "small-dot":
				fill(0, alpha);
				noStroke();
				ellipse(0, 0, d.size * 0.3, d.size * 0.3);
				break;
		}
		pop();
	}
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
      transition: border 0.15s, background-color 0.15s;
    `;
		el.innerHTML = buildCardHTML(item, false);

		el.addEventListener("click", (e) => {
			e.stopPropagation();
			selectItem(i);
		});

		el.addEventListener("mouseenter", () => {
			if (!el.classList.contains("blog-selected")) {
				el.style.backgroundColor = HOVER_BG;
				el.style.border = "1px dashed rgba(26,26,26,0.6)";
			}
		});
		el.addEventListener("mouseleave", () => {
			if (!el.classList.contains("blog-selected")) {
				el.style.backgroundColor = item.bgColor;
				el.style.border = "1px solid transparent";
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
        <div class="w-0 h-0 border-l-[10px] border-l-ink border-y-[6px] border-y-transparent shrink-0 cursor-pointer play-btn"></div>
        <div class="flex-1 h-px bg-ink"></div>
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
			el.style.border = "1px solid transparent";
			el.style.opacity = "1";
			el.style.pointerEvents = "auto";
			el.style.zIndex = "100";
			if (item.type !== "audio") {
				el.style.height = "auto";
				el.style.minWidth = "min(460px, calc(100vw - 40px))";
				el.style.fontSize = "12px";
				el.style.lineHeight = "18px";
				el.style.padding = "20px";
				el.style.userSelect = "text";
			}
			el.innerHTML = buildCardHTML(item, true);
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
					(btn as HTMLElement).className = "w-[10px] h-[12px] border-l-[3px] border-r-[3px] border-ink shrink-0 cursor-pointer play-btn";
				} else {
					(btn as HTMLElement).className = "w-0 h-0 border-l-[10px] border-l-ink border-y-[6px] border-y-transparent shrink-0 cursor-pointer play-btn";
				}
			});
		}
		playAudio(item.id, item.audio_url);
		// Show pause icon since we just started playing
		if (btn) {
			(btn as HTMLElement).className = "w-[10px] h-[12px] border-l-[3px] border-r-[3px] border-ink shrink-0 cursor-pointer play-btn";
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
		el.style.minWidth = "";
		el.style.fontSize = "";
		el.style.lineHeight = "";
		el.style.padding = "";
		el.style.userSelect = "";
		el.style.border = "1px solid transparent";
		el.style.backgroundColor = item.bgColor;
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
	};

	(window as any).draw = function() {
		clear();
		offsetX += (targetOffsetX - offsetX) * 0.12;
		offsetY += (targetOffsetY - offsetY) * 0.12;
		if (worldEl) worldEl.style.transform = `translate(${-offsetX}px, ${-offsetY}px)`;
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
