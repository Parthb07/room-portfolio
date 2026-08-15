// SVG overlay defining clickable zones on top of the room scene.
// Coordinates are in the 5000x5000 render's pixel space.

import { hasDragged, IMAGE_WIDTH, IMAGE_HEIGHT } from './scene.js'

// Traced with image-map.net as polygons — each zone's hit area is the exact
// quadrilateral outline (not a bounding rect), and the visible dot centers
// on the average of its vertices.
//
// `id` must match a row's `id` column in Supabase's `objects` table (see
// supabase.js) — except `degree`, `computer`, `keyboard`, and `printer`,
// which main.js special-cases to open a nav section panel (Education,
// Projects, Experience, Hobbies respectively) instead of an object lookup.
const ZONES = [
  {
    id: 'computer',
    label: 'PC',
    points: [
      [2281, 1418],
      [2750, 1418],
      [2754, 1988],
      [2281, 1988],
    ],
  },
  {
    id: 'printer',
    label: '3D Printer',
    points: [
      [3549, 3127],
      [3814, 2951],
      [4070, 3118],
      [3805, 3291],
    ],
  },
  {
    id: 'keyboard',
    label: 'Keyboard',
    points: [
      [1910, 2337],
      [2189, 2155],
      [2286, 2244],
      [2016, 2420],
    ],
  },
  {
    id: 'degree',
    label: 'Degree',
    points: [
      [1619, 1042],
      [2034, 777],
      [2034, 1316],
      [1623, 1586],
    ],
  },
]

const SVG_NS = 'http://www.w3.org/2000/svg'

// A dot's size (real screen pixels, regardless of current zoom — see the
// scale division in tick()) always sits between these two: REST at rest
// (beyond PROXIMITY_RANGE_PX from the cursor) or while active (its panel
// open — see tick()), growing smoothly as the cursor approaches, capped at
// MAX right at zero distance. The intro pulse (see pulseOnce) sweeps this
// exact same range once, so it's one consistent "how big can this dot get"
// system rather than two separate ones.
const PROXIMITY_RANGE_PX = 220
const REST_DOT_SCREEN_PX = 10
const MAX_DOT_SCREEN_PX = 30
const PULSE_DURATION_MS = 900

// Mounts the hotspot SVG inside `world` (so it inherits the scene's pan/zoom
// transform for free) and fires `onZoneClick(zone)` for taps that weren't
// drags, passing the full zone (id + image-space vertices).
//
// Each zone renders as two elements: an invisible `.hotspot-zone` polygon
// (the exact clickable/hoverable outline traced above) and a small
// `.hotspot-dot` circle centered on it (the only visible mark, purely
// decorative — it doesn't receive pointer events itself). On mount, every
// dot pulses once to draw the eye, then hands off to the cursor-proximity
// sizing described above.
export function initHotspots(world, onZoneClick) {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.id = 'hotspot-layer'
  svg.setAttribute('viewBox', `0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}`)
  svg.setAttribute('width', IMAGE_WIDTH)
  svg.setAttribute('height', IMAGE_HEIGHT)

  const zoneEls = []
  const getScale = () => {
    const worldWidth = world.getBoundingClientRect().width
    return worldWidth ? worldWidth / IMAGE_WIDTH : 1
  }

  ZONES.forEach((zone) => {
    const hit = document.createElementNS(SVG_NS, 'polygon')
    hit.classList.add('hotspot-zone')
    hit.dataset.zoneId = zone.id
    hit.setAttribute('points', zone.points.map(([x, y]) => `${x},${y}`).join(' '))

    const [cx, cy] = centroid(zone.points)
    const dot = document.createElementNS(SVG_NS, 'circle')
    dot.classList.add('hotspot-dot')
    dot.dataset.zoneId = zone.id
    dot.setAttribute('cx', cx)
    dot.setAttribute('cy', cy)
    dot.setAttribute('r', '0')

    const entry = { hit, dot, proximityReady: false }
    pulseOnce(dot, getScale).then(() => {
      entry.proximityReady = true
    })

    hit.addEventListener('click', () => {
      if (hasDragged()) return
      setActiveZone(svg, zone.id)
      onZoneClick(zone)
    })

    // Dot after the hit area so it paints on top.
    svg.append(hit, dot)
    zoneEls.push(entry)
  })

  world.append(svg)
  initProximity(world, zoneEls)
  return svg
}

