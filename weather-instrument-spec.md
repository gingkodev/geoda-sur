# Weather-Clamped Lunar Instrument

## Concept

A browser-based rhythmic instrument where the user's local weather conditions determine the available parameter ranges. You don't control the instrument's limits — the atmosphere does.

One fetch on load. One snapshot of conditions. That's your instrument for the session.

No geolocation, no instrument. No fallbacks, no apologies.

---

## Core Architecture

### Stack

| Layer | Technology | Role |
|-------|------------|------|
| Audio engine | WebPd | Clock, DSP, timing-critical stuff |
| Interface | p5.js | Visuals, controls, weather display |
| Weather data | Open-Meteo API | Free, no key, CORS-friendly |
| Geolocation | Browser API | Hard requirement, no fallback |

### Flow

```
User arrives
    ↓
Throttle check — capacity available?
    ↓ yes                      ↓ no
Geolocation prompt         "Come back later"
    ↓ granted    ↓ denied
Fetch weather   "No instrument for you"
    ↓
Clamp calculation
    ↓
Instrument renders
    ↓
Play
```

---

## The Rhythm Engine

### Philosophy

An arpeggiator that can forget what it's doing.

At one extreme: tight, grid-locked, mechanical.
At the other: events scatter probabilistically, the pulse becomes a statistical tendency rather than a rule.

### Single Voice (v1)

- One sound source (short percussive ping — sine/triangle with fast envelope)
- One clock
- Parameters that let it dissolve gracefully

### Core Parameters

| Parameter | Description | Musical effect |
|-----------|-------------|----------------|
| **Pressure** | Event density / base tempo | How fast, how many |
| **Humidity** | Timing drift | How far events stray from grid |
| **Wind** | Accent chaos / velocity spread | Dynamic unpredictability |
| **Visibility** | Note probability (doubt) | How often events skip |
| **Precipitation** | Stutter / retrigger probability | Doubles, fills, bursts |

### The Dissolution Spectrum

```
TIGHT                                              GRANULAR
  |                                                    |
  rigid grid ---- swing ---- stumble ---- scatter ---- dust
  |                                                    |
  clock is law                           clock is rumor
```

Weather conditions clamp how far along this spectrum you can push each parameter.

---

## Weather → Clamp Mapping

Weather fetched once via Open-Meteo. Values become min/max ranges.

### Example Logic (to be tuned by ear)

```
temperature     → base tempo range
humidity        → max drift amount
wind_speed      → velocity variance range
pressure        → event density limits
cloud_cover     → note probability floor/ceiling
precipitation   → stutter probability range
```

### Atmospheric Interface Language

Controls are labeled in weather terms, not musical terms:

- "Pressure" not "tempo"
- "Humidity" not "swing"
- "Visibility" not "probability"

User adjusts these within their weather-determined bounds.

---

## Visual Direction

### Aesthetic: Lunar Cartography

Not Pd. Not a DAW. A survey terminal from an alternate space program.

References:
- Soviet Lunokhod mission graphics
- USGS astrogeology maps
- Old lunar orbiter photography
- Oscilloscope / vector display
- Topographic elevation contours
- Thermal imaging color ramps (stark, limited palette)

### Interface Elements

- Coordinate readout (user's lat/lon)
- Timestamp (moment of calibration)
- Weather values as instrument specs
- Parameter controls as gauges / dials / sliders
- Lunar surface as background texture or map
- Possibly: a coordinate field for performance gestures

### Calibration Display

On load, show something like:

```
INSTRUMENT CALIBRATED
52.5200°N, 13.4050°E
14:23 UTC / 2024-01-15

1013 hPa / 62% RH / 12 km/h NW
visibility 14 km / overcast

[ ENTER ]
```

### Denied State

Geolocation refused → blank lunar surface, no controls.

```
COORDINATES UNKNOWN
INSTRUMENT UNAVAILABLE
```

Cold. Factual. No guilt trip.

---

## Technical Notes

### WebPd Integration

- Pd patch runs headless (no visual patching in browser)
- p5.js sends control values via WebPd message API
- Pd handles all timing-critical operations
- JS handles UI, weather fetch, geolocation

### Open-Meteo

Endpoint example:
```
https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true&hourly=relativehumidity_2m,surface_pressure,cloudcover,precipitation,windspeed_10m
```

No API key. Returns JSON. CORS works.

### Throttling

Details TBD. Likely a simple counter or queue at the gate. Purpose: keep server load sane, add scarcity/intentionality to access.

### Testing Mode

Hardcoded lat/lon list for development:
- Reykjavik (cold, wet, windy)
- Dubai (hot, dry, calm)
- Singapore (humid, tropical)
- Denver (high altitude, variable)
- etc.

Boolean flag to bypass geolocation prompt during dev.

---

## Possible: Freesound Ambient Bed

Query Freesound API by lat/lon to pull nearby geotagged field recordings as an ambient layer under the synth. Requires a free API key (breaks zero-auth). Alternative: curate a small set of recordings per biome/city and bundle them.

---

## Open Questions

- Exact weather → clamp mappings (needs ear-tuning)
- Sound source timbre — pure sine? noise burst? sampled hit?
- Coordinate field for performance — keep it? what does x/y control?
- Multi-voice expansion (later) — phasing clocks? polyrhythm?
- Visual details — color palette, typography, animation
- Throttle implementation — how many concurrent users?

---

## Summary

A rhythmic instrument that:

1. Refuses to work without your location
2. Fetches your weather once
3. Uses atmospheric conditions to clamp parameter ranges
4. Lets you play within those limits
5. Looks like a lunar survey terminal
6. Sounds like an arpeggiator losing its grip on time

The weather is the composer. You're the performer. The moon is watching.
