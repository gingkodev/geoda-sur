import { getPosition, getPositionByIP } from './geo.js';
import { fetchWeather } from './weather.js';
import { calculateClamps } from './clamp.js';
import { Engine } from './engine.js';
import { initUI } from './ui.js';

const PRESETS = {
  'REYKJAVIK':  { lat: 64.1466, lon: -21.9426 },
  'DUBAI':      { lat: 25.2048, lon: 55.2708 },
  'SINGAPORE':  { lat: 1.3521,  lon: 103.8198 },
  'DENVER':     { lat: 39.7392, lon: -104.9903 },
  'BUENOS AIRES': { lat: -34.6037, lon: -58.3816 },
};

const state = {
  phase: 'loading',
  coords: null,
  weather: null,
  clamps: null,
  engine: null,
  error: null,
  presets: PRESETS,
  continueWithCoords: null,
};

async function calibrate(coords) {
  state.coords = coords;
  state.phase = 'loading';
  try {
    state.weather = await fetchWeather(coords.lat, coords.lon);
    state.clamps = calculateClamps(state.weather);
    state.engine = new Engine(state.clamps);
    state.phase = 'calibration';
  } catch (err) {
    console.error('Cardinal calibration failed:', err);
    state.error = err;
    state.phase = 'denied';
  }
}

state.continueWithCoords = calibrate;

initUI(state);

(async () => {
  try {
    const coords = await getPosition();
    await calibrate(coords);
  } catch (err) {
    console.error('Geolocation failed:', err);
    try {
      const coords = await getPositionByIP();
      await calibrate(coords);
    } catch (ipErr) {
      console.error('IP fallback failed:', ipErr);
      state.phase = 'fallback';
    }
  }
})();
