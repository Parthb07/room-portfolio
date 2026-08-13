// SVG overlay defining clickable zones on top of the room scene.
// Coordinates are in the 5000x5000 render's pixel space.

import { hasDragged, IMAGE_WIDTH, IMAGE_HEIGHT } from './scene.js'

// Traced with image-map.net as circles (cx, cy, r) and converted here to
// the square bounding box each hit-rect needs (x = cx - r, y = cy - r,
// width = height = 2r) — the visible dot still renders at the circle's
// exact center via `x + width / 2`, `y + height / 2`.
//
// `id` must match a row's `id` column in Supabase's `objects` table (see
// supabase.js). The old guitar/bookshelf/bed placeholders (never given real
// coordinates) have been removed — re-add them here, with real coordinates,
// if those objects get mapped later.
const ZONES = [
  { id: 'monitor', label: 'Monitor', x: 1920, y: 1816, width: 104, height: 104 },
  { id: 'computer', label: 'PC', x: 2492, y: 1647, width: 108, height: 108 },
  { id: 'keyboard', label: 'Keyboard', x: 2020, y: 2202, width: 126, height: 126 },
  { id: 'printer', label: '3D Printer', x: 3749, y: 3036, width: 130, height: 130 },
]

const SVG_NS = 'http://www.w3.org/2000/svg'

// Radius (image-space px) of the visible dot marking each zone's center.
const DOT_RADIUS = 16

// Mounts the hotspot SVG inside `world` (so it inherits the scene's pan/zoom
// transform for free) and fires `onZoneClick(zone)` for taps that weren't
// drags, passing the full zone (id + image-space rect).
//
// Each zone renders as two elements: an invisible `.hotspot-zone` rect (the
// full clickable/hoverable hit area — kept generous so it's easy to hit)
// and a small `.hotspot-dot` circle centered on it (the only visible mark,
// purely decorative — it doesn't receive pointer events itself).
export function initHotspots(world, onZoneClick) {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.id = 'hotspot-layer'
  svg.setAttribute('viewBox', `0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}`)
  svg.setAttribute('width', IMAGE_WIDTH)
  svg.setAttribute('height', IMAGE_HEIGHT)

  ZONES.forEach((zone) => {
    const rect = document.createElementNS(SVG_NS, 'rect')
    rect.classList.add('hotspot-zone')
    rect.dataset.zoneId = zone.id
    rect.setAttribute('x', zone.x)
    rect.setAttribute('y', zone.y)
    rect.setAttribute('width', zone.width)
    rect.setAttribute('height', zone.height)

    const dot = document.createElementNS(SVG_NS, 'circle')
    dot.classList.add('hotspot-dot')
    dot.dataset.zoneId = zone.id
    dot.setAttribute('cx', zone.x + zone.width / 2)
    dot.setAttribute('cy', zone.y + zone.height / 2)
    dot.setAttribute('r', DOT_RADIUS)

    rect.addEventListener('pointerenter', () => {
      dot.classList.add('hover')
    })
    rect.addEventListener('pointerleave', () => {
      dot.classList.remove('hover')
    })

    rect.addEventListener('click', () => {
      if (hasDragged()) return
      setActiveZone(svg, zone.id)
      onZoneClick(zone)
    })

    // Dot after rect so it paints on top.
    svg.append(rect, dot)
  })

  world.append(svg)
  return svg
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
