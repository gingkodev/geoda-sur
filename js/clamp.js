// Maps weather values to min/max ranges for synth parameters.

function lerp(value, inMin, inMax, outMin, outMax) {
  const t = Math.max(0, Math.min(1, (value - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

function fixed(v, d = 2) {
  return parseFloat(v.toFixed(d));
}

export function calculateClamps(weather) {
  const { temperature, humidity, windSpeed, pressure, cloudCover, precipitation } = weather;

  // --- RHYTHM CLAMPS (same axis mapping as before) ---

  // temperature → tempo BPM range (within 40–260)
  const tempoCenter = lerp(temperature, -30, 50, 60, 220);
  const tempoSpan = 40;
  const tempoMin = Math.max(40, tempoCenter - tempoSpan / 2);
  const tempoMax = Math.min(260, tempoCenter + tempoSpan / 2);

  // humidity → max timing drift in ms (0–120)
  const driftMax = lerp(humidity, 0, 100, 0, 120);

  // windSpeed → velocity variance 0–1
  const velocityVarianceMax = lerp(windSpeed, 0, 80, 0, 1);

  // pressure → event density: notes per beat (1–4)
  const densityMax = lerp(pressure, 960, 1050, 1, 4);

  // cloudCover → note probability floor/ceiling
  const probCeiling = lerp(cloudCover, 0, 100, 1.0, 0.5);
  const probFloor = lerp(cloudCover, 0, 100, 0.9, 0.15);

  // precipitation → stutter probability 0–0.7
  const stutterMax = lerp(precipitation, 0, 10, 0, 0.7);

  // --- TIMBRE CLAMPS (weather shapes the voice) ---

  // temperature → harmonic richness: number of detuned oscillators (1–6)
  // cold = thin (1–2), hot = fat organ stack (4–6)
  const harmMin = Math.round(lerp(temperature, -30, 50, 1, 3));
  const harmMax = Math.round(lerp(temperature, -30, 50, 2, 6));

  // temperature → attack time in seconds
  // cold = sharp transient (0.001–0.01), hot = slow pad swell (0.02–0.2)
  const attackMin = fixed(lerp(temperature, -30, 50, 0.001, 0.02), 3);
  const attackMax = fixed(lerp(temperature, -30, 50, 0.01, 0.2), 3);

  // temperature → decay/release time in seconds
  // cold = short ping (0.05–0.15), hot = long sustain (0.3–1.5)
  const decayMin = fixed(lerp(temperature, -30, 50, 0.05, 0.3));
  const decayMax = fixed(lerp(temperature, -30, 50, 0.15, 1.5));

  // temperature → detune spread in cents (0–50)
  // cold = clean (0–5), hot = wide chorus (15–50)
  const detuneMin = Math.round(lerp(temperature, -30, 50, 0, 15));
  const detuneMax = Math.round(lerp(temperature, -30, 50, 5, 50));

  // humidity → reverb/delay wetness (0–1)
  // dry climate = dry signal, humid = drenched
  const reverbMin = fixed(lerp(humidity, 0, 100, 0, 0.1));
  const reverbMax = fixed(lerp(humidity, 0, 100, 0.05, 0.85));

  // humidity → delay feedback (0–0.85)
  const delayFbMin = fixed(lerp(humidity, 0, 100, 0, 0.05));
  const delayFbMax = fixed(lerp(humidity, 0, 100, 0.05, 0.75));

  // windSpeed → filter LFO rate in Hz (0–8)
  // calm = static, windy = sweeping
  const filterLfoMin = fixed(lerp(windSpeed, 0, 80, 0, 0.5));
  const filterLfoMax = fixed(lerp(windSpeed, 0, 80, 0.1, 8));

  // windSpeed → filter LFO depth (0–1)
  const filterDepthMin = fixed(lerp(windSpeed, 0, 80, 0, 0.05));
  const filterDepthMax = fixed(lerp(windSpeed, 0, 80, 0.05, 0.9));

  // cloudCover → filter cutoff base frequency (200–8000 Hz)
  // clear = bright open, overcast = muffled
  const filterMin = Math.round(lerp(cloudCover, 0, 100, 4000, 200));
  const filterMax = Math.round(lerp(cloudCover, 0, 100, 8000, 1200));

  return {
    // Rhythm
    tempo:       { min: Math.round(tempoMin), max: Math.round(tempoMax) },
    drift:       { min: 0, max: Math.round(driftMax) },
    velocity:    { min: 0, max: fixed(velocityVarianceMax) },
    density:     { min: 1, max: fixed(densityMax, 1) },
    probability: { min: fixed(probFloor), max: fixed(probCeiling) },
    stutter:     { min: 0, max: fixed(stutterMax) },
    // Timbre
    harmonics:   { min: harmMin, max: harmMax },
    attack:      { min: attackMin, max: attackMax },
    decay:       { min: decayMin, max: decayMax },
    detune:      { min: detuneMin, max: detuneMax },
    reverb:      { min: reverbMin, max: reverbMax },
    delayFeedback: { min: delayFbMin, max: delayFbMax },
    filterLfoRate: { min: filterLfoMin, max: filterLfoMax },
    filterLfoDepth: { min: filterDepthMin, max: filterDepthMax },
    filterCutoff:  { min: filterMin, max: filterMax },
  };
}
