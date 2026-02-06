const BG = [10, 14, 10];
const TEXT_DIM = [90, 110, 74];
const TEXT_BRIGHT = [160, 190, 130];
const AMBER = [190, 160, 70];
const GAUGE_BG = [25, 32, 25];
const GAUGE_FILL = [110, 140, 80];
const GAUGE_FILL_TIMBRE = [140, 120, 60];

const PARAM_LABELS = {
  tempo:          'PRESSURE',
  drift:          'HUMIDITY',
  velocity:       'WIND',
  density:        'DENSITY',
  probability:    'VISIBILITY',
  stutter:        'PRECIPITATION',
  harmonics:      'HARMONICS',
  attack:         'ATTACK',
  decay:          'DECAY',
  detune:         'DETUNE',
  reverb:         'WETNESS',
  delayFeedback:  'ECHO',
  filterLfoRate:  'WIND RATE',
  filterLfoDepth: 'WIND DEPTH',
  filterCutoff:   'BRIGHTNESS',
};

const PARAM_UNITS = {
  tempo: 'BPM',
  drift: 'ms',
  velocity: '',
  density: 'n/beat',
  probability: '',
  stutter: '',
  harmonics: 'osc',
  attack: 's',
  decay: 's',
  detune: 'ct',
  reverb: '',
  delayFeedback: '',
  filterLfoRate: 'Hz',
  filterLfoDepth: '',
  filterCutoff: 'Hz',
};

const RHYTHM_PARAMS = ['tempo', 'drift', 'velocity', 'density', 'probability', 'stutter'];
const TIMBRE_PARAMS = ['harmonics', 'attack', 'decay', 'detune', 'reverb', 'delayFeedback', 'filterLfoRate', 'filterLfoDepth', 'filterCutoff'];

