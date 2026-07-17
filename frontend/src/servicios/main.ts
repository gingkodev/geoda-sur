import "../shared/styles.css";
import { initCursor } from "../shared/cursor";
import { initNav, initMobileNav } from "../shared/nav";
import { getServices, getServiceBySlug, type Project, type Service, type ServiceImage } from "../shared/api";
import { t, currentLang, switchLang } from "../shared/i18n";

// p5.js globals (index backdrop)
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
declare const noFill: any;
declare const ellipse: any;
declare const line: any;
declare const rect: any;
declare const arc: any;
declare const drawingContext: CanvasRenderingContext2D;
declare const OPEN: any;

initCursor();
const isMobile = window.innerWidth < 768;

const mainEl = document.getElementById("services-main")!;

function slugify(name: string): string {
	return name
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

const segments = location.pathname.split("/").filter(Boolean);
const detailSlug = segments[0] === "servicios" && segments[1] ? decodeURIComponent(segments[1]) : null;

if (detailSlug) {
	// Detail pages get a service-switcher nav instead of the general site
	// menu — needs the services list, so it's wired up separately from the
	// general initNav/initMobileNav path used by the index below.
	const navEl = document.getElementById("nav");
	getServices()
		.then((services) => renderDetailNav(navEl, detailSlug, services))
		.catch((err) => {
			console.error("Nav services fetch failed:", err);
			renderDetailNav(navEl, detailSlug, []); // still show brand + back + lang toggle
		});
	renderDetail(detailSlug);
} else {
	if (isMobile) {
		initMobileNav(document.getElementById("nav"));
	} else {
		initNav(document.getElementById("nav"));
	}
	renderIndex();
}

function renderIndex() {
	mainEl.innerHTML = `
		<div class="w-full max-w-md mx-auto text-center">
			<ol id="services-index" class="flex flex-col"></ol>
		</div>
	`;

	getServices()
		.then((services) => {
			const list = document.getElementById("services-index")!;
			services.forEach((s) => {
				const slug = slugify(s.name);
				const external = s.link_url
					? ` href="${s.link_url}" target="_blank" rel="noopener noreferrer"`
					: ` href="/servicios/${slug}"`;
				const li = document.createElement("li");
				li.className = "service-row py-2 md:py-2.5";
				li.innerHTML = `
					<a${external}
						 class="service-link inline-block px-1.5 py-0.5 no-underline text-ink hover:bg-ink hover:text-cream transition-colors duration-150 text-[11px] md:text-xs uppercase font-light tracking-[0.18em] leading-tight">
						${s.name}
					</a>
				`;
				list.appendChild(li);
			});
			mainEl.style.display = "";
		})
		.catch((err) => {
			console.error("Services fetch failed:", err);
			mainEl.innerHTML = `<p class="text-xs text-muted text-center">No se pudieron cargar los servicios.</p>`;
			mainEl.style.display = "";
		});
}

// --- Detail-page nav: a service switcher, not the general site menu -------
// nav.ts's initNav/initMobileNav only know how to render the general
// Proyectos/Blog/etc. links, so the detail nav is built from scratch here.
// Markup mirrors nav.ts closely (brand link, lang toggle, active-state
// convention) so it reads as the same nav, just with different contents.

const LANG_BTN_BASE = "lang-btn px-1.5 py-0.5";
const LANG_ACTIVE = "bg-ink text-cream";
const LANG_INACTIVE = "text-ink";

function langToggleHTML(): string {
	const esClass = currentLang === "es" ? LANG_ACTIVE : LANG_INACTIVE;
	const enClass = currentLang === "en" ? LANG_ACTIVE : LANG_INACTIVE;
	return `
		<div class="flex gap-0 mt-6 text-[10px] tracking-wider uppercase">
			<button data-switch-lang="es" class="${LANG_BTN_BASE} ${esClass}">ES</button>
			<span class="text-ink/50 px-0.5">/</span>
			<button data-switch-lang="en" class="${LANG_BTN_BASE} ${enClass}">EN</button>
		</div>
	`;
}

function bindLangButtons(container: HTMLElement) {
	container.querySelectorAll<HTMLButtonElement>(".lang-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const lang = btn.dataset.switchLang as "es" | "en";
			if (lang !== currentLang) switchLang(lang);
		});
	});
}

