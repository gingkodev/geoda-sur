# Frontend Patching Specs — Cable Patch Bay UI

## Overview

Pd/Max-inspired patch bay for routing weather sources to synth parameters. Hybrid DOM + p5.js approach: DOM handles nodes, knobs, and layout; p5.js handles cable rendering and cable drag interaction on a transparent canvas overlay.

## DOM Structure

```html
<div id="patch-bay">

  <!-- Left column: weather sources -->
  <div id="sources">
    <div class="node source" data-source="temperature">
      <span class="node-label">TEMPERATURE</span>
      <span class="node-value">--</span>        <!-- live weather value -->
      <div class="jack out"></div>               <!-- cable anchor point -->
    </div>
    <div class="node source" data-source="humidity">
      <span class="node-label">HUMIDITY</span>
      <span class="node-value">--</span>
      <div class="jack out"></div>
    </div>
    <div class="node source" data-source="windSpeed">
      <span class="node-label">WIND SPEED</span>
      <span class="node-value">--</span>
      <div class="jack out"></div>
    </div>
    <div class="node source" data-source="pressure">
      <span class="node-label">PRESSURE</span>
      <span class="node-value">--</span>
      <div class="jack out"></div>
    </div>
    <div class="node source" data-source="cloudCover">
      <span class="node-label">CLOUD COVER</span>
      <span class="node-value">--</span>
      <div class="jack out"></div>
    </div>
    <div class="node source" data-source="precipitation">
      <span class="node-label">PRECIPITATION</span>
      <span class="node-value">--</span>
      <div class="jack out"></div>
    </div>
  </div>

  <!-- Middle: transparent p5.js canvas for cables only -->
  <canvas id="cables"></canvas>

  <!-- Right column: synth param targets -->
  <div id="targets">

    <div class="target-group" data-group="rhythm">
      <h3 class="group-label">RHYTHM</h3>

      <div class="node target" data-target="tempo">
        <div class="jack in"></div>
        <span class="node-label">TEMPO</span>
        <div class="knob" data-param="tempo" data-min="40" data-max="260" data-unit="bpm"></div>
      </div>
      <div class="node target" data-target="drift">
        <div class="jack in"></div>
        <span class="node-label">DRIFT</span>
        <div class="knob" data-param="drift" data-min="0" data-max="120" data-unit="ms"></div>
      </div>
      <div class="node target" data-target="velocity">
        <div class="jack in"></div>
        <span class="node-label">VELOCITY</span>
        <div class="knob" data-param="velocity" data-min="0" data-max="1" data-unit=""></div>
      </div>
      <div class="node target" data-target="density">
        <div class="jack in"></div>
        <span class="node-label">DENSITY</span>
        <div class="knob" data-param="density" data-min="1" data-max="4" data-unit="n/beat"></div>
      </div>
      <div class="node target" data-target="probability">
        <div class="jack in"></div>
        <span class="node-label">PROBABILITY</span>
        <div class="knob" data-param="probability" data-min="0.15" data-max="1" data-unit=""></div>
      </div>
      <div class="node target" data-target="stutter">
        <div class="jack in"></div>
        <span class="node-label">STUTTER</span>
        <div class="knob" data-param="stutter" data-min="0" data-max="0.7" data-unit=""></div>
      </div>
    </div>

    <div class="target-group" data-group="timbre">
      <h3 class="group-label">TIMBRE</h3>

      <div class="node target" data-target="harmonics">
        <div class="jack in"></div>
        <span class="node-label">HARMONICS</span>
        <div class="knob" data-param="harmonics" data-min="1" data-max="6" data-unit="osc"></div>
      </div>
      <div class="node target" data-target="attack">
        <div class="jack in"></div>
        <span class="node-label">ATTACK</span>
        <div class="knob" data-param="attack" data-min="0.001" data-max="0.2" data-unit="s"></div>
      </div>
      <div class="node target" data-target="decay">
        <div class="jack in"></div>
        <span class="node-label">DECAY</span>
        <div class="knob" data-param="decay" data-min="0.05" data-max="1.5" data-unit="s"></div>
      </div>
      <div class="node target" data-target="detune">
        <div class="jack in"></div>
        <span class="node-label">DETUNE</span>
        <div class="knob" data-param="detune" data-min="0" data-max="50" data-unit="cents"></div>
      </div>
      <div class="node target" data-target="reverb">
        <div class="jack in"></div>
        <span class="node-label">REVERB</span>
        <div class="knob" data-param="reverb" data-min="0" data-max="0.85" data-unit=""></div>
      </div>
      <div class="node target" data-target="delayFeedback">
        <div class="jack in"></div>
        <span class="node-label">DELAY FB</span>
        <div class="knob" data-param="delayFeedback" data-min="0" data-max="0.75" data-unit=""></div>
      </div>
      <div class="node target" data-target="filterLfoRate">
        <div class="jack in"></div>
        <span class="node-label">FILTER LFO RATE</span>
        <div class="knob" data-param="filterLfoRate" data-min="0" data-max="8" data-unit="Hz"></div>
      </div>
      <div class="node target" data-target="filterLfoDepth">
        <div class="jack in"></div>
        <span class="node-label">FILTER LFO DEPTH</span>
        <div class="knob" data-param="filterLfoDepth" data-min="0" data-max="0.9" data-unit=""></div>
      </div>
      <div class="node target" data-target="filterCutoff">
        <div class="jack in"></div>
        <span class="node-label">FILTER CUTOFF</span>
        <div class="knob" data-param="filterCutoff" data-min="200" data-max="8000" data-unit="Hz"></div>
      </div>
    </div>
  </div>
</div>
```

