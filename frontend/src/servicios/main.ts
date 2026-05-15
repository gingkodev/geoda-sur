import "../shared/styles.css";
import { initCursor } from "../shared/cursor";
import { initNav, initMobileNav } from "../shared/nav";
import { getServices, getServiceBySlug, type Project, type Service } from "../shared/api";
import { POST, AUDIO, NOTE, codes, getRandomHex, isDark } from "../shared/colors";
import { t } from "../shared/i18n";

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
	const pageBg = getRandomHex(codes);
	// Guardrail against unreadable text on random backgrounds: dark bg → light text, light bg → dark text.
	const textColor = isDark(pageBg) ? "#f5f3ef" : "#1a1a1a";

	mainEl.innerHTML = `
		<div class="max-w-5xl">
			<a href="/servicios" class="inline-flex items-center gap-2 text-xs md:text-sm tracking-widest uppercase no-underline mb-10 opacity-60 hover:opacity-100 transition-opacity" style="color:${textColor}">
				← ${t("nav.services")}
			</a>
			<h1 id="service-title" class="text-3xl md:text-5xl lg:text-7xl uppercase font-medium tracking-tight leading-[0.95] mb-6 md:mb-8" style="color:${textColor}"></h1>
			<h2 id="service-description" class="text-base md:text-lg lg:text-2xl uppercase font-medium tracking-tight leading-tight max-w-3xl mt-10 md:mt-12 mb-14 md:mb-20"></h2>
			<div id="service-projects-label" class="text-xs md:text-sm tracking-widest uppercase mb-5 hidden opacity-55">${t("services.related")}</div>
			<div id="service-projects" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"></div>
		</div>
	`;

	const applyCut = () => {
		const titleEl = document.getElementById("service-title");
		const descEl = document.getElementById("service-description");
		if (!titleEl || !descEl) return;
		const titleBottom = titleEl.getBoundingClientRect().bottom + window.scrollY;
		const descTop = descEl.getBoundingClientRect().top + window.scrollY;
		const cutY = (titleBottom + descTop) / 2;
		document.body.style.background = `linear-gradient(to bottom, ${pageBg} ${cutY}px, #f5f3ef ${cutY}px)`;
	};

	getServiceBySlug(slug)
		.then(({ service, projects }) => {
			document.getElementById("service-title")!.textContent = service.name.toUpperCase();
			renderProjectGrid(service, projects, pageBg);
			mainEl.style.display = "";
			requestAnimationFrame(applyCut);
			window.addEventListener("resize", applyCut);
		})
		.catch((err) => {
			console.error("Service detail fetch failed:", err);
			mainEl.innerHTML = `
				<div class="max-w-3xl">
					<a href="/servicios" class="inline-flex items-center gap-2 text-xs md:text-sm tracking-widest uppercase no-underline mb-8 opacity-60 hover:opacity-100 transition-opacity">← ${t("nav.services")}</a>
					<p class="text-sm opacity-60">Servicio no encontrado.</p>
				</div>
			`;
			mainEl.style.display = "";
		});
}

function renderProjectGrid(service: Service, projects: Project[], pageBg?: string) {
	const grid = document.getElementById("service-projects")!;
	const description = document.getElementById("service-description")!;
	const label = document.getElementById("service-projects-label")!;

	description.innerHTML = service.description;

	if (!projects.length) {
		grid.innerHTML = `<p class="text-xs text-muted col-span-full">Aún no hay proyectos vinculados a este servicio.</p>`;
		return;
	}

	label.classList.remove("hidden");

	const allColors = [POST, AUDIO, NOTE];
	const pageBgNorm = pageBg?.toLowerCase();
	const palette = pageBgNorm
		? allColors.filter(c => c.toLowerCase() !== pageBgNorm)
		: allColors;
	const activePalette = palette.length > 0 ? palette : allColors;

	const shuffled = [...projects].sort(() => Math.random() - 0.5);

	for (let i = 0; i < shuffled.length; i++) {
		const p = shuffled[i];
		const bg = activePalette[i % activePalette.length];
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
		stroke(26, 26, 26, 50);
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
		push();
		translate(cx, cy);
		stroke(26, 26, 26, 70);
		strokeWeight(1.5);
		noFill();
		drawingContext.save();
		const encloseD = Math.min(windowWidth, windowHeight) * 1.05;
		const dash = Math.max(10, encloseD * 0.012);
		drawingContext.setLineDash([dash, dash * 1.3]);
		ellipse(0, 0, encloseD, encloseD);
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
