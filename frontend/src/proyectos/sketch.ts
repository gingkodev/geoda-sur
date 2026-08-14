// Audio-reactive bogey sketch — p5.js instance mode
// Each frequency band draws a continuous dotted trail across the canvas,
// like a contour line: a single repeated glyph stamped edge-to-edge along
// the curve traced by that band's amplitude over time.

interface TimeSlice {
	// One Y per band for this time-slice column, or null if the band was
	// below SPAWN_THRESHOLD at sample time (a deliberate trail gap).
	points: (number | null)[];
}

// Band definitions: [lowBin, highBin] out of fftSize/2 = 256 bins.
// Twelve strips, roughly logarithmic. Six resolved so little of the spectrum
// that a whole track read as one or two lines drifting across the hero; the
// FFT is untouched, the same bins are just split finer.
const BAND_RANGES: [number, number][] = [
	[0, 4],      // sub-bass
	[4, 8],
	[8, 14],     // bass
	[14, 22],
	[22, 32],    // low-mid
	[32, 46],
	[46, 64],    // mid
	[64, 88],
	[88, 118],   // high-mid
	[118, 156],
	[156, 204],  // treble
	[204, 256],
];

const NUM_BANDS = BAND_RANGES.length;
const MAX_TIME_SLICES = 60;
const SAMPLE_INTERVAL = 12;   // sample every N frames
const SPAWN_THRESHOLD = 40;   // min amplitude to draw
const MARGIN = 12;            // px between the canvas edge and the band stack
const EMA_FACTOR = 0.5;       // per-sample smoothing so curves flow, not zigzag

// Glyph geometry is derived from the strip a band gets rather than fixed, so
// twelve trails stay separable in a 45vh hero the way six did at 18px. Clamped
// at both ends: never so small it reads as noise, never back to a glyph taller
// than its own strip.
const SYMBOL_RATIO = 0.34;        // of band height
const MIN_SYMBOL_SIZE = 6;
const MAX_SYMBOL_SIZE = 14;
const STAMP_SPACING_RATIO = 0.6;  // of symbol size — tighter than the glyph, so
                                  // consecutive stamps overlap a bit within a trail
const STRIP_PADDING_RATIO = 0.18; // keep the curve this far from strip top/bottom

// Per-band trail rotation, degrees, index-aligned with BAND_RANGES. A knob to
// experiment with — the bass keeps its 45° diagonal and the high-mid its
// vertical run, one of each rather than one per six bands, since twelve
// rotated trails crossing the stack would just be noise.
const BAND_ANGLES = [0, 0, 45, 0, 0, 0, 0, 0, 90, 0, 0, 0];

// Bogey PNG symbols, keyed by filename (glob order is just alphabetical
// and not meaningful here).
const bogeyGlob = import.meta.glob("./bogeys/*.png", {
	eager: true,
	query: "?url",
	import: "default",
}) as Record<string, string>;

function urlFor(filename: string): string {
	const url = bogeyGlob[`./bogeys/${filename}`];
	if (!url) throw new Error(`bogey asset not found: ${filename}`);
	return url;
}

// One fixed glyph per band, index-aligned with BAND_RANGES. Twelve bands
// against nine PNGs, so three repeat — kept apart in the stack so no two
// neighbouring trails share a glyph.
const BAND_GLYPH_URLS = [
	urlFor("o.png"),
	urlFor("punto.png"),
	urlFor("x.png"),
	urlFor("guion.png"),
	urlFor("o2.png"),
	urlFor("estrella-1.png"),
	urlFor("barra.png"),
	urlFor("punto.png"),
	urlFor("estrella-2.png"),
	urlFor("guion.png"),
	urlFor("estrella-3.png"),
	urlFor("o2.png"),
];

