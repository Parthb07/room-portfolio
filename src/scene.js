// Full-screen isometric room viewer: drag to pan, scroll to zoom.
// Day/night crossfade is pure CSS, driven by the "night" class on <body>
// (see style.css) — this module never touches day/night state.
//
// All pan/zoom math is relative to #scene's own rendered size, not the
// window's — #scene fills #stage (see style.css), which shrinks when
// #panel opens. A ResizeObserver on #scene re-centers/re-clamps whenever
// that size actually changes, for any reason (#stage animating open/closed,
// or a real window resize) — one mechanism, always using the real current
// size, so it stays correct at any zoom level instead of guessing a fixed
// pixel offset.

// Logical canvas size — every pan/zoom/clamp calculation and every hotspot
// coordinate (hotspots.js) is authored against this, independent of the
// actual room-day/room-night file resolution. The browser just scales
// whatever pixels those files really have to fill this box, so bumping
// their native resolution (e.g. re-rendering sharper WebP exports) never
// requires touching this or re-tracing hotspots — only the reverse
// (changing this) would.
export const IMAGE_WIDTH = 5000
export const IMAGE_HEIGHT = 5000

// Zoom is constrained to 100%–200% of fit-to-contain (the whole image
// visible on load, centered — not cropped to fill, since the render has a
// transparent background and the page's own background shows around it).
const MIN_ZOOM_FACTOR = 1.0
const MAX_ZOOM_FACTOR = 2.0
const DRAG_THRESHOLD = 4 // px of pointer movement before a gesture counts as a drag
const ZOOM_INTENSITY = 0.0015
const ZOOM_SMOOTHING = 0.2 // per-frame lerp factor toward the wheel's target scale/position

// Programmatic pan (resetting zoom) animates over this duration with an
// accelerate-then-decelerate curve — the same timing the panel slide uses.
const FOCUS_DURATION = 500
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

let didDrag = false

// Whether the most recent pointer gesture moved enough to count as a drag.
// Read by hotspots.js so it can skip opening the panel right after a pan.
export function hasDragged() {
  return didDrag
}

