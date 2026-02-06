const LOOKAHEAD_MS = 100;
const TICK_MS = 25;
const BASE_NOTE = 220; // A3

const SCALES = {
  phrygian:       [0, 1, 3, 5, 7, 8, 10],
  mixolydian:     [0, 2, 4, 5, 7, 9, 10],
  dorian:         [0, 2, 3, 5, 7, 9, 10],
  lydian:         [0, 2, 4, 6, 7, 9, 11],
  wholeTone:      [0, 2, 4, 6, 8, 10],
};

function buildIntervals(scale) {
  const intervals = [];
  for (let oct = 0; oct < 2; oct++) {
    for (const s of scale) intervals.push(s + oct * 12);
  }
  intervals.push(24);
  return intervals;
}

function scaleFromLat(lat) {
  const a = Math.abs(lat);
  if (a > 60) return SCALES.wholeTone;
  if (a > 45) return SCALES.lydian;
  if (a > 30) return SCALES.dorian;
  if (a > 15) return SCALES.mixolydian;
  return SCALES.phrygian;
}

export class Engine {
  constructor(clamps, coords) {
    this.ctx = null;
    this.clamps = clamps;
    this.running = false;
    this.muted = false;
    this.timerId = null;
    this.nextNoteTime = 0;

    // Latitude → root note + scale
    const rootShift = Math.round((Math.abs(coords.lat) / 90) * 7);
    this.rootNote = BASE_NOTE * Math.pow(2, rootShift / 12);
    this.scale = scaleFromLat(coords.lat);
    this.intervals = buildIntervals(this.scale);

    // Longitude → register shift (-12 to +12 semitones)
    this.registerShift = Math.round((coords.lon / 180) * 12);

    // Active parameter values — start at midpoints
    this.params = {};
    for (const key of Object.keys(clamps)) {
      this.params[key] = mid(clamps[key]);
    }
  }

  start() {
    this.ctx = new AudioContext();
    this._buildGraph();
    this.running = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this._tick();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.masterGain.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  stop() {
    this.running = false;
    if (this.timerId) clearTimeout(this.timerId);
    if (this.ctx) this.ctx.close();
  }

  setParam(name, value) {
    this.params[name] = value;

    // Live-update continuous nodes
    if (name === 'filterCutoff') this._updateFilter();
    if (name === 'filterLfoRate') this.filterLfo.frequency.value = value;
    if (name === 'filterLfoDepth') this.filterLfoGain.gain.value = value * this.params.filterCutoff;
    if (name === 'reverb') this._updateReverbMix();
    if (name === 'delayFeedback') this.delayFeedbackGain.gain.value = value;
  }

  // --- Audio graph ---

  _buildGraph() {
    const ctx = this.ctx;

    // Master output
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.35;

    // Filter
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = this.params.filterCutoff;
    this.filter.Q.value = 2;

    // Filter LFO
    this.filterLfo = ctx.createOscillator();
    this.filterLfo.type = 'sine';
    this.filterLfo.frequency.value = this.params.filterLfoRate;
    this.filterLfoGain = ctx.createGain();
    this.filterLfoGain.gain.value = this.params.filterLfoDepth * this.params.filterCutoff;
    this.filterLfo.connect(this.filterLfoGain);
    this.filterLfoGain.connect(this.filter.frequency);
    this.filterLfo.start();

    // Delay line
    this.delay = ctx.createDelay(1.0);
    this.delay.delayTime.value = 0.375; // dotted eighth feel
    this.delayFeedbackGain = ctx.createGain();
    this.delayFeedbackGain.gain.value = this.params.delayFeedback;
    this.delayFilter = ctx.createBiquadFilter();
    this.delayFilter.type = 'lowpass';
    this.delayFilter.frequency.value = 2500;

    // Convolution reverb (fake it with feedback delay network)
    // Use a second delay as a diffuse reverb approximation
    this.reverbDelay = ctx.createDelay(0.5);
    this.reverbDelay.delayTime.value = 0.053; // prime-ish interval
    this.reverbFb = ctx.createGain();
    this.reverbFb.gain.value = 0.6;
    this.reverbFilter = ctx.createBiquadFilter();
    this.reverbFilter.type = 'lowpass';
    this.reverbFilter.frequency.value = 3000;

    // Reverb wet/dry
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this._updateReverbMix();

    // --- Routing ---
    // Voice → filter → [dry path + delay path + reverb path] → master → out
    //
    // voice input node (voices connect here)
    this.voiceInput = ctx.createGain();
    this.voiceInput.gain.value = 1;

    // voice → filter
    this.voiceInput.connect(this.filter);

    // filter → dry
    this.filter.connect(this.dryGain);
    this.dryGain.connect(this.masterGain);

    // filter → delay → delay feedback loop → master
    this.filter.connect(this.delay);
    this.delay.connect(this.delayFilter);
    this.delayFilter.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delay);
    this.delayFilter.connect(this.masterGain);

    // filter → reverb loop → wet gain → master
    this.filter.connect(this.reverbDelay);
    this.reverbDelay.connect(this.reverbFilter);
    this.reverbFilter.connect(this.reverbFb);
    this.reverbFb.connect(this.reverbDelay);
    this.reverbFilter.connect(this.wetGain);
    this.wetGain.connect(this.masterGain);

    // master → destination
    this.masterGain.connect(ctx.destination);
  }