## Layout

```
┌──────────────────────────────────────────────────────┐
│  #patch-bay  (display: flex, full viewport)          │
│                                                      │
│  #sources        #cables (canvas)       #targets     │
│  ┌────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ TEMP ○─┼────┼─── bezier ───┼────┼─○ TEMPO [K]  │  │
│  │ HUMI ○─┼────┼─── bezier ───┼────┼─○ DRIFT [K]  │  │
│  │ WIND ○─┼────┼──────────────┼────┼─○ VELOC [K]  │  │
│  │ PRES ○─┼────┼──────────────┼────┼─○ DENS  [K]  │  │
│  │ CLOU ○─┼────┼──────────────┼────┼─○ PROB  [K]  │  │
│  │ PREC ○─┼────┼──────────────┼────┼─○ STUTT [K]  │  │
│  │        │    │              │    ├──────────────┤  │
│  │        │    │              │    │ TIMBRE       │  │
│  │        │    │              │    │─○ HARM  [K]  │  │
│  │        │    │              │    │─○ ATK   [K]  │  │
│  │        │    │              │    │─○ DEC   [K]  │  │
│  │        │    │              │    │  ...etc      │  │
│  └────────┘    └──────────────┘    └──────────────┘  │
│                                                      │
│  ○ = jack (cable anchor)    [K] = knob               │
└──────────────────────────────────────────────────────┘
```

- `#patch-bay`: `display: flex; height: 100vh;`
- `#sources`: fixed-width left column, flex-column, vertically centered nodes
- `#cables`: `flex: 1; position: relative;` — p5 canvas fills this area, `pointer-events: none` except during cable drag
- `#targets`: fixed-width right column, flex-column, scrollable if needed (15 params)
- All nodes use flexbox for internal layout (jack + label + value/knob in a row)

## Jacks (Cable Anchors)

```css
.jack {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--jack-ring);
  background: var(--jack-hole);
  cursor: crosshair;
  /* position used by p5 to draw cable endpoints */
}

.jack.out { /* source side — right edge of source node */ }
.jack.in  { /* target side — left edge of target node */ }
.jack.connected { border-color: var(--cable-active); }
```

p5 reads jack positions via `getBoundingClientRect()` on `.jack` elements to know where to anchor cable beziers.

## Knobs

Each `.knob` element is a rotary control. DOM-based with CSS transforms for rotation.

```
data-param    — synth param key (matches TARGETS)
data-min      — absolute min (engine floor)
data-max      — absolute max (engine ceiling)
data-unit     — display unit
```

The knob's effective range (weather-bounded) is narrower than abs min/max. The bounded range comes from the patch manager's clamps. Visual treatment:

- Full arc = absolute range (dim track)
- Highlighted arc = weather-bounded range (bright fill)
- Indicator dot = current value within bounded range

Interaction: click + vertical drag to rotate (standard knob UX). Value clamped to weather-bounded range. On re-patch, if current value falls outside new bounds, snap to nearest bound.

## p5.js Canvas — Cables Only

p5 instance attached to `#cables` canvas. Responsible for:

### Drawing cables
- For each active connection in the patch state, draw a bezier from source jack to target jack
- Anchor positions: read from `getBoundingClientRect()` of the `.jack` elements, offset to canvas-local coords
- Bezier control points: horizontal offset from endpoints (feels like a hanging cable)
- Cable color: matches source node color or a per-source palette
- Active/highlighted cable on hover

