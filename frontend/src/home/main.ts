import "../shared/styles.css";
import { initCursor } from "../shared/cursor";
import { getFeed, type FeedItem } from "../shared/api";
import { t, currentLang, switchLang } from "../shared/i18n";
import { getLinks } from "../shared/nav";

// --- p5.js global mode types (loaded via CDN) ---
declare const createCanvas: any;
declare const windowWidth: number;
declare const windowHeight: number;
declare const resizeCanvas: any;
declare const background: any;
declare const stroke: any;
declare const strokeWeight: any;
declare const fill: any;
declare const noStroke: any;
declare const noFill: any;
declare const rect: any;
declare const line: any;
declare const text: any;
declare const textFont: any;
declare const textSize: any;
declare const textAlign: any;
declare const push: any;
declare const pop: any;
declare const mouseX: number;
declare const mouseY: number;
declare const mouseButton: any;
declare const LEFT: any;
declare const RIGHT: any;
declare const CENTER: any;
declare const BOTTOM: any;
declare const noLoop: any;
declare const loop: any;
declare const width: number;
declare const height: number;
declare const key: string;

// --- State ---
let viewMode: "map" | "scroll" = "map";
let offsetX = 0;
let offsetY = 0;
const zoom = 1;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let dragStartX = 0;
let dragStartY = 0;

interface CanvasItem {
	x: number;
	y: number;
	w: number;
	h: number;
	id: number;
	title: string;
	type: string;
	link: string;
	imgEl?: HTMLImageElement;
}

let items: CanvasItem[] = [];
let hoveredItem: number | null = null;
let bancoImages: string[] = [];

const RULER_WIDTH = 50;
const RULER_HEIGHT = 30;
const PIXELS_PER_DEGREE = 30;

// --- Init ---
initCursor();

let feedData: FeedItem[] = [];
let mobileBuilt = false;
let desktopBuilt = false;

// Populate list-view sidebar nav (desktop only)
const listNav = document.getElementById("list-nav");
if (listNav) {
	const navLinks = getLinks().filter((l) => l.href !== "/");
	for (const link of navLinks) {
		const a = document.createElement("a");
		a.href = link.href;
		a.className = "nav-link text-xs tracking-wider text-ink uppercase px-1 py-0.5 -ml-1 no-underline";
		a.textContent = link.label;
		listNav.appendChild(a);
	}

	// Lang toggle in list view
	const esClass = currentLang === "es" ? "bg-ink text-cream" : "text-ink";
	const enClass = currentLang === "en" ? "bg-ink text-cream" : "text-ink";
	const langDiv = document.createElement("div");
	langDiv.className = "flex gap-0 mt-6 text-[10px] tracking-wider uppercase";
	langDiv.innerHTML = `
		<button data-switch-lang="es" class="lang-btn px-1.5 py-0.5 ${esClass}">ES</button>
		<span class="text-muted px-0.5">/</span>
		<button data-switch-lang="en" class="lang-btn px-1.5 py-0.5 ${enClass}">EN</button>
	`;
	listNav.parentElement!.appendChild(langDiv);
	langDiv.querySelectorAll<HTMLButtonElement>(".lang-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const lang = btn.dataset.switchLang as "es" | "en";
			if (lang !== currentLang) {
				sessionStorage.setItem("home_view_mode", viewMode);
				switchLang(lang);
			}
		});
	});
}

// --- Fetch data + image manifest, then build ---
Promise.all([
	getFeed(0, 60),
	fetch("/banco-manifest.json").then((r) => r.json()).catch(() => [] as string[]),
])
	.then(([res, manifest]) => {
		feedData = res.data;
		bancoImages = manifest;
		applyView();
	})
	.catch((err) => {
		console.error("Feed fetch failed:", err);
		// Only reveal empty state on genuine failure
		const emptyEl = document.getElementById("mobile-empty");
		const feedEl = document.getElementById("mobile-feed");
		if (emptyEl) emptyEl.classList.remove("hidden");
		if (feedEl) feedEl.style.display = "block";
	});

function applyView() {
	if (!feedData.length) return;
	const mobile = window.innerWidth < 768;

	if (mobile) {
		if (!mobileBuilt) {
			renderMobile(feedData);
			mobileBuilt = true;
		}
		enterMobileView();
	} else {
		if (!desktopBuilt) {
			buildCanvasItems(feedData);
			desktopBuilt = true;
		}
		enterDesktopView();
	}
}

