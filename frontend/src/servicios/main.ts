import "../shared/styles.css";
import { initCursor } from "../shared/cursor";
import { initNav, initMobileNav } from "../shared/nav";
import { getServices, getServiceBySlug, type Project } from "../shared/api";
import { POST, AUDIO, NOTE } from "../shared/colors";

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
declare const noStroke: any;
declare const fill: any;
declare const noFill: any;
declare const ellipse: any;
declare const line: any;
declare const rect: any;
declare const arc: any;
declare const drawingContext: CanvasRenderingContext2D;
declare const width: number;
declare const height: number;
declare const OPEN: any;

initCursor();
const isMobile = window.innerWidth < 768;
if (isMobile) {
	initMobileNav(document.getElementById("nav"));
} else {
	initNav(document.getElementById("nav"));
}

const mainEl = document.getElementById("services-main")!;

function slugify(name: string): string {
	return name
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

function truncate(str: string, max: number): string {
	return str.length <= max ? str : str.substring(0, max).trimEnd() + "…";
}

const segments = location.pathname.split("/").filter(Boolean);
const detailSlug = segments[0] === "servicios" && segments[1] ? decodeURIComponent(segments[1]) : null;

if (detailSlug) {
	renderDetail(detailSlug);
} else {
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
				const li = document.createElement("li");
				li.className = "service-row py-2 md:py-2.5";
				li.innerHTML = `
					<a href="/servicios/${slug}"
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

function renderDetail(slug: string) {
	mainEl.innerHTML = `
		<div class="max-w-5xl">
			<a href="/servicios" class="inline-flex items-center gap-2 text-[10px] tracking-widest uppercase text-muted no-underline mb-12 hover:text-ink transition-colors">
				← Servicios
			</a>
			<h1 id="service-title" class="text-3xl md:text-5xl lg:text-7xl uppercase font-medium tracking-tight leading-[0.95] mb-16 md:mb-24"></h1>
			<div id="service-projects-label" class="text-[10px] tracking-widest uppercase text-muted mb-4 hidden">Proyectos relacionados</div>
			<div id="service-projects" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"></div>
		</div>
	`;

	getServiceBySlug(slug)
		.then(({ service, projects }) => {
			document.getElementById("service-title")!.textContent = service.name.toUpperCase();
			renderProjectGrid(projects);
			mainEl.style.display = "";
		})
		.catch((err) => {
			console.error("Service detail fetch failed:", err);
			mainEl.innerHTML = `
				<div class="max-w-3xl">
					<a href="/servicios" class="inline-flex items-center gap-2 text-[10px] tracking-widest uppercase text-muted no-underline mb-8 hover:text-ink transition-colors">← Servicios</a>
					<p class="text-sm text-muted">Servicio no encontrado.</p>
				</div>
			`;
			mainEl.style.display = "";
		});
}

function renderProjectGrid(projects: Project[]) {
	const grid = document.getElementById("service-projects")!;
	const label = document.getElementById("service-projects-label")!;
	if (!projects.length) {
		grid.innerHTML = `<p class="text-xs text-muted col-span-full">Aún no hay proyectos vinculados a este servicio.</p>`;
		return;
	}

	label.classList.remove("hidden");

	const palette = [POST, AUDIO, NOTE];
	const shuffled = [...projects].sort(() => Math.random() - 0.5);

	for (let i = 0; i < shuffled.length; i++) {
		const p = shuffled[i];
		const bg = palette[i % palette.length];
		const pslug = slugify(p.name);
		const card = document.createElement("a");
		card.href = `/proyectos#${pslug}`;
		card.className = "block p-5 text-[10px] leading-[14px] no-underline text-ink min-h-[180px] transition-opacity duration-150 hover:opacity-85";
		card.style.backgroundColor = bg;
		card.innerHTML = `
			<div class="text-sm uppercase tracking-tight font-medium leading-tight mb-3">${p.name.toUpperCase()}</div>
			${p.writeup ? `<div class="opacity-80">${truncate(p.writeup.toUpperCase(), 160)}</div>` : ""}
		`;
		grid.appendChild(card);
	}
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

function sizeForType(type: ShapeType): number {
	switch (type) {
		case "large-dashed-circle": return 400 + Math.random() * 500;   // 400–900  (big frames)
		case "mid-circle":          return 30  + Math.random() * 150;   // 30–180   (outlined, no fill)
		case "dot":                 return 3   + Math.random() * 12;    // 3–15     (hairline dot)
		case "arc":                 return 60  + Math.random() * 190;   // 60–250
		case "dashed-line":         return 0;                           // unused; lineLen drives it
		case "rectangle":           return 0;                           // unused; rectW/H drive it
	}
}

function generateBackdropShapes() {
	backdropShapes = [];
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	// Orbit extends past viewport edges so shapes drift in from outside
	const maxR = Math.hypot(vw, vh) * 0.52;

	// Heavy weighting toward tiny dots — matches the star-chart reference density
	// ~50% dots, ~15% mid-circles, ~10% large dashed frames, ~10% arcs, ~8% rects, ~7% lines
	const typeMix: ShapeType[] = [
		"dot", "dot", "dot", "dot", "dot",  // 5 dots
		"dot", "dot", "dot", "dot", "dot",  // 10 dots
		"mid-circle", "mid-circle",          // 2 mid
		"large-dashed-circle",               // 1 large
		"arc",                               // 1 arc
		"rectangle",                         // 1 rect
		"dashed-line", "dashed-line",        // 2 lines
		"dashed-line", "dashed-line",        // 4 lines
		"dot", "dot",                        // +2 more dots
	];
	// Expand to ~100 shapes by repeating the mix
	const count = 100;

	for (let i = 0; i < count; i++) {
		const type = typeMix[i % typeMix.length] as ShapeType;
		const baseSize = sizeForType(type);
		const isCircle = type === "large-dashed-circle" || type === "mid-circle" || type === "dot";

		// Fully random orbit radii — avoids visible banding
		const orbitR = Math.random() * maxR;
		const orbitSpeed = (0.0004 + Math.random() * 0.0016) * (Math.random() < 0.5 ? 1 : -1);

		// Rectangles: slender tick-mark proportions, 10–40px long side
		const longSide  = 10 + Math.random() * 30;
		const shortSide = longSide * (0.15 + Math.random() * 0.35);

		// Lines: mostly short, occasional long one
		const lineLen = Math.random() < 0.12
			? 200 + Math.random() * 200   // rare long: 200–400
			: 30  + Math.random() * 150;  // common short: 30–180

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
	const largeCount = 3 + Math.floor(Math.random() * 3);
	let placed = 0;
	for (const s of backdropShapes) {
		if (s.type === "large-dashed-circle") {
			placed++;
			if (placed > largeCount) s.type = "mid-circle"; // demote extras
		}
	}
}

function drawBackdropShape(s: BackdropShape, cx: number, cy: number) {
	const INK = 26;
	const x = cx + Math.cos(s.orbitAngle) * s.orbitR;
	const y = cy + Math.sin(s.orbitAngle) * s.orbitR;

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
			rotate(s.lineAngle);
			stroke(INK, INK, INK, 60);
			strokeWeight(1);
			noFill();
			drawingContext.save();
			const d = Math.max(4, s.lineLen * 0.05);
			drawingContext.setLineDash([d, d * 1.3]);
			line(-s.lineLen / 2, 0, s.lineLen / 2, 0);
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

	(window as any).setup = function () {
		const backdropEl = document.getElementById("services-backdrop");
		const c = createCanvas(windowWidth, windowHeight);
		c.style("position", "fixed");
		c.style("top", "0");
		c.style("left", "0");
		c.style("z-index", "0");
		c.style("pointer-events", "none");
		if (backdropEl) backdropEl.appendChild(c.elt);
	};

	(window as any).draw = function () {
		clear();
		const cx = windowWidth / 2;
		const cy = windowHeight / 2;
		for (const s of backdropShapes) {
			s.orbitAngle += s.orbitSpeed;
			if (s.spinSpeed !== 0) s.spin += s.spinSpeed;
			drawBackdropShape(s, cx, cy);
		}
	};

	(window as any).windowResized = function () {
		resizeCanvas(windowWidth, windowHeight);
	};
}

// Kick off backdrop only on index, desktop
if (!detailSlug && !isMobile) {
	initServiciosBackdrop();
}