  _updateFilter() {
    this.filter.frequency.value = this.params.filterCutoff;
    this.filterLfoGain.gain.value = this.params.filterLfoDepth * this.params.filterCutoff;
  }

  _updateReverbMix() {
    const w = this.params.reverb;
    this.dryGain.gain.value = 1 - w * 0.5;
    this.wetGain.gain.value = w;
  }

  // --- Sequencer ---

  _tick() {
    if (!this.running) return;

    while (this.nextNoteTime < this.ctx.currentTime + LOOKAHEAD_MS / 1000) {
      this._scheduleStep(this.nextNoteTime);
      this._advance();
    }

    this.timerId = setTimeout(() => this._tick(), TICK_MS);
  }

  _advance() {
    const beatSec = 60 / this.params.tempo;
    const subDiv = Math.max(1, Math.round(this.params.density));
    this.nextNoteTime += beatSec / subDiv;
  }

  _scheduleStep(time) {
    // Note probability gate
    if (Math.random() > this.params.probability) return;

    // Timing drift
    const driftSec = ((Math.random() * 2 - 1) * this.params.drift) / 1000;
    const t = Math.max(this.ctx.currentTime, time + driftSec);

    // Velocity
    const baseVel = 0.5;
    const variance = (Math.random() * 2 - 1) * this.params.velocity;
    const vel = Math.max(0.05, Math.min(1, baseVel + variance));

    // Pick a note from location-derived scale and register
    const semitone = this.intervals[Math.floor(Math.random() * this.intervals.length)] + this.registerShift;
    const freq = this.rootNote * Math.pow(2, semitone / 12);

    this._voice(t, vel, freq);

    // Stutter retrigger
    if (Math.random() < this.params.stutter) {
      this._voice(t + 0.04, vel * 0.7, freq);
    }
  }

  // --- Voice: multi-oscillator with envelope ---

  _voice(time, vel, freq) {
    const ctx = this.ctx;
    const p = this.params;

    const numOsc = Math.max(1, Math.round(p.harmonics));
    const attack = p.attack;
    const decay = p.decay;
    const detuneSpread = p.detune;

    // Envelope gain for this voice
    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0, time);
    envGain.gain.linearRampToValueAtTime(vel / numOsc, time + attack);
    envGain.gain.exponentialRampToValueAtTime(0.001, time + attack + decay);
    envGain.connect(this.voiceInput);

    const stopTime = time + attack + decay + 0.05;

    for (let i = 0; i < numOsc; i++) {
      const osc = ctx.createOscillator();

      // Spread oscillator types for richness
      if (numOsc <= 2) {
        osc.type = 'sine';
      } else if (i === 0) {
        osc.type = 'sawtooth';
      } else if (i === 1) {
        osc.type = 'square';
      } else {
        osc.type = (i % 2 === 0) ? 'sawtooth' : 'triangle';
      }

      // Detune: spread symmetrically around center
      const detuneVal = numOsc > 1
        ? (i / (numOsc - 1) - 0.5) * 2 * detuneSpread
        : 0;
      osc.frequency.value = freq;
      osc.detune.value = detuneVal;

      osc.connect(envGain);
      osc.start(time);
      osc.stop(stopTime);
    }
  }
}

function mid(range) {
  return (range.min + range.max) / 2;
}