// --- Mobile renderer ---
function renderMobile(data: FeedItem[]) {
	const track = document.getElementById("mobile-track")!;
	const textPanel = document.getElementById("mobile-text")!;

	const feedEl = document.getElementById("mobile-feed")!;

	if (!data.length) {
		document.getElementById("mobile-empty")!.classList.remove("hidden");
		feedEl.style.display = "block";
		return;
	}

	// --- Fixed right side: branding + nav ---
	const esClass = currentLang === "es" ? "bg-ink text-cream" : "text-ink";
	const enClass = currentLang === "en" ? "bg-ink text-cream" : "text-ink";

	textPanel.innerHTML = `
    <div class="text-right">
      <div class="text-sm tracking-widest uppercase font-medium leading-tight">Cardinal</div>
      <div class="text-sm tracking-widest uppercase font-medium leading-tight">Sur</div>
    </div>
    <nav class="text-right flex flex-col gap-1.5">
      ${getLinks().filter((l) => l.href !== "/").map((l) =>
        `<a href="${l.href}" class="text-xs tracking-widest uppercase no-underline text-ink">${l.label}</a>`
      ).join("\n      ")}
    </nav>
    <div class="text-right flex justify-end items-center gap-0 mt-2 text-[10px] tracking-wider uppercase">
      <button data-switch-lang="es" class="lang-btn-mobile min-w-[44px] min-h-[44px] flex items-center justify-center ${esClass}">ES</button>
      <span class="text-muted px-0.5">/</span>
      <button data-switch-lang="en" class="lang-btn-mobile min-w-[44px] min-h-[44px] flex items-center justify-center ${enClass}">EN</button>
    </div>
  `;

	textPanel.querySelectorAll<HTMLButtonElement>(".lang-btn-mobile").forEach((btn) => {
		btn.addEventListener("click", () => {
			const lang = btn.dataset.switchLang as "es" | "en";
			if (lang !== currentLang) {
				sessionStorage.setItem("home_view_mode", viewMode);
				switchLang(lang);
			}
		});
	});

	// --- Scrolling left side: images from banco ---
	const widths = ["90%", "70%", "80%", "95%", "65%", "85%", "75%"];
	const shuffled = [...bancoImages].sort(() => Math.random() - 0.5);

	function buildImages(offset: number) {
		for (let i = 0; i < data.length; i++) {
			const item = data[i % data.length];
			const a = document.createElement("a");
			a.href = item.link;
			a.className = "shrink-0";
			a.style.width = widths[(i + offset) % widths.length];

			const src = shuffled.length > 0
				? shuffled[(i + offset) % shuffled.length]
				: null;

			if (src) {
				const img = document.createElement("img");
				img.src = src;
				img.alt = "";
				img.className = "w-full h-auto block";
				img.loading = "lazy";
				a.appendChild(img);
			}

			track.appendChild(a);
		}
	}

	// Duplicate for seamless loop
	buildImages(0);
	buildImages(3);

	// Reveal feed now that content is ready
	feedEl.style.display = "block";

	// Graceful upward scroll
	track.style.animationName = "mobile-scroll-up";
	track.style.animationDuration = "120s";
	track.style.animationTimingFunction = "linear";
	track.style.animationIterationCount = "infinite";

	// Pause on touch / hover
	feedEl.addEventListener("touchstart", () => { track.style.animationPlayState = "paused"; });
	feedEl.addEventListener("touchend", () => { track.style.animationPlayState = "running"; });
	feedEl.addEventListener("mousedown", () => { track.style.animationPlayState = "paused"; });
	feedEl.addEventListener("mouseup", () => { track.style.animationPlayState = "running"; });

	if (!document.getElementById("mobile-scroll-keyframes")) {
		const style = document.createElement("style");
		style.id = "mobile-scroll-keyframes";
		style.textContent = `
      @keyframes mobile-scroll-up {
        0% { transform: translateY(0); }
        100% { transform: translateY(-50%); }
      }
    `;
		document.head.appendChild(style);
	}
}