function revealCompass() {
	const compass = document.getElementById("compass");
	if (compass) compass.style.visibility = "";
}

// Same external-vs-internal rule as the index list: a service with a
// link_url points off-site instead of to its own /servicios/<slug> page.
function serviceHref(s: Service): string {
	return s.link_url ? s.link_url : `/servicios/${slugify(s.name)}`;
}

function serviceNavLinks(currentSlug: string, services: Service[], activeClass: string, inactiveClass: string): string {
	return services
		.map((s) => {
			const slug = slugify(s.name);
			const active = slug === currentSlug;
			const external = s.link_url ? ` target="_blank" rel="noopener noreferrer"` : "";
			return `<a href="${serviceHref(s)}"${external} class="${active ? activeClass : inactiveClass}">.${s.name}.</a>`;
		})
		.join("\n");
}

function renderDetailNav(container: HTMLElement | null, currentSlug: string, services: Service[]) {
	if (!container) return;
	const backLabel = t("services.back");

	if (isMobile) {
		const esClass = currentLang === "es" ? LANG_ACTIVE : LANG_INACTIVE;
		const enClass = currentLang === "en" ? LANG_ACTIVE : LANG_INACTIVE;

		container.innerHTML = `
			<div class="flex items-center justify-between px-4 py-3">
				<a href="/" class="text-sm tracking-widest uppercase font-medium no-underline text-ink">Cardinal Sur</a>
				<div class="flex items-center gap-3">
					<div class="flex gap-0 text-[10px] tracking-wider uppercase">
						<button data-switch-lang="es" class="${LANG_BTN_BASE} ${esClass}">ES</button>
						<span class="text-ink/50 px-0.5">/</span>
						<button data-switch-lang="en" class="${LANG_BTN_BASE} ${enClass}">EN</button>
					</div>
					<button id="hamburger" class="text-ink text-lg leading-none cursor-auto min-w-[44px] min-h-[44px] flex items-center justify-center">&#9776;</button>
				</div>
			</div>
			<nav id="mobile-menu" class="hidden flex-col gap-2 px-4 pb-4">
				<a href="/servicios" class="text-xs tracking-wider uppercase py-1 no-underline text-ink block pb-2 mb-1 border-b border-ink/20">${backLabel}</a>
				${serviceNavLinks(
					currentSlug,
					services,
					"text-xs tracking-wider uppercase py-1 no-underline bg-ink text-cream",
					"text-xs tracking-wider uppercase py-1 no-underline text-ink"
				)}
			</nav>
		`;

		document.getElementById("hamburger")!.addEventListener("click", () => {
			const menu = document.getElementById("mobile-menu")!;
			menu.classList.toggle("hidden");
			menu.classList.toggle("flex");
		});
	} else {
		container.innerHTML = `
			<div class="text-sm tracking-widest uppercase font-medium">
				<a href="/" class="nav-link px-1 py-0.5 -ml-1 no-underline text-ink">Cardinal Sur</a>
			</div>
			<nav class="flex flex-col gap-2 mt-6 max-w-[200px]">
				<a href="/servicios" class="nav-link text-xs tracking-wider uppercase px-1 py-0.5 -ml-1 no-underline text-ink block pb-2 mb-1 border-b border-ink/20">${backLabel}</a>
				${serviceNavLinks(
					currentSlug,
					services,
					"nav-link text-xs tracking-wider uppercase px-1 py-0.5 -ml-1 no-underline bg-ink text-cream",
					"nav-link text-xs tracking-wider uppercase px-1 py-0.5 -ml-1 no-underline text-ink"
				)}
			</nav>
			${langToggleHTML()}
		`;
	}

	bindLangButtons(container);
	container.style.visibility = "";
	revealCompass();
}