### Cable drag interaction
- `mousePressed` on a `.jack.out` (source) or on an existing cable near a jack → begin drag
- `mouseDragged` → draw a loose cable from anchor to cursor
- `mouseReleased` over a `.jack.in` (target) → complete connection, fire `patch:change` event
- `mouseReleased` over empty space → cancel, cable snaps back
- To disconnect: drag an existing cable off its target jack into empty space (if target has other sources — otherwise blocked, every param needs at least one source)

### Cable rendering style
- Bezier curve, slight droop (control points below midpoint for gravity feel)
- Color-coded by source (6 source colors)
- Thicker when active/hovered
- Optional: slight animation or wobble on connection change

### Frame rate
- `frameRate(15)` or `frameRate(24)` — patch UI only needs to update on interaction, low fps is fine
- Cables are static between interactions, only the dragged cable needs smooth rendering

### Position sync
- On window resize: re-read all jack `getBoundingClientRect()` values, redraw cables
- `ResizeObserver` on `#patch-bay` to trigger p5 `resizeCanvas()` + position recalc

## Events — DOM ↔ p5 ↔ Patch Manager

```
User drags cable (p5)
  → mouseReleased on target jack
  → p5 reads data-source from origin jack's parent .node
  → p5 reads data-target from destination jack's parent .node
  → dispatches CustomEvent on shared EventTarget (patchBus):

    patchBus.dispatchEvent(new CustomEvent('patch:connect', {
      detail: { source: 'temperature', target: 'reverb', scale: 1, invert: false }
    }));

Patch manager listens on patchBus:
  → updates internal connection list
  → re-clamps affected target(s)
  → dispatches:

    patchBus.dispatchEvent(new CustomEvent('patch:change', {
      detail: { target: 'reverb', clamps: { min: 0.1, max: 0.6 } }
    }));

Engine/knob listeners pick up patch:change:
  → engine.setParam('reverb', ...) or engine.setRange('reverb', 0.1, 0.6)
  → knob updates its bounded arc
  → knob snaps value if out of new range
```

Disconnect flow:
```
User drags cable off a target into empty space (p5)
  → p5 checks: does this target have other sources?
  → if yes: dispatch patch:disconnect { source, target }
  → if no: cancel drag, cable snaps back (every param must stay patched)
```

## Connection Settings (Per-Cable)

When a cable is selected (clicked), show an inline popover or small panel near the cable midpoint:

```
┌─────────────────────────┐
│  TEMPERATURE → REVERB   │
│                         │
│  SCALE   [─────●──] 1.0│
│  INVERT  [ ]            │
│  OUT MIN [●────────] 0.0│
│  OUT MAX [────────●] 1.0│
│                         │
│  [DELETE]               │
└─────────────────────────┘
```

- Scale: 0–2 (gain multiplier, default 1)
- Invert: checkbox (flips normalized source value)
- Out min/max: sub-range within 0–1 (narrows or offsets the mapping)
- Delete: removes cable (blocked if target would become unpatched)

Changes here also fire `patch:connect` (update) events → re-clamp.

## Default State on Load

15 cables matching current `clamp.js` mappings:

| Source | Target(s) |
|---|---|
| temperature | tempo, harmonics, attack, decay, detune |
| humidity | drift, reverb, delayFeedback |
| windSpeed | velocity, filterLfoRate, filterLfoDepth |
| pressure | density |
| cloudCover | probability, filterCutoff (invert: true) |
| precipitation | stutter |

All cables drawn on first render. Knobs show weather-bounded ranges. User can start re-patching immediately.

## Multiple Sources → One Target (Add & Clamp)

When two cables land on the same target jack:
- Both cables render to that jack (visually stacked or slightly offset)
- Patch manager sums their normalized outputs, clamps 0–1
- Resulting range may be wider or pushed toward extremes
- Jack visual indicator: double ring or glow to show multi-source state
- Knob bounded range updates to reflect the summed mapping

## Color Palette (Source-Coded Cables)

Each weather source gets a distinct cable color for visual tracing:

```
temperature   — warm red/orange
humidity      — blue
windSpeed     — white/silver
pressure      — yellow/amber
cloudCover    — grey/muted
precipitation — cyan/teal
```

Knob highlight arc could tint to match its connected source color. Multi-source knobs blend or show striped arc.
