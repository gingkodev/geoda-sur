// Audio-reactive bogey sketch — p5.js instance mode
// Each frequency band draws a continuous dotted trail across the canvas,
// like a contour line: a single repeated glyph stamped edge-to-edge along
// the curve traced by that band's amplitude over time.

interface TimeSlice {
	// One Y per band for this time-slice column, or null if the band was
	// below SPAWN_THRESHOLD at sample time (a deliberate trail gap).
	points: (number | null)[];
}

// Band definitions: [lowBin, highBin] out of fftSize/2 = 256 bins
const BAND_RANGES: [number, number][] = [
	[0, 8],      // sub-bass
	[8, 24],     // bass
	[24, 56],    // low-mid
	[56, 112],   // mid
	[112, 180],  // high-mid
	[180, 256],  // treble
];

const NUM_BANDS = BAND_RANGES.length;
const MAX_TIME_SLICES = 60;
const SAMPLE_INTERVAL = 12;   // sample every N frames
const SPAWN_THRESHOLD = 40;   // min amplitude to draw
const STRIP_PADDING = 10;     // keep the curve this far from strip top/bottom
const EMA_FACTOR = 0.5;       // per-sample smoothing so curves flow, not zigzag
const SYMBOL_SIZE = 18;       // px — fixed glyph box size
const STAMP_SPACING = SYMBOL_SIZE * 0.6; // px between stamp centers — deliberately tighter than
                                          // SYMBOL_SIZE so consecutive glyphs overlap a bit within a trail

// Per-band trail rotation, degrees, index-aligned with BAND_RANGES
// (sub-bass, bass, low-mid, mid, high-mid, treble). A knob to experiment
// with — bass currently runs at 45°, high-mid runs vertical.
const BAND_ANGLES = [0, 45, 0, 0, 90, 0];

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

// One fixed glyph per band, index-aligned with BAND_RANGES
// (sub-bass, bass, low-mid, mid, high-mid, treble).
// barra.png, estrella-2.png, estrella-3.png stay unused for now.
const BAND_GLYPH_URLS = [
	urlFor("o.png"),
	urlFor("x.png"),
	urlFor("punto.png"),
	urlFor("guion.png"),
	urlFor("o2.png"),
	urlFor("estrella-1.png"),
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

		p.setup = () => {
			const parent = containerEl ?? p.canvas?.parentElement ?? document.body;
			p.createCanvas(parent.clientWidth, parent.clientHeight);
			p.noStroke();
			recalcLayout();

			bandImages = BAND_GLYPH_URLS.map((url) => p.loadImage(url));
		};

		function recalcLayout() {
			bandHeight = (p.height - 40) / NUM_BANDS;
			timeSliceWidth = (p.width - 40) / MAX_TIME_SLICES;
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

				const stripTop = 20 + i * bandHeight;
				const stripBottom = stripTop + bandHeight;
				// quiet -> near strip bottom, loud -> near strip top
				const target = p.map(
					avg, SPAWN_THRESHOLD, 255,
					stripBottom - STRIP_PADDING, stripTop + STRIP_PADDING
				);
				const y = prevY[i] == null ? target : p.lerp(prevY[i], target, EMA_FACTOR);
				prevY[i] = y;
				points.push(y);
			}

			return { points };
		}

		function stamp(img: any, x: number, y: number) {
			// Rotated trails can run off-canvas (a 90° trail is canvas-width long,
			// drawn vertically) — cheap bounds guard before the image call.
			if (x < -SYMBOL_SIZE || x > p.width + SYMBOL_SIZE || y < -SYMBOL_SIZE || y > p.height + SYMBOL_SIZE) {
				return;
			}
			p.image(img, x - SYMBOL_SIZE / 2, y - SYMBOL_SIZE / 2, SYMBOL_SIZE, SYMBOL_SIZE);
		}

		// Rotation is an isometry and linear, so interpolating in local
		// (unrotated) space and rotating each stamped point afterward still
		// gives correct, even spacing — no need to touch the walking math below.
		function rotateAroundCenter(x: number, y: number, cosT: number, sinT: number, cx: number, cy: number) {
			const dx = x - cx;
			const dy = y - cy;
			return { x: cx + dx * cosT - dy * sinT, y: cy + dx * sinT + dy * cosT };
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

				// Project a local (unrotated) point to screen space and stamp it.
				const project = angleDeg === 0
					? (lx: number, ly: number) => stamp(img, lx, ly)
					: (lx: number, ly: number) => {
						const pt = rotateAroundCenter(lx, ly, cosT, sinT, cx, cy);
						stamp(img, pt.x, pt.y);
					};

				let hasPrev = false;
				let prevX = 0;
				let prevPtY = 0;
				let sinceLastStamp = 0; // distance travelled since the last stamp, in [0, STAMP_SPACING)

				for (let col = 0; col < bogeyData.length; col++) {
					const slice = bogeyData[col];
					const y = slice ? slice.points[band] : null;

					if (y == null) {
						hasPrev = false;
						continue;
					}

					const x = 20 + col * timeSliceWidth;
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
						while (segLen - travelled >= STAMP_SPACING - sinceLastStamp) {
							travelled += STAMP_SPACING - sinceLastStamp;
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