function renderDetail(slug: string) {
	// Detail pages are a plain document — no random color wash, no p5 backdrop.
	// The shell's body is overflow-hidden on desktop for the index's pinned,
	// no-scroll design; detail content can run taller than one viewport, so it
	// needs to actually be able to scroll.
	document.body.classList.remove("overflow-hidden");
	document.body.classList.add("overflow-y-auto");

	mainEl.className =
		"w-full max-w-6xl mx-auto px-6 md:pl-12 md:pr-48 lg:pr-56 pt-24 pb-20 max-md:pt-10 max-md:pb-12 max-md:px-4";
	mainEl.innerHTML = `
		<div id="service-images" class="flex flex-col gap-8 mb-12 md:mb-16"></div>
		<div class="flex flex-col lg:grid lg:grid-cols-[1fr_12rem] xl:grid-cols-[1fr_14rem] lg:gap-x-16 xl:gap-x-20 lg:items-baseline">
			<h1 id="service-title" class="max-lg:order-1 text-xl md:text-2xl lg:text-3xl uppercase font-medium tracking-tight leading-tight mb-5 md:mb-6"></h1>
			<div class="max-lg:order-3 text-xs md:text-sm tracking-widest uppercase mb-5 md:mb-6 opacity-55">${t("services.clients")}</div>
			<div id="service-description" class="max-lg:order-2 max-lg:mb-10 text-[11px] md:text-xs uppercase leading-[1.8] tracking-wide md:text-justify"></div>
			<div id="service-clients" class="max-lg:order-4 text-[10px] uppercase tracking-wider leading-[1.8]"></div>
		</div>
	`;

	getServiceBySlug(slug)
		.then(({ service, projects }) => {
			document.getElementById("service-title")!.textContent = service.name.toUpperCase();
			document.getElementById("service-description")!.innerHTML = service.description;
			renderServiceImages(service.images ?? []);
			renderClients(projects);
			mainEl.style.display = "";
		})
		.catch((err) => {
			console.error("Service detail fetch failed:", err);
			mainEl.innerHTML = `<p class="text-sm opacity-60">${t("services.not_found")}</p>`;
			mainEl.style.display = "";
		});
}

// Top image row. On mobile it's a simple stacked column at natural size
// (unchanged). On desktop it's a loose, non-overlapping scatter above the
// text block — randomized per load and rejection-sampled so boxes never
// touch, same technique in spirit as the cartographic landing's item-card
// placement (frontend/src/home/main.ts: random candidate + collision check),
// just simpler since there are at most 3 images. Placement is biased into
// three loose zones (upper-left / upper-right / center-low) so the result
// still reads as composed rather than uniformly random. Images always render
// at their natural aspect ratio (no cropping). Degrades to nothing (no empty
// gap) when the service has no images.
const SCATTER_GAP = 20; // min px between two images' boxes
const SCATTER_ZONES = [
	{ xMin: 0, xMax: 0.42, yMin: 0, yMax: 0.3, minW: 300, maxW: 420, maxW3: 360 }, // upper-left, largest
	{ xMin: 0.55, xMax: 1, yMin: 0, yMax: 0.25, minW: 200, maxW: 300, maxW3: 260 }, // upper-right, smaller & wide
	{ xMin: 0.22, xMax: 0.68, yMin: 0.38, yMax: 0.8, minW: 240, maxW: 340, maxW3: 300 }, // center, lower
];

function renderServiceImages(images: ServiceImage[]) {
	const wrap = document.getElementById("service-images");
	if (!wrap) return;
	if (!images.length) {
		wrap.remove();
		return;
	}

	if (isMobile) {
		wrap.innerHTML = images
			.map((img) => {
				const caption = img.caption
					? `<span class="absolute top-2 left-2 bg-ink text-cream text-[9px] uppercase tracking-wider px-1.5 py-0.5">${img.caption}</span>`
					: "";
				const mobileSource = img.mobile_img_url
					? `<source media="(max-width: 767px)" srcset="${img.mobile_img_url}">`
					: "";
				return `
					<div class="relative w-full">
						<picture>
							${mobileSource}
							<img src="${img.img_url}" alt="" loading="lazy" class="w-full h-auto block" />
						</picture>
						${caption}
					</div>
				`;
			})
			.join("");
		return;
	}

	renderScatteredImages(wrap, images);
}

