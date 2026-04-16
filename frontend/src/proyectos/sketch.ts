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

type BogeyDrawFn = (p: any, x: number, y: number, s: number) => void;

function drawBogeyDiamond(p: any, x: number, y: number, s: number) {
  p.beginShape();
  p.vertex(x, y - s);
  p.vertex(x + s * 0.7, y);
  p.vertex(x, y + s * 0.8);
  p.vertex(x - s * 0.7, y);
  p.endShape(p.CLOSE);
}

function drawBogeyCross(p: any, x: number, y: number, s: number) {
  p.rectMode(p.CENTER);
  const t = s * 0.3;
  p.rect(x, y, s * 1.8, t);
  p.rect(x + s * 0.1, y, t, s * 1.6);
}

function drawBogeyTriangle(p: any, x: number, y: number, s: number) {
  p.beginShape();
  p.vertex(x - s * 0.1, y - s);
  p.vertex(x + s * 0.8, y + s * 0.7);
  p.vertex(x - s * 0.7, y + s * 0.8);
  p.endShape(p.CLOSE);
}

function drawBogeyChevron(p: any, x: number, y: number, s: number) {
  const t = s * 0.25;
  p.beginShape();
  p.vertex(x - s, y + s * 0.5);
  p.vertex(x, y - s * 0.5);
  p.vertex(x + s, y + s * 0.5);
  p.vertex(x + s * 0.7, y + s * 0.5 + t);
  p.vertex(x, y - s * 0.5 + t * 1.5);
  p.vertex(x - s * 0.7, y + s * 0.5 + t);
  p.endShape(p.CLOSE);
}

function drawBogeyBrokenRing(p: any, x: number, y: number, s: number) {
  p.noFill();
  p.strokeWeight(s * 0.25);
  p.arc(x, y, s * 1.6, s * 1.6, 0.4, p.TWO_PI - 0.3);
  p.strokeWeight(1);
}

function drawBogeyDash(p: any, x: number, y: number, s: number) {
  const len = s * 1.6;
  const dashLen = len / 3;
  const gap = dashLen * 0.5;
  p.strokeWeight(s * 0.25);
  p.strokeCap(p.SQUARE);
  const startX = x - len * 0.5;
  for (let d = 0; d < 3; d++) {
    const ax = startX + d * (dashLen + gap);
    p.line(ax, y, ax + dashLen, y);
  }
  p.strokeWeight(1);
}

const BOGEY_DRAW_FUNCS: BogeyDrawFn[] = [
  drawBogeyDiamond,
  drawBogeyCross,
  drawBogeyTriangle,
  drawBogeyChevron,
  drawBogeyBrokenRing,
  drawBogeyDash,
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
  let baseColor: [number, number, number] = [200, 220, 200];
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
      const [cr, cg, cb] = baseColor;

      for (let col = 0; col < bogeyData.length; col++) {
        const slice = bogeyData[col];
        if (!slice) continue;
        const baseX = 20 + col * timeSliceWidth;

        for (const band of slice.bands) {
          if (band.amp < SPAWN_THRESHOLD) continue;

          const sz = p.map(band.amp, SPAWN_THRESHOLD, 255, 4, 28);
          const alpha = p.map(band.amp, SPAWN_THRESHOLD, 255, 60, 220);

          p.push();
          if (band.shapeIndex === 4 || band.shapeIndex === 5) {
            p.noFill();
            p.stroke(cr, cg, cb, alpha);
          } else {
            p.fill(cr, cg, cb, alpha);
            p.noStroke();
          }
          BOGEY_DRAW_FUNCS[band.shapeIndex](p, baseX, band.jitterY, sz);
          p.pop();
        }
      }
    }
  };
}