export function initUI(state) {
  const s = (p) => {
    let sliders = [];
    let enterBtn = null;
    let muteBtn = null;
    let scrollOffset = 0;

    p.setup = () => {
      p.createCanvas(p.windowWidth, p.windowHeight);
      p.textFont('Courier New');
      p.noStroke();
    };

    p.windowResized = () => {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
      if (state.phase === 'instrument') {
        sliders = buildSliders(p, state.clamps, state.engine);
      }
    };

    p.draw = () => {
      p.background(...BG);

      if (state.phase === 'denied') {
        drawDenied(p);
      } else if (state.phase === 'fallback') {
        drawFallback(p, state);
      } else if (state.phase === 'calibration') {
        drawCalibration(p, state);
      } else if (state.phase === 'instrument') {
        drawInstrument(p, state, sliders);
      } else if (state.phase === 'loading') {
        drawLoading(p);
      }
    };

    let presetBtns = [];

    p.mousePressed = () => {
      if (state.phase === 'fallback') {
        for (const btn of presetBtns) {
          if (p.mouseX >= btn.x && p.mouseX <= btn.x + btn.w &&
              p.mouseY >= btn.y && p.mouseY <= btn.y + btn.h) {
            state.continueWithCoords(btn.coords);
            return;
          }
        }
      }

      if (state.phase === 'instrument' && muteBtn) {
        if (p.mouseX >= muteBtn.x && p.mouseX <= muteBtn.x + muteBtn.w &&
            p.mouseY >= muteBtn.y && p.mouseY <= muteBtn.y + muteBtn.h) {
          state.engine.toggleMute();
          return;
        }
      }

      if (state.phase === 'calibration' && enterBtn) {
        if (p.mouseX >= enterBtn.x && p.mouseX <= enterBtn.x + enterBtn.w &&
            p.mouseY >= enterBtn.y && p.mouseY <= enterBtn.y + enterBtn.h) {
          state.engine.start();
          state.phase = 'instrument';
          sliders = buildSliders(p, state.clamps, state.engine);
        }
      }

      for (const sl of sliders) {
        if (p.mouseX >= sl.x && p.mouseX <= sl.x + sl.w &&
            p.mouseY >= sl.y - 10 && p.mouseY <= sl.y + sl.h + 10) {
          sl.dragging = true;
        }
      }
    };

    p.mouseReleased = () => {
      for (const sl of sliders) sl.dragging = false;
    };

    p.mouseDragged = () => {
      for (const sl of sliders) {
        if (sl.dragging) {
          const t = Math.max(0, Math.min(1, (p.mouseX - sl.x) / sl.w));
          sl.value = sl.min + t * (sl.max - sl.min);
          state.engine.setParam(sl.param, sl.value);
        }
      }
    };

    p.mouseWheel = (e) => {
      if (state.phase === 'instrument') {
        scrollOffset = Math.min(0, scrollOffset - e.delta);
      }
    };

    function drawCalibration(p, state) {
      const cx = p.width / 2;
      let y = p.height * 0.2;
      const lh = 24;

      p.fill(...TEXT_BRIGHT);
      p.textSize(14);
      p.textAlign(p.CENTER, p.CENTER);

      p.text('INSTRUMENT CALIBRATED', cx, y);
      y += lh * 2;

      p.fill(...AMBER);
      const latDir = state.coords.lat >= 0 ? 'N' : 'S';
      const lonDir = state.coords.lon >= 0 ? 'E' : 'W';
      p.text(
        `${Math.abs(state.coords.lat).toFixed(4)}\u00B0${latDir}, ${Math.abs(state.coords.lon).toFixed(4)}\u00B0${lonDir}`,
        cx, y
      );
      y += lh;

      const now = new Date();
      p.fill(...TEXT_DIM);
      p.text(
        `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
        cx, y
      );
      y += lh * 2;

      const w = state.weather;
      p.fill(...TEXT_DIM);
      p.textSize(12);
      p.text(`${w.pressure.toFixed(0)} hPa / ${w.humidity}% RH / ${w.windSpeed} km/h`, cx, y);
      y += lh;
      p.text(`${w.temperature}\u00B0C / cloud ${w.cloudCover}% / precip ${w.precipitation} mm`, cx, y);
      y += lh * 3;

      const bw = 160;
      const bh = 44;
      const bx = cx - bw / 2;
      const by = y;

      enterBtn = { x: bx, y: by, w: bw, h: bh };

      const hover = p.mouseX >= bx && p.mouseX <= bx + bw &&
                    p.mouseY >= by && p.mouseY <= by + bh;

      p.fill(...(hover ? TEXT_BRIGHT : GAUGE_BG));
      p.rect(bx, by, bw, bh, 2);

      p.fill(...(hover ? BG : TEXT_BRIGHT));
      p.textSize(14);
      p.text('[ ENTER ]', cx, by + bh / 2);
    }

    function drawDenied(p) {
      p.fill(...TEXT_DIM);
      p.textSize(14);
      p.textAlign(p.CENTER, p.CENTER);
      p.text('COORDINATES UNKNOWN', p.width / 2, p.height / 2 - 16);
      p.text('INSTRUMENT UNAVAILABLE', p.width / 2, p.height / 2 + 16);
    }

    function drawFallback(p, state) {
      const cx = p.width / 2;
      let y = p.height * 0.2;
      const lh = 24;

      p.fill(...TEXT_DIM);
      p.textSize(12);
      p.textAlign(p.CENTER, p.CENTER);
      p.text('GEOLOCATION UNAVAILABLE', cx, y);
      y += lh * 2;

      p.fill(...TEXT_BRIGHT);
      p.textSize(14);
      p.text('SELECT COORDINATES', cx, y);
      y += lh * 2;

      presetBtns = [];
      const bw = 200;
      const bh = 36;
      const names = Object.keys(state.presets);

      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const bx = cx - bw / 2;
        const by = y;

        const hover = p.mouseX >= bx && p.mouseX <= bx + bw &&
                      p.mouseY >= by && p.mouseY <= by + bh;

        p.fill(...(hover ? TEXT_BRIGHT : GAUGE_BG));
        p.rect(bx, by, bw, bh, 2);

        p.fill(...(hover ? BG : AMBER));
        p.textSize(12);
        p.text(name, cx, by + bh / 2);

        presetBtns.push({ x: bx, y: by, w: bw, h: bh, coords: state.presets[name] });
        y += bh + 12;
      }
    }

    function drawLoading(p) {
      p.fill(...TEXT_DIM);
      p.textSize(12);
      p.textAlign(p.CENTER, p.CENTER);
      p.text('ACQUIRING COORDINATES...', p.width / 2, p.height / 2);
    }

    function drawInstrument(p, state, sliders) {
      p.push();
      p.translate(0, scrollOffset);

      // Coord readout top-left
      p.fill(...TEXT_DIM);
      p.textSize(10);
      p.textAlign(p.LEFT, p.TOP);
      const latDir = state.coords.lat >= 0 ? 'N' : 'S';
      const lonDir = state.coords.lon >= 0 ? 'E' : 'W';
      p.text(
        `${Math.abs(state.coords.lat).toFixed(4)}\u00B0${latDir} ${Math.abs(state.coords.lon).toFixed(4)}\u00B0${lonDir}`,
        20, 20
      );

      // Section labels
      let firstTimbre = sliders.find(s => TIMBRE_PARAMS.includes(s.param));
      if (firstTimbre) {
        p.fill(...TEXT_DIM);
        p.textSize(9);
        p.textAlign(p.LEFT, p.BOTTOM);
        p.text('RHYTHM', sliders[0].x, sliders[0].y - 18);
        p.text('TIMBRE', firstTimbre.x, firstTimbre.y - 18);
      }

      for (const sl of sliders) {
        drawSlider(p, sl);
      }

      // Mute button top-right
      const bw = 80;
      const bh = 28;
      const bx = p.width - bw - 20;
      const by = 14;
      muteBtn = { x: bx, y: by, w: bw, h: bh };

      const muted = state.engine.muted;
      const hover = p.mouseX >= bx && p.mouseX <= bx + bw &&
                    p.mouseY >= by && p.mouseY <= by + bh;

      p.fill(...(hover ? TEXT_BRIGHT : GAUGE_BG));
      p.rect(bx, by, bw, bh, 2);

      p.fill(...(muted ? AMBER : TEXT_DIM));
      p.textSize(10);
      p.textAlign(p.CENTER, p.CENTER);
      p.text(muted ? 'MUTED' : 'MUTE', bx + bw / 2, by + bh / 2);

      p.pop();
    }

    function drawSlider(p, sl) {
      const t = (sl.value - sl.min) / (sl.max - sl.min || 1);
      const isTimbre = TIMBRE_PARAMS.includes(sl.param);

      p.fill(...TEXT_DIM);
      p.textSize(10);
      p.textAlign(p.LEFT, p.BOTTOM);
      p.text(sl.label, sl.x, sl.y - 4);

      p.textAlign(p.RIGHT, p.BOTTOM);
      p.fill(...AMBER);
      const displayVal = (sl.param === 'tempo' || sl.param === 'drift' || sl.param === 'filterCutoff' || sl.param === 'detune' || sl.param === 'harmonics')
        ? sl.value.toFixed(0)
        : sl.value.toFixed(2);
      p.text(`${displayVal} ${sl.unit}`, sl.x + sl.w, sl.y - 4);

      p.fill(...GAUGE_BG);
      p.rect(sl.x, sl.y, sl.w, sl.h, 2);

      p.fill(...(isTimbre ? GAUGE_FILL_TIMBRE : GAUGE_FILL));
      p.rect(sl.x, sl.y, sl.w * t, sl.h, 2);

      p.fill(...TEXT_DIM);
      p.textSize(8);
      p.textAlign(p.LEFT, p.TOP);
      p.text(formatRange(sl.min, sl.param), sl.x, sl.y + sl.h + 3);
      p.textAlign(p.RIGHT, p.TOP);
      p.text(formatRange(sl.max, sl.param), sl.x + sl.w, sl.y + sl.h + 3);
    }

    function formatRange(v, param) {
      return (param === 'tempo' || param === 'drift' || param === 'filterCutoff' || param === 'detune' || param === 'harmonics')
        ? v.toFixed(0) : v.toFixed(2);
    }
  };

  new p5(s);
}

function buildSliders(p, clamps, engine) {
  const allParams = [...RHYTHM_PARAMS, ...TIMBRE_PARAMS];
  const sliders = [];
  const margin = 40;
  const sliderW = Math.min(400, p.width - margin * 2);
  const sliderH = 12;
  const startX = (p.width - sliderW) / 2;
  let y = 60;
  const gap = 50;
  const sectionGap = 30;

  for (let i = 0; i < allParams.length; i++) {
    const param = allParams[i];
    if (!clamps[param]) continue;

    // Add section gap before timbre params
    if (param === TIMBRE_PARAMS[0]) y += sectionGap;

    const range = clamps[param];
    sliders.push({
      param,
      label: PARAM_LABELS[param],
      unit: PARAM_UNITS[param],
      x: startX,
      y: y,
      w: sliderW,
      h: sliderH,
      min: range.min,
      max: range.max,
      value: engine.params[param],
      dragging: false,
    });
    y += gap;
  }

  return sliders;
}