// Resolves once an <img>'s natural size is known (already cached, or via
// load/error), so the scatter layout below can size boxes off the real
// aspect ratio instead of guessing.
function whenImageReady(img: HTMLImageElement): Promise<{ w: number; h: number }> {
	return new Promise((resolve) => {
		const done = () => resolve({ w: img.naturalWidth || 4, h: img.naturalHeight || 3 });
		if (img.complete && img.naturalWidth) return done();
		img.addEventListener("load", done, { once: true });
		img.addEventListener("error", () => resolve({ w: 4, h: 3 }), { once: true });
	});
}

interface ScatterBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

function boxesOverlap(a: ScatterBox, b: ScatterBox, gap: number): boolean {
	return !(a.x + a.w + gap < b.x || b.x + b.w + gap < a.x || a.y + a.h + gap < b.y || b.y + b.h + gap < a.y);
}

// Random offset within [fracMin, fracMax] of `total`, clamped so the box
// (of `size`) never runs past the container edge.
function randomSpan(fracMin: number, fracMax: number, total: number, size: number): number {
	const maxOffset = Math.max(0, total - size);
	const lo = Math.min(fracMin * total, maxOffset);
	const hi = Math.min(fracMax * total, maxOffset);
	return lo + Math.random() * Math.max(0, hi - lo);
}

// Rejection-samples a non-overlapping spot: try inside the image's zone
// first, fall back to anywhere in the canvas, and worst case (vanishingly
// unlikely with only 3 boxes) just place it — no physics, no iteration.
function findScatterSpot(
	containerW: number,
	containerH: number,
	w: number,
	h: number,
	zone: (typeof SCATTER_ZONES)[number],
	placed: ScatterBox[]
): { x: number; y: number } {
	const tryZone = (xMin: number, xMax: number, yMin: number, yMax: number) => {
		for (let attempt = 0; attempt < 30; attempt++) {
			const x = randomSpan(xMin, xMax, containerW, w);
			const y = randomSpan(yMin, yMax, containerH, h);
			if (!placed.some((p) => boxesOverlap({ x, y, w, h }, p, SCATTER_GAP))) return { x, y };
		}
		return null;
	};

	return (
		tryZone(zone.xMin, zone.xMax, zone.yMin, zone.yMax) ||
		tryZone(0, 1, 0, 1) || // zone too tight — fall back to the whole canvas
		{ x: 0, y: 0 } // last resort
	);
}

function renderScatteredImages(wrap: HTMLElement, images: ServiceImage[]) {
	wrap.className = "relative w-full mb-12 md:mb-16";
	const containerH = Math.max(360, Math.min(Math.round(window.innerHeight * 0.58), 620));
	wrap.style.height = `${containerH}px`;

	wrap.innerHTML = images
		.map((img) => {
			const caption = img.caption
				? `<span class="absolute top-2 left-2 bg-ink text-cream text-[9px] md:text-[10px] uppercase tracking-wider px-1.5 py-0.5">${img.caption}</span>`
				: "";
			return `
				<div class="scatter-img absolute opacity-0 transition-opacity duration-500">
					<img src="${img.img_url}" alt="" loading="lazy" class="w-full h-auto block" />
					${caption}
				</div>
			`;
		})
		.join("");

	const boxes = Array.from(wrap.querySelectorAll<HTMLElement>(".scatter-img"));
	const ready = boxes.map((box) => whenImageReady(box.querySelector("img")!));

	Promise.all(ready).then((sizes) => {
		const containerW = wrap.clientWidth;
		const placed: ScatterBox[] = [];

		boxes.forEach((box, i) => {
			const ratio = sizes[i].w / sizes[i].h || 4 / 3;
			const zone = SCATTER_ZONES[i % SCATTER_ZONES.length];
			const maxW = images.length >= 3 ? zone.maxW3 : zone.maxW;
			const targetW = Math.min(zone.minW + Math.random() * (maxW - zone.minW), containerW - SCATTER_GAP);
			const targetH = targetW / ratio;

			const { x, y } = findScatterSpot(containerW, containerH, targetW, targetH, zone, placed);
			placed.push({ x, y, w: targetW, h: targetH });

			box.style.left = `${x}px`;
			box.style.top = `${y}px`;
			box.style.width = `${targetW}px`;
			box.classList.remove("opacity-0");
		});
	});
}