function centroid(points) {
  const sum = points.reduce(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

// Sweeps a dot's radius from REST up to MAX and back down, once, on a sine
// curve (0 → 1 → 0 over half a sine period) — a single pulse, in the same
// screen-px terms proximity mode uses, rather than a separate CSS
// transform-based effect with its own unrelated size range.
function pulseOnce(dot, getScale) {
  return new Promise((resolve) => {
    const start = performance.now()

    function frame(now) {
      const t = Math.min(1, (now - start) / PULSE_DURATION_MS)
      const wave = Math.sin(t * Math.PI)
      const screenPx = REST_DOT_SCREEN_PX + (MAX_DOT_SCREEN_PX - REST_DOT_SCREEN_PX) * wave
      dot.setAttribute('r', String(screenPx / getScale()))

      if (t < 1) {
        requestAnimationFrame(frame)
      } else {
        resolve()
      }
    }

    requestAnimationFrame(frame)
  })
}

// Tracks the cursor and continuously resizes every pulse-finished dot
// based on its screen-space distance from it. Runs on a persistent rAF
// loop (not just on pointermove) so dots stay correctly sized as the scene
// pans/zooms under a stationary cursor too, not only when the cursor itself
// moves.
function initProximity(world, zoneEls) {
  let pointerX = -Infinity
  let pointerY = -Infinity

  window.addEventListener('pointermove', (e) => {
    pointerX = e.clientX
    pointerY = e.clientY
  })

  function tick() {
    // Scale = current on-screen size vs. the image's intrinsic size — lets
    // the screen-px constants mean an actual screen pixel size, however
    // zoomed in the scene currently is.
    const worldWidth = world.getBoundingClientRect().width
    const scale = worldWidth ? worldWidth / IMAGE_WIDTH : 1

    zoneEls.forEach(({ hit, dot, proximityReady }) => {
      if (!proximityReady) return

      // A zone whose panel is open stays pinned at max size regardless of
      // the cursor, instead of shrinking back the moment the cursor moves
      // away from it toward the panel it just opened.
      if (dot.classList.contains('active')) {
        dot.setAttribute('r', String(MAX_DOT_SCREEN_PX / scale))
        return
      }

      const box = hit.getBoundingClientRect()
      const dx = pointerX - (box.left + box.width / 2)
      const dy = pointerY - (box.top + box.height / 2)
      const distance = Math.hypot(dx, dy)
      const closeness = Math.max(0, 1 - distance / PROXIMITY_RANGE_PX)
      const screenPx = REST_DOT_SCREEN_PX + (MAX_DOT_SCREEN_PX - REST_DOT_SCREEN_PX) * closeness
      dot.setAttribute('r', String(screenPx / scale))
    })

    requestAnimationFrame(tick)
  }

  requestAnimationFrame(tick)
}

function setActiveZone(svg, zoneId) {
  svg.querySelectorAll('.active').forEach((el) => el.classList.remove('active'))
  svg.querySelector(`.hotspot-zone[data-zone-id="${zoneId}"]`)?.classList.add('active')
  svg.querySelector(`.hotspot-dot[data-zone-id="${zoneId}"]`)?.classList.add('active')
}

// Clears whichever zone is currently marked active — called when the panel
// closes, so the dot's glow doesn't linger after its detail view is gone.
export function clearActiveZone(svg) {
  svg.querySelectorAll('.active').forEach((el) => el.classList.remove('active'))
}