// --- Resize listener: switch between mobile/desktop views ---
function enterMobileView() {
	// Kill list view if active
	const listView = document.getElementById("list-view");
	if (listView) {
		listView.classList.add("hidden");
		listView.classList.remove("flex");
		const listCols = document.getElementById("list-columns");
		if (listCols) listCols.innerHTML = "";
	}

	// Hide p5 canvas + desktop overlays
	const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
	if (canvas) canvas.style.display = "none";
	const canvasUi = document.getElementById("canvas-ui");
	if (canvasUi) canvasUi.style.display = "none";

	try { noLoop(); } catch (_) { }
	viewMode = "map";
}

function enterDesktopView() {
	// Restore p5 canvas + desktop overlays
	const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
	if (canvas) canvas.style.display = "block";
	const canvasUi = document.getElementById("canvas-ui");
	if (canvasUi) canvasUi.style.display = "";

	try { loop(); } catch (_) { }
}

window.addEventListener("resize", () => applyView());

// --- Canvas items from API data ---
function buildCanvasItems(data: FeedItem[]) {
	// Shuffle and pick random images from banco
	const shuffled = [...bancoImages].sort(() => Math.random() - 0.5);

	// Max dimension: ~15% of viewport
	const maxDim = 250;

	// Pre-load images, then size items to match aspect ratio
	const promises = data.map((item, i) => {
		const ci: CanvasItem = {
			x: 0, y: 0,
			w: maxDim, h: maxDim,
			id: i,
			title: item.title,
			type: item.type,
			link: item.link,
		};

		if (shuffled.length > 0) {
			const src = shuffled[i % shuffled.length];
			const htmlImg = new Image();
			htmlImg.src = src;
			ci.imgEl = htmlImg;

			return new Promise<CanvasItem>((resolve) => {
				htmlImg.onload = () => {
					const aspect = htmlImg.naturalWidth / htmlImg.naturalHeight;
					if (aspect > 1) {
						ci.w = maxDim;
						ci.h = maxDim / aspect;
					} else {
						ci.h = maxDim;
						ci.w = maxDim * aspect;
					}
					resolve(ci);
				};
				htmlImg.onerror = () => resolve(ci);
			});
		}

		return Promise.resolve(ci);
	});

	Promise.all(promises).then((loaded) => {
		// Place items in a spread
		items = loaded.map((ci) => {
			const r = Math.pow(Math.random(), 0.5) * 1400 + 200;
			const angle = Math.random() * Math.PI * 2;
			ci.x = Math.cos(angle) * r;
			ci.y = Math.sin(angle) * r;
			return ci;
		});
		separateItems();

		// Restore view mode that was saved before a lang switch
		const savedView = sessionStorage.getItem("home_view_mode");
		sessionStorage.removeItem("home_view_mode");
		if (savedView === "scroll") {
			toggleView();
		}
	});
}

const ITEM_GAP = 40; // minimum px between any two items

function separateItems() {
	for (let pass = 0; pass < 200; pass++) {
		let moved = false;
		for (let i = 0; i < items.length; i++) {
			for (let j = i + 1; j < items.length; j++) {
				const a = items[i];
				const b = items[j];
				// Check overlap including gap padding
				const ox1 = Math.max(a.x - ITEM_GAP, b.x - ITEM_GAP);
				const oy1 = Math.max(a.y - ITEM_GAP, b.y - ITEM_GAP);
				const ox2 = Math.min(a.x + a.w + ITEM_GAP, b.x + b.w + ITEM_GAP);
				const oy2 = Math.min(a.y + a.h + ITEM_GAP, b.y + b.h + ITEM_GAP);
				if (ox2 <= ox1 || oy2 <= oy1) continue;

				const overlapX = ox2 - ox1;
				const overlapY = oy2 - oy1;
				if (overlapX < overlapY) {
					const push = overlapX * 0.55 * (a.x < b.x ? -1 : 1);
					a.x += push;
					b.x -= push;
				} else {
					const push = overlapY * 0.55 * (a.y < b.y ? -1 : 1);
					a.y += push;
					b.y -= push;
				}
				moved = true;
			}
		}
		if (!moved) break;
	}
}

// --- p5.js world/screen helpers ---
function worldToScreen(wx: number, wy: number) {
	return {
		x: (wx - offsetX) * zoom + width / 2,
		y: (wy - offsetY) * zoom + height / 2,
	};
}

function screenToWorld(sx: number, sy: number) {
	return {
		x: (sx - width / 2) / zoom + offsetX,
		y: (sy - height / 2) / zoom + offsetY,
	};
}

