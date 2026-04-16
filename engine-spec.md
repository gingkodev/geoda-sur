# Cardinal — Spec del Motor de Síntesis

---

## Stack Técnico

- **Web Audio API** — toda la síntesis es nativa del navegador, sin librerías. Osciladores, nodos de ganancia, filtros biquad, líneas de delay, todo creado en runtime.
- **p5.js** — UI basada en canvas (modo instancia). Maneja la interfaz de sliders, el loop de dibujo e interacción con el mouse.
- **Open-Meteo API** — datos meteorológicos gratuitos, sin API key. Trae `temperature_2m`, `relative_humidity_2m`, `surface_pressure`, `cloud_cover`, `precipitation`, `wind_speed_10m` para la geolocalización del usuario.
- **Browser Geolocation API** — `navigator.geolocation` para lat/lon (con bypass de modo dev en `dev.js`).
- **Módulos ES nativos** — sin bundler, sin framework.

---

## Flujo de Datos

```
geolocalización → Open-Meteo API → objeto crudo de clima
  → calculateClamps() → { param: {min, max} } por cada parámetro del synth
    → Engine(clamps) — los params arrancan en el punto medio
      → los sliders de la UI permiten al usuario moverse dentro de esos rangos
```

El clima no setea un valor fijo — define el **rango de cada slider**. El usuario toca dentro de los límites que el clima le impone.

---

## Traducción Clima → Parámetros del Sintetizador

### Parámetros Rítmicos

| Input Climático | Param del Synth | Rango | Lógica de Mapeo |
|---|---|---|---|
| **Temperatura** (-30–50 C) | `tempo` | 40–260 BPM | Interpola a un BPM central y abre una ventana de +/-20 BPM. Frío = lento (~60), calor = rápido (~220). |
| **Humedad** (0–100%) | `drift` | 0–120 ms | Jitter máximo de timing por nota. Aire seco = metrónomo. Húmedo = suelto, con sensación humana. |
| **Velocidad del Viento** (0–80 km/h) | `velocity` | 0–1 | Varianza de velocidad alrededor de una base de 0.5. Calma = dinámicas parejas. Viento = acentos volados. |
| **Presión** (960–1050 hPa) | `density` | 1–4 notas/beat | Subdivisiones por beat. Baja presión = espaciado. Alta presión = denso. |
| **Nubosidad** (0–100%) | `probability` | 0.15–1.0 | Moneda al aire por cada step para decidir si suena. Cielo despejado = casi todas las notas suenan. Nublado = ralo, se abren huecos. |
| **Precipitación** (0–10 mm) | `stutter` | 0–0.7 | Probabilidad de retrigger 40ms después de cada nota (al 70% de velocidad). Lluvia = doble golpe glitcheado. |

### Parámetros de Timbre

| Input Climático | Param del Synth | Rango | Lógica de Mapeo |
|---|---|---|---|
| **Temperatura** | `harmonics` | 1–6 osciladores | Frío = 1–2 senos finitos. Calor = 3–6 osciladores apilados (saw/square/triangle). |
| **Temperatura** | `attack` | 0.001–0.2 s | Frío = transientes percusivos cortantes. Calor = swells lentos tipo pad. |
| **Temperatura** | `decay` | 0.05–1.5 s | Frío = pings cortos. Calor = colas largas y sostenidas. |
| **Temperatura** | `detune` | 0–50 cents | Frío = unísono limpio. Calor = chorus abierto y desafinado. |
| **Humedad** | `reverb` | 0–0.85 | Mezcla wet/dry sobre una red de delay con feedback usada como reverb falsa. Húmedo = empapado. |
| **Humedad** | `delayFeedback` | 0–0.75 | Cantidad de feedback de la línea de delay. Húmedo = repeticiones largas que se van. |
| **Velocidad del Viento** | `filterLfoRate` | 0–8 Hz | LFO modulando el cutoff del lowpass. Calma = estático. Viento = barridos rápidos del filtro. |
| **Velocidad del Viento** | `filterLfoDepth` | 0–0.9 | Cuánto barre el LFO el cutoff (escalado por el valor del cutoff). |
| **Nubosidad** | `filterCutoff` | 200–8000 Hz | Cutoff base del lowpass. Despejado = brillante, agudos abiertos. Nublado = oscuro, apagado. **Nota: invertido** — más nubes = cutoff más bajo. |