export function createBogeySketch(analyser: AnalyserNode, containerEl?: HTMLElement) {
	const freqData = new Uint8Array(analyser.frequencyBinCount);
	let bogeyData: TimeSlice[] = [];
	let frameCounter = 0;
	let colCursor = 0; // current time-slice column, wraps around

	// Per-band EMA state — smooths the curve across sample ticks, independent
	// of which column it lands on. Reset to null on a gap (no continuity
	// across a break) and by clearBogeys.
	let prevY: (number | null)[] = new Array(NUM_BANDS).fill(null);

	let bandImages: any[] = [];

	return (p: any) => {
		let bandHeight: number;
		let timeSliceWidth: number;
		let symbolSize: number;
		let stampSpacing: number;
		let stripPadding: number;

		p.setup = () => {
			const parent = containerEl ?? p.canvas?.parentElement ?? document.body;
			p.createCanvas(parent.clientWidth, parent.clientHeight);
			p.noStroke();
			recalcLayout();

			// Repeated glyphs share one p5.Image — twelve bands, nine requests.
			const decoded = new Map<string, any>();
			bandImages = BAND_GLYPH_URLS.map((url) => {
				if (!decoded.has(url)) decoded.set(url, p.loadImage(url));
				return decoded.get(url);
			});
		};

		function recalcLayout() {
			bandHeight = (p.height - MARGIN * 2) / NUM_BANDS;
			timeSliceWidth = (p.width - MARGIN * 2) / MAX_TIME_SLICES;
			symbolSize = Math.min(MAX_SYMBOL_SIZE, Math.max(MIN_SYMBOL_SIZE, bandHeight * SYMBOL_RATIO));
			stampSpacing = symbolSize * STAMP_SPACING_RATIO;
			stripPadding = bandHeight * STRIP_PADDING_RATIO;
		}

		p.draw = () => {
			p.clear();
			frameCounter++;

			analyser.getByteFrequencyData(freqData);

			// Check if there's meaningful audio
			let hasAudio = false;
			for (let i = 0; i < freqData.length; i++) {
				if (freqData[i] > 10) { hasAudio = true; break; }
			}

			if (hasAudio && frameCounter % SAMPLE_INTERVAL === 0) {
				const slice = sampleBands();
				// Place at current cursor, overwriting old data
				bogeyData[colCursor] = slice;
				colCursor = (colCursor + 1) % MAX_TIME_SLICES;
			}

			drawTrails();
		};

		p.windowResized = () => {
			const parent = containerEl ?? p.canvas?.parentElement;
			if (!parent) return;
			p.resizeCanvas(parent.clientWidth, parent.clientHeight);
			recalcLayout();
		};

		// Derived geometry (band height, glyph size, spacing) is only recomputed on
		// setup and windowResized. main.ts resizes the canvas itself when it moves
		// the sketch to another hero, so it needs a way to ask for the same pass.
		(p as any).relayout = recalcLayout;

		(p as any).clearBogeys = () => {
			bogeyData = [];
			colCursor = 0;
			prevY = new Array(NUM_BANDS).fill(null);
		};

		function sampleBands(): TimeSlice {
			const points: (number | null)[] = [];

			for (let i = 0; i < NUM_BANDS; i++) {
				const [lo, hi] = BAND_RANGES[i];
				let sum = 0;
				let count = 0;
				for (let b = lo; b < hi; b++) {
					sum += freqData[b];
					count++;
				}
				const avg = sum / count;

				if (avg < SPAWN_THRESHOLD) {
					points.push(null);
					prevY[i] = null; // break the flow — next sample starts fresh
					continue;
				}

				const stripTop = MARGIN + i * bandHeight;
				const stripBottom = stripTop + bandHeight;
				// quiet -> near strip bottom, loud -> near strip top
				const target = p.map(
					avg, SPAWN_THRESHOLD, 255,
					stripBottom - stripPadding, stripTop + stripPadding
				);
				const y = prevY[i] == null ? target : p.lerp(prevY[i], target, EMA_FACTOR);
				prevY[i] = y;
				points.push(y);
			}

			return { points };
		}

		function stamp(img: any, x: number, y: number) {
			// Cheap bounds guard before the image call. fitTrail() keeps rotated
			// trails inside the hero, but a curve can still poke past an edge.
			if (x < -symbolSize || x > p.width + symbolSize || y < -symbolSize || y > p.height + symbolSize) {
				return;
			}
			p.image(img, x - symbolSize / 2, y - symbolSize / 2, symbolSize, symbolSize);
		}

		// Rotation and uniform scaling are both linear about the same centre, so
		// interpolating in local (unrotated) space and transforming each stamped
		// point afterward still gives correct, even spacing — the walking math
		// below only has to divide its step by the scale to compensate.
		function placePoint(x: number, y: number, s: number, cosT: number, sinT: number, cx: number, cy: number) {
			const dx = (x - cx) * s;
			const dy = (y - cy) * s;
			return { x: cx + dx * cosT - dy * sinT, y: cy + dx * sinT + dy * cosT };
		}

		// A trail is as long as the hero is wide, so a rotated one used to run
		// clear off the top and bottom — the 90° band drew a canvas-width column
		// through a half-height image and lost most of its history to the bounds
		// guard. Shrink the trail about the canvas centre by whatever factor makes
		// its rotated bounding box fit inside the image. Unrotated bands are
		// already inside it by construction and come back 1.
		function fitTrail(cosT: number, sinT: number, stripCenterY: number) {
			const trailW = (MAX_TIME_SLICES - 1) * timeSliceWidth + symbolSize;
			const trailH = bandHeight + symbolSize;
			const halfW = (trailW * Math.abs(cosT) + trailH * Math.abs(sinT)) / 2;
			const halfH = (trailW * Math.abs(sinT) + trailH * Math.abs(cosT)) / 2;
			// The strip sits off-centre, and rotation swings that offset around
			// with it, so it counts against the budget alongside the half-extents.
			const dy = stripCenterY - p.height / 2;
			const offX = Math.abs(dy * sinT);
			const offY = Math.abs(dy * cosT);
			return Math.min(1, (p.width / 2) / (halfW + offX), (p.height / 2) / (halfH + offY));
		}

		function drawTrails() {
			const cx = p.width / 2;
			const cy = p.height / 2;

			for (let band = 0; band < NUM_BANDS; band++) {
				const img = bandImages[band];
				if (!img || !img.width) continue; // glyph not decoded yet — skip this band this frame

				const angleDeg = BAND_ANGLES[band] ?? 0;
				const angleRad = (angleDeg * Math.PI) / 180;
				const cosT = Math.cos(angleRad);
				const sinT = Math.sin(angleRad);

				const fit = angleDeg === 0
					? 1
					: fitTrail(cosT, sinT, MARGIN + (band + 0.5) * bandHeight);
				// Walk the curve in local space with a proportionally longer step so
				// a shrunk trail keeps the same stamp density on screen.
				const spacing = stampSpacing / fit;

				// Project a local (unrotated) point to screen space and stamp it.
				const project = angleDeg === 0
					? (lx: number, ly: number) => stamp(img, lx, ly)
					: (lx: number, ly: number) => {
						const pt = placePoint(lx, ly, fit, cosT, sinT, cx, cy);
						stamp(img, pt.x, pt.y);
					};

				let hasPrev = false;
				let prevX = 0;
				let prevPtY = 0;
				let sinceLastStamp = 0; // distance travelled since the last stamp, in [0, spacing)

				for (let col = 0; col < bogeyData.length; col++) {
					const slice = bogeyData[col];
					const y = slice ? slice.points[band] : null;

					if (y == null) {
						hasPrev = false;
						continue;
					}

					const x = MARGIN + col * timeSliceWidth;
					// Ring seam: col holds the oldest surviving data and col-1 holds the
					// newest write — never connect across that jump in time.
					const seamBreak = col === colCursor;

					if (!hasPrev || seamBreak) {
						project(x, y);
						sinceLastStamp = 0;
					} else {
						const dx = x - prevX;
						const dy = y - prevPtY;
						const segLen = Math.sqrt(dx * dx + dy * dy);
						let travelled = 0;
						while (segLen - travelled >= spacing - sinceLastStamp) {
							travelled += spacing - sinceLastStamp;
							const t = travelled / segLen;
							project(prevX + dx * t, prevPtY + dy * t);
							sinceLastStamp = 0;
						}
						sinceLastStamp += segLen - travelled;
					}

					hasPrev = true;
					prevX = x;
					prevPtY = y;
				}
			}
		}
	};
}