function pixelsToLatLong(wx: number, wy: number) {
	return { lat: -wy / PIXELS_PER_DEGREE, lon: wx / PIXELS_PER_DEGREE };
}

function formatDegrees(decimal: number, isLat: boolean) {
	const dir = isLat
		? decimal >= 0 ? "N" : "S"
		: decimal >= 0 ? "E" : "W";
	const abs = Math.abs(decimal);
	const deg = Math.floor(abs);
	const minFloat = (abs - deg) * 60;
	const min = Math.floor(minFloat);
	const sec = Math.floor((minFloat - min) * 60);
	return `${deg}°${String(min).padStart(2, "0")}'${String(sec).padStart(2, "0")}" ${dir}`;
}

// --- p5.js setup/draw (attached to window for global mode) ---
if (window.innerWidth >= 768) {
	(window as any).setup = function() {
		createCanvas(windowWidth, windowHeight);
		textFont("IBM Plex Mono");
	};

	(window as any).draw = function() {
		background("#f5f3ef");
		drawItems();
		if (hoveredItem !== null) drawCrosshairLines(items[hoveredItem]);
		drawLatitudeRuler();
		drawLongitudeRuler();
		drawScaleBar();
		updateCoordsDisplay();
	};

	const compassEl = document.getElementById("compass");

	(window as any).mousePressed = function() {
		if (viewMode !== "map") return;
		if (mouseButton === LEFT) {
			isDragging = true;
			lastMouseX = mouseX;
			lastMouseY = mouseY;
			dragStartX = mouseX;
			dragStartY = mouseY;
		}
	};

	(window as any).mouseReleased = function() {
		if (isDragging && hoveredItem !== null) {
			// Don't navigate if the click landed on the logo
			if (compassEl?.matches(":hover")) { isDragging = false; return; }
			const dx = Math.abs(mouseX - dragStartX);
			const dy = Math.abs(mouseY - dragStartY);
			if (dx < 5 && dy < 5) {
				window.location.href = items[hoveredItem].link;
			}
		}
		isDragging = false;
	};

	(window as any).mouseDragged = function() {
		if (viewMode !== "map" || !isDragging) return;
		offsetX -= (mouseX - lastMouseX) / zoom;
		offsetY -= (mouseY - lastMouseY) / zoom;
		lastMouseX = mouseX;
		lastMouseY = mouseY;
	};

	(window as any).mouseWheel = function() {
		return false;
	};

	(window as any).keyPressed = function() {
		if (viewMode !== "map") return;
		if (key === "r" || key === "R") {
			offsetX = 0;
			offsetY = 0;
		}
	};

	// Logo click toggles map ↔ scroll view
	if (compassEl) {
		compassEl.addEventListener("click", () => toggleView());
	}

	(window as any).windowResized = function() {
		resizeCanvas(windowWidth, windowHeight);
	};
}

// --- Drawing functions ---
function drawItems() {
	hoveredItem = null;
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const screen = worldToScreen(item.x, item.y);
		const w = item.w * zoom;
		const h = item.h * zoom;

		const isHovered =
			mouseX > screen.x &&
			mouseX < screen.x + w &&
			mouseY > screen.y &&
			mouseY < screen.y + h &&
			mouseX > RULER_WIDTH &&
			mouseY > RULER_HEIGHT;

		if (isHovered) hoveredItem = i;

		push();
		if (item.imgEl && item.imgEl.complete && item.imgEl.naturalWidth > 0) {
			(window as any).drawingContext.drawImage(item.imgEl, screen.x, screen.y, w, h);
			stroke(26);
			strokeWeight(1);
			noFill();
			rect(screen.x, screen.y, w, h);
		} else {
			strokeWeight(1);
			stroke(26);
			fill(255);
			rect(screen.x, screen.y, w, h);

			stroke(180);
			strokeWeight(0.5);
			const padding = 8 * zoom;
			for (let ly = screen.y + padding; ly < screen.y + h - padding; ly += 6 * zoom) {
				line(screen.x + padding, ly, screen.x + w - padding, ly);
			}
		}
		pop();
	}

	document.body.style.cursor = hoveredItem !== null ? "pointer" : "";
}

