// In-app "gallery" view — a full-bleed staggered grid of project images and
// videos. Lives inside #stage as a sibling of #scene, crossfading with it
// (see showGallery/hideGallery in main.js) instead of being a separate
// page — nav/toggle/HUD chrome stays exactly where it is throughout, only
// the room scene and this swap.
//
// Media rows come from Supabase's `gallery_items` table (see
// fetchGalleryItems in supabase.js) — to add/remove/reorder what shows
// here, edit that table and the `media` storage bucket directly; there's
// no separate admin UI, Supabase's own dashboard already does that job.
//
// Grid videos autoplay muted with no controls, as a silent looping
// preview; clicking any tile (image or video) opens it in a lightbox at
// full size, where video gets a custom control bar (see buildVideoPlayer)
// instead of the browser's native one — native controls can't be
// meaningfully restyled across browsers, so this is a real play/scrub/
// mute/fullscreen bar built from scratch in the site's own visual language
// (accent color, glass chrome, the same icon style as the HUD buttons).

import { fetchGalleryItems } from './supabase.js'

// Mounts the (initially hidden) gallery view into `root` and returns
// { show, hide }. `onClose` fires when the view's own "Back to room"
// button is clicked — main.js supplies the actual crossfade logic there.
export function initGallery(root, { onClose } = {}) {
  const view = document.createElement('div')
  view.id = 'gallery-view'

  view.innerHTML = `
    <div class="w-full px-6 py-24 md:px-12 lg:px-16">
      <button type="button" id="gallery-back"
        class="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ui-text-muted)] transition-colors hover:text-[var(--ui-text)]">
        &larr; Back to room
      </button>
      <p class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--ui-accent)]">Build</p>
      <h1 class="mb-8 text-3xl font-semibold text-[var(--ui-text)]">Gallery</h1>
      <div id="gallery-grid" class="gallery-grid"></div>
    </div>

    <div id="lightbox" class="lightbox" hidden>
      <button id="lightbox-close" type="button" aria-label="Close" class="lightbox-close">&times;</button>
      <div id="lightbox-content" class="lightbox-content"></div>
    </div>
  `
  root.append(view)

  const grid = view.querySelector('#gallery-grid')
  const lightbox = view.querySelector('#lightbox')
  const lightboxContent = view.querySelector('#lightbox-content')

  view.querySelector('#gallery-back').addEventListener('click', () => onClose?.())

  // Fetched once, the first time the view is actually shown — not on page
  // load, since most visits may never open it.
  let loaded = false

  function show() {
    view.classList.add('visible')
    if (loaded) return
    loaded = true
    fetchGalleryItems()
      .then((items) => {
        grid.innerHTML = items.length
          ? items.map(renderTile).join('')
          : `<div class="gallery-empty">Nothing here yet — add rows to gallery_items in Supabase.</div>`
        wireTiles(items)
      })
      .catch((error) => {
        console.error('Failed to load gallery items from Supabase', error)
        grid.innerHTML = `<div class="gallery-empty">Couldn't load this right now.</div>`
      })
  }

  function hide() {
    view.classList.remove('visible')
    closeLightbox()
  }

  function renderTile(item) {
    const media =
      item.media_type === 'video'
        ? `<video src="${escapeHtml(item.url)}" autoplay muted loop playsinline></video>`
        : `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.caption ?? '')}" loading="lazy" />`

    return `
      <figure class="gallery-tile" role="button" tabindex="0">
        ${media}
        ${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ''}
      </figure>`
  }

  // Tiles and `items` share the same order they were rendered in, so
  // position in the NodeList maps straight back to the row it came from.
  function wireTiles(items) {
    ;[...grid.querySelectorAll('.gallery-tile')].forEach((tile, i) => {
      const open = () => openLightbox(items[i])
      tile.addEventListener('click', open)
      tile.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        open()
      })
    })
  }

  function openLightbox(item) {
    lightboxContent.innerHTML = ''

    if (item.media_type === 'video') {
      lightboxContent.append(buildVideoPlayer(item.url))
    } else {
      const img = document.createElement('img')
      img.src = item.url
      img.alt = item.caption ?? ''
      lightboxContent.append(img)
    }

    if (item.caption) {
      const caption = document.createElement('p')
      caption.className = 'lightbox-caption'
      caption.textContent = item.caption
      lightboxContent.append(caption)
    }

    lightbox.hidden = false
    // Let `hidden` clear and paint before starting the opacity transition,
    // or the browser has nothing to animate from.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => lightbox.classList.add('open'))
    })
  }

  function closeLightbox() {
    if (lightbox.hidden) return
    lightbox.classList.remove('open')
    lightboxContent.querySelector('video')?.pause()
    setTimeout(() => {
      lightbox.hidden = true
      lightboxContent.innerHTML = ''
    }, 200)
  }

  view.querySelector('#lightbox-close').addEventListener('click', closeLightbox)
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox()
  })

  return { show, hide }
}