// Right column — linked project names as one wrapping "A | B | C" text block,
// still clickable (to /proyectos#slug) even though it no longer reads as a
// card grid.
function renderClients(projects: Project[]) {
	const container = document.getElementById("service-clients");
	if (!container) return;

	if (!projects.length) {
		container.innerHTML = `<p class="normal-case tracking-normal opacity-45">${
			t("services.no_clients")
		}</p>`;
		return;
	}

	container.innerHTML = projects
		.map((p, i) => {
			const pslug = slugify(p.name);
			const sep = i < projects.length - 1 ? ` <span class="opacity-40">|</span> ` : "";
			return `<a href="/proyectos#${pslug}" class="no-underline text-ink hover:opacity-55 transition-opacity">${p.name}</a>${sep}`;
		})
		.join("");
}

// ---------------------------------------------------------------------------
// Index backdrop — p5.js ambient shapes. Desktop only, index page only.
// ---------------------------------------------------------------------------

type ShapeType = "large-dashed-circle" | "mid-circle" | "dot" | "arc" | "dashed-line" | "rectangle";

interface BackdropShape {
	type: ShapeType;
	size: number;
	// orbital motion — every shape revolves around the viewport center
	orbitR: number;
	orbitAngle: number;
	orbitSpeed: number;
	// self-rotation (circles only)
	spin: number;
	spinSpeed: number;
	// per-shape params
	arcStart: number;
	arcSpan: number;
	rectW: number;
	rectH: number;
	lineLen: number;
	lineAngle: number;
}

let backdropShapes: BackdropShape[] = [];
let hugeCircleSpin = 0;
const hugeCircleSpinSpeed = 0.0015;
let encloseCircleSpin = 0;
const encloseCircleSpinSpeed = -0.0011;

function sizeForType(type: ShapeType): number {
	switch (type) {
		case "large-dashed-circle": return 400 + Math.random() * 500;   // 400–900  (big frames)
		case "mid-circle": return 30 + Math.random() * 150;   // 30–180   (outlined, no fill)
		case "dot": return 3 + Math.random() * 12;    // 3–15     (hairline dot)
		case "arc": return 60 + Math.random() * 190;   // 60–250
		case "dashed-line": return 0;                           // unused; lineLen drives it
		case "rectangle": return 0;                           // unused; rectW/H drive it
	}
}