function drawCrosshairLines(item: CanvasItem) {
	const screen = worldToScreen(item.x, item.y);
	const w = item.w * zoom;
	const h = item.h * zoom;
	const centerX = screen.x + w / 2;
	const centerY = screen.y + h / 2;

	stroke(26);
	strokeWeight(1);
	line(0, centerY, width, centerY);
	line(centerX, 0, centerX, height);

	const coords = pixelsToLatLong(item.x + item.w / 2, item.y + item.h / 2);
	const coordLabel = `${formatDegrees(coords.lat, true)}, ${formatDegrees(coords.lon, false)}`;
	const fullLabel = item.title.toUpperCase() + " — " + coordLabel;

	push();
	noStroke();
	textAlign(LEFT);
	textSize(11);
	fill(100);
	text(fullLabel, screen.x + w + 14, centerY + 16);
	pop();
}

function drawLatitudeRuler() {
	push();
	const topLeft = screenToWorld(0, RULER_HEIGHT);
	const bottomRight = screenToWorld(0, height);
	const degreeSpacing = 5;

	textSize(9);
	textAlign(RIGHT, CENTER);
	fill(26);
	noStroke();

	const startLat =
		Math.ceil(pixelsToLatLong(0, topLeft.y).lat / degreeSpacing) * degreeSpacing;
	const endLat =
		Math.floor(pixelsToLatLong(0, bottomRight.y).lat / degreeSpacing) * degreeSpacing;

	for (let lat = startLat; lat >= endLat; lat -= degreeSpacing) {
		const wy = -lat * PIXELS_PER_DEGREE;
		const screen = worldToScreen(0, wy);
		if (screen.y > RULER_HEIGHT && screen.y < height) {
			stroke(26);
			strokeWeight(1);
			line(RULER_WIDTH - 8, screen.y, RULER_WIDTH, screen.y);
			noStroke();
			const label = lat === 0 ? "0°" : `${Math.abs(lat)}°${lat >= 0 ? " N" : " S"}`;
			text(label, RULER_WIDTH - 12, screen.y);
		}
	}
	pop();
}

function drawLongitudeRuler() {
	push();
	const topLeft = screenToWorld(RULER_WIDTH, 0);
	const bottomRight = screenToWorld(width, 0);
	const degreeSpacing = 5;

	textSize(9);
	textAlign(CENTER, BOTTOM);
	fill(26);
	noStroke();

	const startLon =
		Math.floor(pixelsToLatLong(topLeft.x, 0).lon / degreeSpacing) * degreeSpacing;
	const endLon =
		Math.ceil(pixelsToLatLong(bottomRight.x, 0).lon / degreeSpacing) * degreeSpacing;

	for (let lon = startLon; lon <= endLon; lon += degreeSpacing) {
		const wx = lon * PIXELS_PER_DEGREE;
		const screen = worldToScreen(wx, 0);
		if (screen.x > RULER_WIDTH && screen.x < width) {
			stroke(26);
			strokeWeight(1);
			line(screen.x, RULER_HEIGHT - 8, screen.x, RULER_HEIGHT);
			noStroke();
			const label = lon === 0 ? "0°" : `${Math.abs(lon)}°${lon >= 0 ? "E" : "W"}`;
			text(label, screen.x, RULER_HEIGHT - 10);
		}
	}
	pop();

	// Corner box
	fill("#f5f3ef");
	noStroke();
	rect(0, 0, RULER_WIDTH, RULER_HEIGHT);
	stroke(26);
	strokeWeight(1);
	line(RULER_WIDTH, 0, RULER_WIDTH, RULER_HEIGHT);
	line(0, RULER_HEIGHT, RULER_WIDTH, RULER_HEIGHT);
}

function drawScaleBar() {
	const targetScreenPx = 120;
	const worldPerPx = 1 / zoom;
	const rawDegrees = (targetScreenPx * worldPerPx) / PIXELS_PER_DEGREE;

	const niceSteps = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 15, 30, 45, 90];
	let niceDeg = niceSteps[0];
	for (const s of niceSteps) {
		if (s <= rawDegrees * 1.5) niceDeg = s;
	}

	const barPx = niceDeg * PIXELS_PER_DEGREE * zoom;
	const barX = 20;
	const barY = height - 24;

	push();
	stroke(26);
	strokeWeight(1);
	line(barX, barY, barX + barPx, barY);
	line(barX, barY - 4, barX, barY + 4);
	line(barX + barPx, barY - 4, barX + barPx, barY + 4);

	noStroke();
	fill(26);
	textSize(9);
	textAlign(CENTER, BOTTOM);
	const label = niceDeg >= 1 ? `${niceDeg}°` : `${(niceDeg * 60).toFixed(0)}'`;
	text(label, barX + barPx / 2, barY - 6);
	pop();
}