---

## Identidad Geográfica — Coordenadas → Escala y Registro

Además del clima, las coordenadas geográficas del usuario determinan la **identidad armónica** del instrumento. Dos ciudades con el mismo clima van a sonar estructuralmente distintas si están en diferentes latitudes o longitudes.

### Latitud → Escala + Nota Raíz

La latitud define qué escala musical usa el secuenciador y desplaza la nota fundamental.

| Rango de Latitud | Escala | Carácter |
|---|---|---|
| 0°–15° (tropical) | Frigia | Oscura, tensión flamenca |
| 15°–30° (subtropical) | Mixolidia | Cálida, con sabor a blues |
| 30°–45° (latitud media) | Dórica | Equilibrada, minor jazzero |
| 45°–60° (templada) | Lidia | Brillante, flotante, el #4 la despega |
| 60°–90° (polar) | Tonal entera | Ambigua, onírica, sin centro tonal claro |

La nota raíz se desplaza 0–7 semitonos por encima de A3 (220Hz) a medida que la latitud se aleja del ecuador. Ecuador = La, polos = Mi aprox.

Los intervalos de la escala se extienden a lo largo de 2 octavas más una nota tope (semitono 24), construyendo una paleta de notas por ubicación.

### Longitud → Registro (Desplazamiento de Octava)

La longitud desplaza todo el registro del instrumento entre -12 y +12 semitonos (una octava completa en cada dirección).

- **Meridiano de Greenwich (0°):** sin desplazamiento, registro medio
- **180° Este:** +12 semitonos (una octava arriba)
- **180° Oeste:** -12 semitonos (una octava abajo)

### Ejemplos

| Ubicación | Escala | Raíz aprox. | Registro |
|---|---|---|---|
| Reikiavik (64°N, 21°W) | Tonal entera | ~Re4 | -1 semitono |
| Singapur (1°N, 103°E) | Frigia | La3 | +7 semitonos |
| Denver (39°N, 104°W) | Dórica | ~Do4 | -7 semitonos |
| Buenos Aires (34°S, 58°W) | Dórica | ~Do4 | -4 semitonos |
| Dubái (25°N, 55°E) | Mixolidia | ~Si3 | +4 semitonos |

---

## Internos del Motor

**Cadena de señal:**
```
[osciladores por nota] → ganancia de envolvente → bus voiceInput
  → biquad lowpass (con modulación LFO) →
    ├─ ganancia dry → master
    ├─ delay → loop de feedback (con LP a 2500 Hz) → master
    └─ delay de reverb (53ms, feedback 0.6, LP a 3000 Hz) → ganancia wet → master
  → destination (salida de audio)
```

**Secuenciador:** Scheduler con lookahead (`_tick` cada 25ms, programa 100ms para adelante) — el patrón estándar de timing en Web Audio para evitar glitches. En cada tick:
1. Tira la moneda de `probability` — si no pasa, saltea la nota
2. Aplica `drift` — jitter random de +/- ms
3. Tira `velocity` — varianza random alrededor de 0.5
4. Elige una nota random de la **escala derivada de la latitud**, con desplazamiento de registro por longitud, desde la nota raíz derivada de las coordenadas
5. Crea una voz, y opcionalmente retriggerea por `stutter`

**Voz:** Crea la cantidad de osciladores indicada por `harmonics`, distribuye los tipos (sine para simple, saw/square/triangle para stacks más ricos), los desafina simétricamente a lo largo del rango de `detune` en cents, los pasa por una envolvente de attack lineal → decay exponencial, y los auto-corta al terminar.

**Avance:** La subdivisión del beat es `density` notas por beat al `tempo` actual en BPM.

---

## Resumen en Criollo

La temperatura controla *qué tipo de instrumento es* (plink percusivo vs. pad gordo). La humedad controla *qué tan mojado y con eco es el espacio*. El viento controla *cuánto se mueve el filtro*. La nubosidad controla *brillo y dispersión*. La precipitación mete *glitch*. La latitud define *la escala y la nota raíz* — frigia en el trópico, tonal entera en los polos. La longitud mueve *el registro entero* — oeste suena grave, este suena agudo. El clima no toca una canción fija — arma un instrumento acotado con una identidad armónica única por ubicación, y el usuario toca dentro de esos límites.