function generateBackdropShapes() {
	backdropShapes = [];
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const mobile = vw < 768;
	// Orbit extends past viewport edges so shapes drift in from outside
	const maxR = Math.hypot(vw, vh) * 0.52;

	// ---- Dots: clustered like constellations ----
	const clusterCount = mobile
		? 2 + Math.floor(Math.random() * 2)    // 2–3 on mobile
		: 4 + Math.floor(Math.random() * 3);   // 4–6 on desktop
	const clusters: { orbitR: number; orbitAngle: number; orbitSpeed: number }[] = [];
	for (let i = 0; i < clusterCount; i++) {
		clusters.push({
			orbitR: 120 + Math.random() * (maxR - 120),
			orbitAngle: Math.random() * Math.PI * 2,
			// Shared speed keeps each cluster moving as a unit
			orbitSpeed: (0.0004 + Math.random() * 0.0016) * (Math.random() < 0.5 ? 1 : -1),
		});
	}

	const totalDots = mobile ? 50 : 100;
	for (let i = 0; i < totalDots; i++) {
		const wanderer = Math.random() < 0.12;
		let orbitR: number;
		let orbitAngle: number;
		let orbitSpeed: number;
		if (wanderer) {
			orbitR = Math.random() * maxR;
			orbitAngle = Math.random() * Math.PI * 2;
			orbitSpeed = (0.0004 + Math.random() * 0.0016) * (Math.random() < 0.5 ? 1 : -1);
		} else {
			const c = clusters[Math.floor(Math.random() * clusters.length)];
			// Gaussian-ish jitter (sum of two uniforms) for tighter cores, soft edges
			const radialJitter = ((Math.random() + Math.random()) - 1) * 55;
			const tangentialPx = ((Math.random() + Math.random()) - 1) * 90;
			orbitR = Math.max(40, c.orbitR + radialJitter);
			orbitAngle = c.orbitAngle + tangentialPx / Math.max(c.orbitR, 100);
			orbitSpeed = c.orbitSpeed;
		}
		backdropShapes.push({
			type: "dot",
			size: sizeForType("dot"),
			orbitR,
			orbitAngle,
			orbitSpeed,
			spin: 0,
			spinSpeed: 0,
			arcStart: 0,
			arcSpan: 0,
			rectW: 0,
			rectH: 0,
			lineLen: 0,
			lineAngle: 0,
		});
	}

	// ---- Non-dot shapes: scattered, no clustering ----
	const nonDotMix: ShapeType[] = [
		"mid-circle", "mid-circle", "mid-circle",
		"large-dashed-circle",
		"arc", "arc",
		"rectangle", "rectangle", "rectangle", "rectangle",
		"dashed-line", "dashed-line", "dashed-line", "dashed-line",
		"dashed-line", "dashed-line", "dashed-line",
	];
	const nonDotCount = mobile ? 24 : 48;

	for (let i = 0; i < nonDotCount; i++) {
		const type = nonDotMix[i % nonDotMix.length];
		const baseSize = sizeForType(type);
		const isCircle = type === "large-dashed-circle" || type === "mid-circle";

		const orbitR = Math.random() * maxR;
		const orbitSpeed = (0.0004 + Math.random() * 0.0016) * (Math.random() < 0.5 ? 1 : -1);

		const longSide = 10 + Math.random() * 30;
		const shortSide = longSide * (0.15 + Math.random() * 0.35);

		const lineLen = Math.random() < 0.72
			? 220 + Math.random() * 280   // long: 220–500
			: 30 + Math.random() * 150;   // short: 30–180

		backdropShapes.push({
			type,
			size: baseSize,
			orbitR,
			orbitAngle: Math.random() * Math.PI * 2,
			orbitSpeed,
			spin: Math.random() * Math.PI * 2,
			spinSpeed: isCircle
				? (0.0007 + Math.random() * 0.0025) * (Math.random() < 0.5 ? 1 : -1)
				: 0,
			arcStart: Math.random() * Math.PI * 2,
			arcSpan: (Math.PI / 3) + Math.random() * (Math.PI * 0.9),
			rectW: longSide,
			rectH: shortSide,
			lineLen,
			lineAngle: Math.random() * Math.PI,
		});
	}

	// Force exactly 3–5 large dashed circles regardless of mix sampling
	const largeCount = 1 + Math.floor(Math.random() * 3);
	let placed = 0;
	for (const s of backdropShapes) {
		if (s.type === "large-dashed-circle") {
			placed++;
			if (placed > largeCount) s.type = "mid-circle"; // demote extras
		}
	}
}

function drawBackdropShape(s: BackdropShape, cx: number, cy: number) {
	const INK = 0;
	// Large dashed circles are concentric — pinned to the page center
	const isConcentric = s.type === "large-dashed-circle";
	const x = isConcentric ? cx : cx + Math.cos(s.orbitAngle) * s.orbitR;
	const y = isConcentric ? cy : cy + Math.sin(s.orbitAngle) * s.orbitR;

	push();
	translate(x, y);

	switch (s.type) {
		case "large-dashed-circle": {
			rotate(s.spin);
			stroke(INK, INK, INK, 60);
			strokeWeight(1.5);
			noFill();
			drawingContext.save();
			const d = Math.max(8, s.size * 0.018);
			drawingContext.setLineDash([d, d * 1.2]);
			ellipse(0, 0, s.size, s.size);
			drawingContext.restore();
			break;
		}
		case "mid-circle": {
			rotate(s.spin);
			stroke(INK, INK, INK, 65);
			strokeWeight(1.5);
			noFill();
			// Alternate between solid-outlined and dashed for variety
			if (s.orbitR % 2 < 1) {
				drawingContext.save();
				const d = Math.max(3, s.size * 0.06);
				drawingContext.setLineDash([d, d * 1.2]);
				ellipse(0, 0, s.size, s.size);
				drawingContext.restore();
			} else {
				ellipse(0, 0, s.size, s.size);
			}
			break;
		}
		case "dot": {
			stroke(INK, INK, INK, 75);
			strokeWeight(1);
			noFill();
			ellipse(0, 0, s.size, s.size);
			break;
		}
		case "arc": {
			stroke(INK, INK, INK, 70);
			strokeWeight(1.5);
			noFill();
			arc(0, 0, s.size, s.size, s.arcStart, s.arcStart + s.arcSpan, OPEN);
			break;
		}
		case "dashed-line": {
			// Inner end stops short of the page center, leaving a small gap
			rotate(s.orbitAngle);
			stroke(INK, INK, INK, 60);
			strokeWeight(1);
			noFill();
			drawingContext.save();
			const d = Math.max(4, s.lineLen * 0.05);
			drawingContext.setLineDash([d, d * 1.3]);
			const centerGap = 18;
			line(-s.orbitR + centerGap, 0, -s.orbitR + s.lineLen, 0);
			drawingContext.restore();
			break;
		}
		case "rectangle": {
			rotate(s.lineAngle); // random orientation
			stroke(INK, INK, INK, 60);
			strokeWeight(1);
			noFill();
			rect(-s.rectW / 2, -s.rectH / 2, s.rectW, s.rectH);
			break;
		}
	}

	pop();
}