function updateCoordsDisplay() {
	if (mouseX > RULER_WIDTH && mouseY > RULER_HEIGHT) {
		const world = screenToWorld(mouseX, mouseY);
		const coords = pixelsToLatLong(world.x, world.y);
		const latEl = document.querySelector("#coords-display .lat") as HTMLElement;
		const lonEl = document.querySelector("#coords-display .lon") as HTMLElement;
		if (latEl) latEl.textContent = formatDegrees(coords.lat, true);
		if (lonEl) lonEl.textContent = formatDegrees(coords.lon, false);
	}
}

// --- View toggle: map ↔ scroll ---
function toggleView() {
	const listView = document.getElementById("list-view")!;
	const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
	const coordsDisplay = document.getElementById("coords-display");

	if (viewMode === "map") {
		viewMode = "scroll";
		noLoop();
		if (canvas) canvas.style.display = "none";
		listView.classList.remove("hidden");
		listView.classList.add("flex");
		if (coordsDisplay) coordsDisplay.style.display = "none";
		buildListView();
	} else {
		viewMode = "map";
		listView.classList.add("hidden");
		listView.classList.remove("flex");
		document.getElementById("list-columns")!.innerHTML = "";
		if (canvas) canvas.style.display = "block";
		if (coordsDisplay) coordsDisplay.style.display = "";
		loop();
	}
}

function buildListView() {
	const container = document.getElementById("list-columns")!;
	container.innerHTML = "";

	const NUM_COLS = 5;
	const columns: CanvasItem[][] = Array.from({ length: NUM_COLS }, () => []);

	for (let i = 0; i < items.length; i++) {
		columns[i % NUM_COLS].push(items[i]);
	}

	const ANIM_DURATION = 50;

	columns.forEach((colItems, colIdx) => {
		const track = document.createElement("div");
		track.className = "overflow-hidden relative flex-1";

		const inner = document.createElement("div");
		inner.className = "flex flex-col gap-4";
		//inner.className = "absolute left-0 top-0 bottom-0 w-[60%] overflow-hidden";
		const direction = colIdx % 2 === 0 ? "scroll-up" : "scroll-down";
		inner.style.animationName = direction;
		inner.style.animationDuration = ANIM_DURATION + "s";
		inner.style.animationTimingFunction = "linear";
		inner.style.animationIterationCount = "infinite";

		// Pause on hover
		track.addEventListener("mouseenter", () => {
			inner.style.animationPlayState = "paused";
		});
		track.addEventListener("mouseleave", () => {
			inner.style.animationPlayState = "running";
		});

		for (let dup = 0; dup < 2; dup++) {
			for (const item of colItems) {
				const a = document.createElement("a");
				a.href = item.link;
				a.className = "shrink-0 block";

				if (item.imgEl && item.imgEl.src) {
					const img = document.createElement("img");
					img.src = item.imgEl.src;
					img.alt = item.title;
					img.className = "w-full h-auto block";
					img.loading = "lazy";
					a.appendChild(img);
				} else {
					a.className = "border border-ink bg-white shrink-0 block";
					const aspect = item.h / item.w;
					const lines = document.createElement("div");
					lines.className = "w-full flex flex-col gap-1 p-2.5";
					lines.style.aspectRatio = `1 / ${aspect}`;
					const numLines = Math.floor(aspect * 12);
					for (let l = 0; l < numLines; l++) {
						const ln = document.createElement("div");
						ln.className = "h-px bg-rule";
						lines.appendChild(ln);
					}
					a.appendChild(lines);
				}

				inner.appendChild(a);
			}
		}

		track.appendChild(inner);
		container.appendChild(track);
	});

	// Inject keyframes if not present
	if (!document.getElementById("list-keyframes")) {
		const style = document.createElement("style");
		style.id = "list-keyframes";
		style.textContent = `
      @keyframes scroll-up { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
      @keyframes scroll-down { 0% { transform: translateY(-50%); } 100% { transform: translateY(0); } }
    `;
		document.head.appendChild(style);
	}
}