export function initScene(container) {
  const scene = document.createElement('div')
  scene.id = 'scene'

  const world = document.createElement('div')
  world.id = 'world'

  const dayImg = document.createElement('img')
  dayImg.id = 'room-day'
  dayImg.className = 'scene-layer'
  dayImg.src = '/room-day.webp'
  dayImg.width = IMAGE_WIDTH
  dayImg.height = IMAGE_HEIGHT
  dayImg.alt = ''
  dayImg.draggable = false

  const nightImg = document.createElement('img')
  nightImg.id = 'room-night'
  nightImg.className = 'scene-layer'
  nightImg.src = '/room-night.webp'
  nightImg.width = IMAGE_WIDTH
  nightImg.height = IMAGE_HEIGHT
  nightImg.alt = ''
  nightImg.draggable = false

  // `draggable = false` and the CSS `-webkit-user-drag: none` (style.css)
  // aren't enough on their own in every browser — the native "pick up this
  // image" drag gesture can still start and hijack a left-click-drag pan.
  // Explicitly preventing `dragstart` is what actually kills it everywhere.
  const preventNativeDrag = (e) => e.preventDefault()
  dayImg.addEventListener('dragstart', preventNativeDrag)
  nightImg.addEventListener('dragstart', preventNativeDrag)

  world.append(dayImg, nightImg)
  scene.append(world)
  container.append(scene)

  const state = { scale: 1, minScale: 1, maxScale: 1, x: 0, y: 0 }
  // What the wheel handler is steering `state` toward — a separate value so
  // rapid wheel ticks (trackpads fire many small ones) accumulate a target
  // that the render loop chases smoothly, rather than snapping every tick.
  const target = { scale: 1, x: 0, y: 0 }

  // #scene's own current rendered size — the basis for every fit/clamp
  // calculation below, instead of window.innerWidth/innerHeight.
  const containerWidth = () => scene.clientWidth
  const containerHeight = () => scene.clientHeight

  // Fit-to-contain (not fit-to-fill): the whole image fits inside the
  // container at 100% zoom, letterboxed on one axis unless it's exactly the
  // container's aspect ratio — the transparent PNG's edges are meant to
  // show the page background, not get cropped off.
  const fitScale = () => Math.min(containerWidth() / IMAGE_WIDTH, containerHeight() / IMAGE_HEIGHT)

  // Bounds translate so the image can be dragged within any letterbox
  // margin but never slides fully out of view. When the image is at least
  // as big as the container on an axis (the old fit-to-fill case, or simply
  // zoomed in) this reduces to the original "never reveal past the edge"
  // clamp; when it's smaller (letterboxed at low zoom) it instead confines
  // sliding to the margin between the image's edges and the container's.
  function clamp(scale, x, y) {
    const w = IMAGE_WIDTH * scale
    const h = IMAGE_HEIGHT * scale
    const cw = containerWidth()
    const ch = containerHeight()
    const minX = Math.min(0, cw - w)
    const maxX = Math.max(0, cw - w)
    const minY = Math.min(0, ch - h)
    const maxY = Math.max(0, ch - h)
    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y)),
    }
  }

  function apply() {
    world.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`
  }

  // Points `target` at wherever `state` currently is, so the next wheel
  // tick (or the zoom-lerp loop, if still running) continues from the real
  // position instead of an earlier, now-stale target.
  function syncTarget() {
    target.scale = state.scale
    target.x = state.x
    target.y = state.y
  }

  function centerAt(scale) {
    const x = (containerWidth() - IMAGE_WIDTH * scale) / 2
    const y = (containerHeight() - IMAGE_HEIGHT * scale) / 2
    const clamped = clamp(scale, x, y)
    state.scale = scale
    state.x = clamped.x
    state.y = clamped.y
  }

  // Declared before reset()/reflow() below, both of which call these on the
  // very first synchronous invocation — a `let` declared after the call
  // site is in the temporal dead zone until execution actually reaches it,
  // so this order isn't just tidiness, it's required.
  let focusAnimationFrame = null
  function cancelFocusAnimation() {
    if (focusAnimationFrame !== null) {
      cancelAnimationFrame(focusAnimationFrame)
      focusAnimationFrame = null
    }
  }

  let zoomAnimationFrame = null
  function cancelZoomAnimation() {
    if (zoomAnimationFrame !== null) {
      cancelAnimationFrame(zoomAnimationFrame)
      zoomAnimationFrame = null
    }
  }

  function reset() {
    cancelFocusAnimation()
    cancelZoomAnimation()
    state.minScale = fitScale() * MIN_ZOOM_FACTOR
    state.maxScale = fitScale() * MAX_ZOOM_FACTOR
    centerAt(state.minScale)
    apply()
    syncTarget()
  }

  reset()

  // Re-centers at the *current* scale (unlike reset(), which always drops
  // back to 100%) and re-clamps scale into the freshly-computed bounds —
  // fires whenever #scene's real rendered size changes for any reason:
  // #stage animating open/closed as the panel toggles, or an actual window
  // resize. Using the live measured size at every step (this fires
  // continuously while #stage's `right` CSS transition runs) is what makes
  // the reflow correct regardless of current zoom, replacing the old fixed-
  // pixel "shift left" that only ever worked at 100% zoom.
  function reflow() {
    const cw = containerWidth()
    const ch = containerHeight()
    if (cw === 0 || ch === 0) return

    cancelFocusAnimation()
    cancelZoomAnimation()
    state.minScale = fitScale() * MIN_ZOOM_FACTOR
    state.maxScale = fitScale() * MAX_ZOOM_FACTOR
    state.scale = Math.min(state.maxScale, Math.max(state.minScale, state.scale))
    const x = (cw - IMAGE_WIDTH * state.scale) / 2
    const y = (ch - IMAGE_HEIGHT * state.scale) / 2
    const clamped = clamp(state.scale, x, y)
    state.x = clamped.x
    state.y = clamped.y
    apply()
    syncTarget()
  }

  new ResizeObserver(reflow).observe(scene)

  // Animates scale/x/y together toward a target, easing the same way pan-only
  // moves used to. Pass the current scale to leave it unchanged.
  function animateTo(targetScale, targetX, targetY) {
    cancelFocusAnimation()
    cancelZoomAnimation()
    const startScale = state.scale
    const startX = state.x
    const startY = state.y
    const startTime = performance.now()

    function step(now) {
      const t = Math.min(1, (now - startTime) / FOCUS_DURATION)
      const eased = easeInOutCubic(t)
      state.scale = startScale + (targetScale - startScale) * eased
      state.x = startX + (targetX - startX) * eased
      state.y = startY + (targetY - startY) * eased
      apply()
      if (t < 1) {
        focusAnimationFrame = requestAnimationFrame(step)
      } else {
        focusAnimationFrame = null
        syncTarget()
      }
    }

    focusAnimationFrame = requestAnimationFrame(step)
  }

  // Animates scale back to 100% (fit-to-contain) and re-centers — the
  // bottom-HUD reset-zoom button.
  function resetZoom() {
    const targetX = (containerWidth() - IMAGE_WIDTH * state.minScale) / 2
    const targetY = (containerHeight() - IMAGE_HEIGHT * state.minScale) / 2
    const clamped = clamp(state.minScale, targetX, targetY)
    animateTo(state.minScale, clamped.x, clamped.y)
  }

  // --- Smooth zoom: wheel ticks update `target`, this loop eases toward it ---
  function stepZoom() {
    state.scale += (target.scale - state.scale) * ZOOM_SMOOTHING
    state.x += (target.x - state.x) * ZOOM_SMOOTHING
    state.y += (target.y - state.y) * ZOOM_SMOOTHING
    apply()

    const settled =
      Math.abs(target.scale - state.scale) < 0.0002 &&
      Math.abs(target.x - state.x) < 0.05 &&
      Math.abs(target.y - state.y) < 0.05

    if (settled) {
      state.scale = target.scale
      state.x = target.x
      state.y = target.y
      apply()
      zoomAnimationFrame = null
    } else {
      zoomAnimationFrame = requestAnimationFrame(stepZoom)
    }
  }

  // --- Zoom: scroll wheel, eased for a smooth feel. Always anchored on the
  // container's own center, independent of cursor position — the point
  // under the cursor is deliberately *not* kept fixed, so zooming can't
  // nudge the image in some direction just because of where the mouse
  // happens to be. ---
  scene.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      cancelFocusAnimation()

      const anchorX = containerWidth() / 2
      const anchorY = containerHeight() / 2

      const nextScale = target.scale * (1 - e.deltaY * ZOOM_INTENSITY)
      const clampedScale = Math.min(state.maxScale, Math.max(state.minScale, nextScale))

      // Keep the container's center fixed in image-space while the scale
      // changes — computed from `target`, not `state`, so consecutive
      // ticks compound toward a coherent destination instead of chasing
      // the lagging value.
      const worldX = (anchorX - target.x) / target.scale
      const worldY = (anchorY - target.y) / target.scale
      const nextX = anchorX - worldX * clampedScale
      const nextY = anchorY - worldY * clampedScale

      const clamped = clamp(clampedScale, nextX, nextY)
      target.scale = clampedScale
      target.x = clamped.x
      target.y = clamped.y

      if (zoomAnimationFrame === null) {
        zoomAnimationFrame = requestAnimationFrame(stepZoom)
      }
    },
    { passive: false }
  )

  // --- Pan: pointer drag ---
  let isPointerDown = false
  let startClientX = 0
  let startClientY = 0
  let startX = 0
  let startY = 0

  scene.addEventListener('pointerdown', (e) => {
    cancelFocusAnimation()
    cancelZoomAnimation()
    syncTarget()
    isPointerDown = true
    didDrag = false
    startClientX = e.clientX
    startClientY = e.clientY
    startX = state.x
    startY = state.y
    // Pointer capture is deferred to the drag threshold below — capturing
    // here unconditionally would retarget the eventual pointerup/click to
    // #scene instead of whatever hotspot rect is under the cursor, silently
    // breaking hotspot clicks.
  })

  scene.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return
    const dx = e.clientX - startClientX
    const dy = e.clientY - startClientY

    if (!didDrag && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      didDrag = true
      scene.classList.add('dragging')
      scene.setPointerCapture(e.pointerId)
    }
    if (!didDrag) return

    // Each axis is draggable only once the image actually overflows the
    // container on that axis (part of it is out of bounds) — at fit-to-
    // contain, for instance, neither axis overflows, so dragging does
    // nothing at all until zoomed in enough for one or both to.
    const canDragX = IMAGE_WIDTH * state.scale > containerWidth()
    const canDragY = IMAGE_HEIGHT * state.scale > containerHeight()

    const clamped = clamp(
      state.scale,
      canDragX ? startX + dx : state.x,
      canDragY ? startY + dy : state.y
    )
    state.x = clamped.x
    state.y = clamped.y
    apply()
    syncTarget()
  })

  function endDrag(e) {
    if (!isPointerDown) return
    isPointerDown = false
    scene.classList.remove('dragging')
    if (scene.hasPointerCapture(e.pointerId)) {
      scene.releasePointerCapture(e.pointerId)
    }
  }

  scene.addEventListener('pointerup', endDrag)
  scene.addEventListener('pointercancel', endDrag)
  // Belt-and-suspenders alongside the per-image dragstart prevention above:
  // stop any native drag-and-drop gesture that starts anywhere in the scene.
  scene.addEventListener('dragstart', (e) => e.preventDefault())

  return { scene, world, resetZoom }
}
