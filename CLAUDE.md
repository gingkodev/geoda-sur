# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Cardinal

Portfolio site with admin CMS, lightweight blog, and an embedded weather-driven synthesizer instrument.

## Stack

- **Monolith:** Single TypeScript / Node.js app serving everything
  - `/` — public portfolio site (possibly React). Tailwind CSS
  - `/admin/*` — CMS with JWT auth for content, assets, and blog management
  - `/blog/*` — public blog display
  - `/api/*` — content API backed by MySQL
- **Weather Instrument:** Web Audio API, p5.js (instance mode), Open-Meteo API, vanilla ES modules (no bundler) — integration approach TBD
- **Infra:** Docker Compose — app + MySQL + reverse proxy (Nginx or Traefik)
- **Subdomains:** `admin.domain.com` → `/admin/*`, `blog.domain.com` → `/blog/*`, handled at the reverse proxy level

## Project Structure

- `infinite.html` — proof of concept for the portfolio landing page (cartographic canvas UI, p5.js + Tailwind, IBM Plex Mono, pannable/zoomable coordinate space with item cards)
- `js/` — weather instrument source (standalone sub-project, to be moved to its own folder)
- `engine-spec.md`, `weather-instrument-spec.md` — instrument specs (engine spec is in Spanish)

## Weather Instrument

Browser-based rhythmic synth where local weather conditions clamp parameter ranges. One weather fetch on load, coordinates via browser geolocation → IP fallback → manual preset picker.

### Signal chain
Per-note voices (multi-oscillator, envelope) → biquad lowpass (LFO modulated) → dry/delay/reverb → master gain → destination

### Sequencer
Lookahead scheduler: `_tick()` every 25ms, schedules 100ms ahead. Each step rolls probability, applies drift jitter, picks a random note from a latitude-derived scale with longitude register shift.

### Key modules
- `clamp.js` — maps 6 weather values to min/max ranges for 15 synth parameters
- `engine.js` — Web Audio graph, sequencer, voice synthesis
- `ui.js` — p5.js instance-mode UI (phases: loading → fallback → calibration → instrument)
- `geo.js` — geolocation chain (browser → IP fallback via ipapi.co)
- `weather.js` — Open-Meteo API fetch
- `dev.js` — dev mode flag + coordinate presets (Reykjavik, Dubai, Singapore, Denver). Keep commented out in `geo.js` for production

### Geographic identity
- Latitude → musical scale (phrygian at equator → whole tone at poles) + root note shift
- Longitude → register shift (-12 to +12 semitones)

## Conventions

- Specs may be in Spanish; code and comments in English
- IBM Plex Mono is the design typeface
- Tailwind via CDN
- `dev.js` import causes MIME errors on GitHub Pages when file isn't committed — keep it commented out in production
