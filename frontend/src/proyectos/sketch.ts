// Audio-reactive bogey sketch — p5.js instance mode
// Bogeys appear left-to-right across the canvas like a timeline.
// When the right edge is reached, wraps back to the left.
// Color matches the project's card color.

interface BandSlice {
  amp: number;
  jitterY: number;
  shapeIndex: number;
}

interface TimeSlice {
  bands: BandSlice[];
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

type RGB = [number, number, number];
type BogeyDrawFn = (p: any, x: number, y: number, s: number, color: RGB, alpha: number) => void;

// CRT / radar-vector workshop — each shape fits a 2s monospace box.
// Each shape sets its own fill/stroke explicitly; the next call always
// overwrites both, so push/pop is only needed where matrix state is touched.

function drawBogeyDiamond(p: any, x: number, y: number, s: number, color: RGB, alpha: number) {
  const [cr, cg, cb] = color;
  p.noFill();
  p.stroke(cr, cg, cb, alpha);
  p.strokeWeight(Math.max(1.5, s * 0.2));
  p.quad(x, y - s, x + s, y, x, y + s, x - s, y);
}

function drawBogeyCross(p: any, x: number, y: number, s: number, color: RGB, alpha: number) {
  const [cr, cg, cb] = color;
  p.noStroke();
  p.fill(cr, cg, cb, alpha);
  const t = s * 0.3;
  const len = s * 2;
  p.rect(x - s, y - t / 2, len, t);
  p.rect(x - t / 2, y - s, t, len);
}

function drawBogeySquare(p: any, x: number, y: number, s: number, color: RGB, alpha: number) {
  const [cr, cg, cb] = color;
  p.noStroke();
  p.fill(cr, cg, cb, alpha);
  p.rect(x - s, y - s, s * 2, s * 2);
}

function drawBogeyChevron(p: any, x: number, y: number, s: number, color: RGB, alpha: number) {
  const [cr, cg, cb] = color;
  p.noStroke();
  p.fill(cr, cg, cb, alpha);
  const t = s * 0.4;
  const top = y - s * 0.2;
  p.beginShape();
  p.vertex(x - s, top);
  p.vertex(x, y - s);
  p.vertex(x + s, top);
  p.vertex(x + s, top + t);
  p.vertex(x, y - s + t);
  p.vertex(x - s, top + t);
  p.endShape(p.CLOSE);
}

function drawBogeyRing(p: any, x: number, y: number, s: number, color: RGB, alpha: number) {
  const [cr, cg, cb] = color;
  p.noFill();
  p.stroke(cr, cg, cb, alpha);
  p.strokeWeight(Math.max(1.5, s * 0.2));
  p.circle(x, y, s * 1.8);
}

function drawBogeyTee(p: any, x: number, y: number, s: number, color: RGB, alpha: number) {
  const [cr, cg, cb] = color;
  const t = s * 0.3;
  const len = s * 2;
  p.push();
  p.translate(x, y);
  p.rotate(p.QUARTER_PI);
  p.noStroke();
  p.fill(cr, cg, cb, alpha);
  p.rect(-len / 2, -s, len, t);
  p.rect(-t / 2, -t * 2.4, t, t * 2);
  p.pop();
}

const BOGEY_DRAW_FUNCS: BogeyDrawFn[] = [
  drawBogeyDiamond,
  drawBogeyCross,
  drawBogeySquare,
  drawBogeyChevron,
  drawBogeyRing,
  drawBogeyTee,
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

export function createBogeySketch(analyser: AnalyserNode, containerEl?: HTMLElement) {
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  let bogeyData: TimeSlice[] = [];
  let frameCounter = 0;
  let baseColor: [number, number, number] = [249, 249, 249];
  let colCursor = 0; // current time-slice column, wraps around

  return (p: any) => {
    let bandHeight: number;
    let timeSliceWidth: number;

    p.setup = () => {
      const parent = containerEl ?? p.canvas?.parentElement ?? document.body;
      p.createCanvas(parent.clientWidth, parent.clientHeight);
      p.noStroke();
      recalcLayout();
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

      drawBogeys();
    };

    p.windowResized = () => {
      const parent = containerEl ?? p.canvas?.parentElement;
      if (!parent) return;
      p.resizeCanvas(parent.clientWidth, parent.clientHeight);
      recalcLayout();
    };

    (p as any).setBogeyColor = (hex: string) => {
      baseColor = hexToRgb(hex);
    };

    (p as any).clearBogeys = () => {
      bogeyData = [];
      colCursor = 0;
    };

    function sampleBands(): TimeSlice {
      const bands: BandSlice[] = [];
      for (let i = 0; i < NUM_BANDS; i++) {
        const [lo, hi] = BAND_RANGES[i];
        let sum = 0;
        let count = 0;
        for (let b = lo; b < hi; b++) {
          sum += freqData[b];
          count++;
        }
        const avg = sum / count;
        if (avg < SPAWN_THRESHOLD) continue;

        // Only keep ~40% of qualifying bands — less density
        if (p.random() > 0.4) continue;

        const stripTop = 20 + i * bandHeight;
        const jitterY = i === 0
          ? p.height / 2
          : p.random(stripTop + 10, stripTop + bandHeight - 10);

        bands.push({ amp: avg, jitterY, shapeIndex: i % BOGEY_DRAW_FUNCS.length });
      }
      return { bands };
    }

    function drawBogeys() {
      for (let col = 0; col < bogeyData.length; col++) {
        const slice = bogeyData[col];
        if (!slice) continue;
        const baseX = 20 + col * timeSliceWidth;

        for (const band of slice.bands) {
          if (band.amp < SPAWN_THRESHOLD) continue;

          const sz = p.map(band.amp, SPAWN_THRESHOLD, 255, 4, 28);
          const alpha = p.map(band.amp, SPAWN_THRESHOLD, 255, 60, 220);

          BOGEY_DRAW_FUNCS[band.shapeIndex](p, baseX, band.jitterY, sz, baseColor, alpha);
        }
      }
    }
  };
}