function initServiciosBackdrop() {
	// Only runs on desktop index — guard is upstream in renderIndex()
	generateBackdropShapes();

	(window as any).setup = function() {
		const backdropEl = document.getElementById("services-backdrop");
		const c = createCanvas(windowWidth, windowHeight);
		c.style("position", "fixed");
		c.style("top", "0");
		c.style("left", "0");
		c.style("z-index", "0");
		c.style("pointer-events", "none");
		if (backdropEl) backdropEl.appendChild(c.elt);
	};

	(window as any).draw = function() {
		clear();
		const cx = windowWidth / 2;
		const cy = windowHeight / 2;

		// Outer framing dashed circle — larger than the viewport diagonal,
		// only corner arcs are visible, giving a subtle border-frame effect.
		push();
		translate(cx, cy);
		stroke(0, 0, 0, 50);
		strokeWeight(1.5);
		noFill();
		drawingContext.save();
		const frameD = Math.hypot(windowWidth, windowHeight) * 1.15;
		const frameDash = Math.max(14, frameD * 0.012);
		drawingContext.setLineDash([frameDash, frameDash * 1.3]);
		ellipse(0, 0, frameD, frameD);
		drawingContext.restore();
		pop();

		// Giant enclosing dashed circle — wraps most of the viewport
		encloseCircleSpin += encloseCircleSpinSpeed;
		push();
		translate(cx, cy);
		rotate(encloseCircleSpin);
		stroke(0, 0, 0, 70);
		strokeWeight(1.5);
		noFill();
		drawingContext.save();
		const encloseD = Math.min(windowWidth, windowHeight) * 1.05;
		const dash = Math.max(10, encloseD * 0.012);
		drawingContext.setLineDash([dash, dash * 1.3]);
		ellipse(0, 0, encloseD, encloseD);
		drawingContext.restore();
		pop();

		// Huge dashed circle — radius reaches close to the right-side nav
		hugeCircleSpin += hugeCircleSpinSpeed;
		push();
		translate(cx, cy);
		rotate(hugeCircleSpin);
		stroke(0, 0, 0, 55);
		strokeWeight(1.5);
		noFill();
		drawingContext.save();
		const hugeD = windowWidth - 80;
		const hugeDash = Math.max(14, hugeD * 0.013);
		drawingContext.setLineDash([hugeDash, hugeDash * 1.5]);
		ellipse(0, 0, hugeD, hugeD);
		drawingContext.restore();
		pop();

		for (const s of backdropShapes) {
			s.orbitAngle += s.orbitSpeed;
			if (s.spinSpeed !== 0) s.spin += s.spinSpeed;
			drawBackdropShape(s, cx, cy);
		}
	};

	(window as any).windowResized = function() {
		resizeCanvas(windowWidth, windowHeight);
		generateBackdropShapes();
	};
}

// Kick off backdrop on index (mobile + desktop)
if (!detailSlug) {
	initServiciosBackdrop();
}