// A from-scratch video player: play/pause, a scrubber, elapsed/total time,
// mute, and fullscreen — themed with the site's accent color and glass
// chrome instead of relying on the browser's native (and unstyleable)
// controls UI.
function buildVideoPlayer(src) {
  const wrap = document.createElement('div')
  wrap.className = 'video-player'

  const video = document.createElement('video')
  video.src = src
  video.autoplay = true
  video.playsInline = true
  wrap.append(video)

  const bar = document.createElement('div')
  bar.className = 'video-controls'

  const playButton = iconButton(playIcon())
  const currentTime = timeLabel()
  const scrubber = document.createElement('input')
  scrubber.type = 'range'
  scrubber.className = 'video-scrubber'
  scrubber.min = '0'
  scrubber.max = '100'
  scrubber.value = '0'
  scrubber.step = '0.1'
  setScrubberFill(scrubber, 0)
  const totalTime = timeLabel()
  const muteButton = iconButton(unmutedIcon())
  const fullscreenButton = iconButton(fullscreenIcon())

  bar.append(playButton, currentTime, scrubber, totalTime, muteButton, fullscreenButton)
  wrap.append(bar)

  // Dragging the scrubber shouldn't seek on every intermediate mousemove
  // (that fights with `timeupdate` re-syncing it) — only once released.
  let scrubbing = false

  playButton.addEventListener('click', () => (video.paused ? video.play() : video.pause()))
  video.addEventListener('play', () => (playButton.innerHTML = pauseIcon()))
  video.addEventListener('pause', () => (playButton.innerHTML = playIcon()))

  video.addEventListener('loadedmetadata', () => {
    totalTime.textContent = formatTime(video.duration)
  })
  video.addEventListener('timeupdate', () => {
    if (scrubbing) return
    currentTime.textContent = formatTime(video.currentTime)
    const percent = video.duration ? (video.currentTime / video.duration) * 100 : 0
    scrubber.value = String(percent)
    setScrubberFill(scrubber, percent)
  })
  video.addEventListener('ended', () => (playButton.innerHTML = playIcon()))

  scrubber.addEventListener('pointerdown', () => (scrubbing = true))
  scrubber.addEventListener('input', () => setScrubberFill(scrubber, Number(scrubber.value)))
  scrubber.addEventListener('change', () => {
    if (video.duration) video.currentTime = (Number(scrubber.value) / 100) * video.duration
    scrubbing = false
  })

  muteButton.addEventListener('click', () => {
    video.muted = !video.muted
    muteButton.innerHTML = video.muted ? mutedIcon() : unmutedIcon()
  })

  fullscreenButton.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      wrap.requestFullscreen?.()
    }
  })

  return wrap
}

function iconButton(iconHtml) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'video-btn'
  button.innerHTML = iconHtml
  return button
}

function timeLabel() {
  const span = document.createElement('span')
  span.className = 'video-time'
  span.textContent = '0:00'
  return span
}

// Paints the filled portion of the range input directly on its own
// background — range inputs have no native "progress" pseudo-element, so
// this is the standard cross-browser way to show a filled track.
function setScrubberFill(scrubber, percent) {
  scrubber.style.background = `linear-gradient(to right, var(--ui-accent) ${percent}%, rgba(255, 255, 255, 0.25) ${percent}%)`
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function playIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`
}
function pauseIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>`
}
function unmutedIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>`
}
function mutedIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M16 9l6 6M22 9l-6 6"/></svg>`
}
function fullscreenIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`
}

function escapeHtml(value) {
  const div = document.createElement('div')
  div.textContent = String(value ?? '')
  return div.innerHTML
}
