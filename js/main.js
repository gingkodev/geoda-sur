import { getPosition } from './geo.js';
import { fetchWeather } from './weather.js';
import { calculateClamps } from './clamp.js';
import { Engine } from './engine.js';
import { initUI } from './ui.js';

const state = {
  phase: 'loading',
  coords: null,
  weather: null,
  clamps: null,
  engine: null,
  error: null,
};

initUI(state);

(async () => {
  try {
    state.coords = await getPosition();
    state.weather = await fetchWeather(state.coords.lat, state.coords.lon);
    state.clamps = calculateClamps(state.weather);
    state.engine = new Engine(state.clamps);
    state.phase = 'calibration';
  } catch (err) {
    console.error('Cardinal init failed:', err);
    state.error = err;
    state.phase = 'denied';
  }
})();
