// Slide-in detail panel populated from a Supabase `objects` row (or, for
// the nav sections, an accordion list). Dispatches "panel:open" /
// "panel:close" events (bubbling, on the panel element) so main.js can
// toggle #stage's `panel-open` class in sync — panel.js itself doesn't
// know anything about the scene, #stage, or drag logic.

// Documents the "45%" used in two other places it must stay in sync with by
// hand (Tailwind's scanner needs a literal class, so this constant can't
// generate it): the literal `w-[45%]` class below, and style.css's
// `#stage.panel-open { right: min(45%, 90vw); }`.
export const PANEL_WIDTH_RATIO = 0.45

// How long the content crossfade takes when the panel is already open and
// its content is being swapped for something else (a different hotspot, or
// a different nav section) — fade-out then fade-in, so the total visible
// transition is 2x this, 0.5s.
const CONTENT_SWAP_MS = 250

let panelEl = null
let isOpen = false

export function initPanel(root) {
  panelEl = document.createElement('aside')
  panelEl.id = 'panel'
  panelEl.className = [
    'fixed top-0 right-0 z-30 h-full w-[45%] max-w-[90vw] overflow-y-auto',
    'bg-[var(--ui-bg-solid)] text-[var(--ui-text)]',
    'border-l border-[var(--ui-border)] shadow-[var(--ui-shadow)]',
    // The actual transition (transform, 500ms ease-in-out cubic — matching
    // scene.js's focus-pan animation so the panel and image move as one) is
    // declared in style.css's #panel rule, not here as a utility class: an
    // ID selector there would otherwise outrank and silently drop whichever
    // property a plain utility class sets. Just position it off-screen.
    'translate-x-full',
  ].join(' ')

  root.append(panelEl)

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel()
  })

  // Close on click outside — but not for clicks on a hotspot zone or the
  // section nav, which manage opening/switching the panel themselves (via
  // a smooth content crossfade, not a close+reopen — see present()), nor
  // the HUD (day/night toggle, reset-zoom) — neither should ever close the
  // panel, they're unrelated controls the user may still want open for.
  document.addEventListener('pointerdown', (e) => {
    if (!panelEl.classList.contains('open')) return
    if (panelEl.contains(e.target)) return
    if (e.target.closest?.('.hotspot-zone')) return
    if (e.target.closest?.('#side-nav')) return
    if (e.target.closest?.('#hud')) return
    closePanel()
  })

  return panelEl
}

export function openPanel(row) {
  present(renderContent(row), row)
}

// Work-experience list — a fixed section, not tied to any hotspot. Each
// card starts on its one-line summary; clicking anywhere on it swaps in
// the bullet list with a smooth animated transition (see .exp-collapse in
// style.css) instead of the instant snap a native <details> would give.
// At most one card is expanded at a time (see wireAccordion).
export function openExperiencePanel(entries) {
  present(renderAccordionContent('Work', 'Experience', entries, renderExperienceEntry), entries, wireAccordion)
}

// Projects list — same accordion behaviour as Experience, plus a "Gallery"
// button up top. `onGalleryClick` is main.js's crossfade into the in-app
// gallery view — panel.js just renders the button and forwards the click,
// it doesn't know anything about the scene/gallery itself.
export function openProjectsPanel(entries, onGalleryClick) {
  present(
    renderAccordionContent(
      'Build',
      'Projects',
      entries,
      (entry) => renderCardEntry(entry, { showLink: false }),
      { headerAction: galleryButton }
    ),
    entries,
    () => {
      wireAccordion()
      panelEl.querySelector('#panel-gallery-btn')?.addEventListener('click', () => onGalleryClick?.())
    }
  )
}

// Education: a fixed, non-collapsible header for the degree, then an
// accordion list of certifications/courses underneath it — same list
// treatment as Projects/Hobbies.
export function openEducationPanel({ degree, certifications } = {}) {
  present(
    renderAccordionContent('Education', 'Education', certifications, renderCardEntry, {
      beforeList: renderDegreeHeader(degree),
    }),
    { degree, certifications },
    wireAccordion
  )
}

// Hobbies list — same accordion treatment as Projects, minus the tag chips
// (tags read as a tech-stack/skill list, which doesn't fit a hobby).
export function openHobbiesPanel(entries) {
  present(
    renderAccordionContent('Life', 'Hobbies', entries, (entry) => renderCardEntry(entry, { showTags: false })),
    entries,
    wireAccordion
  )
}

// Each accordion card is the whole `.exp-entry` element, not just its
// header — clicking any part of it (summary, bullets, tags) toggles it,
// and opening one collapses whichever other card was open.
function wireAccordion() {
  const entries = [...panelEl.querySelectorAll('.exp-entry')]

  entries.forEach((entry) => {
    const toggle = () => {
      const wasExpanded = entry.classList.contains('expanded')
      entries.forEach((other) => {
        other.classList.remove('expanded')
        other.setAttribute('aria-expanded', 'false')
      })
      if (!wasExpanded) {
        entry.classList.add('expanded')
        entry.setAttribute('aria-expanded', 'true')
      }
    }

    entry.addEventListener('click', toggle)
    entry.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      toggle()
    })
  })

  // Links inside a card (e.g. a project's "View project") shouldn't also
  // toggle the card they're sitting in.
  panelEl.querySelectorAll('.exp-entry a').forEach((link) => {
    link.addEventListener('click', (e) => e.stopPropagation())
  })
}

// Renders `html` into the panel. If the panel is already open showing
// something else, the swap crossfades (fade the old content out, then the
// new content in) instead of snapping instantly — clicking a different
// hotspot, or a different nav section, while the panel's open should read
// as "the same panel, new content," not a flicker of close-then-reopen.
// `onRendered` (accordion wiring) runs right when the new content actually
// lands in the DOM, which for the crossfade case is after its own delay —
// wiring it eagerly, before that, would silently find nothing to wire up.
function present(html, detail, onRendered) {
  if (!panelEl) return

  const swapIn = () => {
    panelEl.innerHTML = html
    panelEl.querySelector('#panel-close').addEventListener('click', closePanel)
    onRendered?.()
  }

  if (isOpen && panelEl.firstElementChild) {
    const outgoing = panelEl.firstElementChild
    outgoing.style.transition = `opacity ${CONTENT_SWAP_MS}ms ease`
    outgoing.style.opacity = '0'

    setTimeout(() => {
      swapIn()
      const incoming = panelEl.firstElementChild
      incoming.style.transition = `opacity ${CONTENT_SWAP_MS}ms ease`
      incoming.style.opacity = '0'
      // Double rAF: guarantees the browser has painted opacity: 0 before
      // flipping to 1, so it actually animates instead of the two style
      // writes getting coalesced into one frame with nothing to see.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          incoming.style.opacity = '1'
        })
      })
    }, CONTENT_SWAP_MS)
  } else {
    swapIn()
  }

  panelEl.classList.remove('translate-x-full')
  panelEl.classList.add('open')
  isOpen = true
  panelEl.dispatchEvent(new CustomEvent('panel:open', { bubbles: true, detail }))
}

export function closePanel() {
  if (!panelEl || !isOpen) return
  panelEl.classList.add('translate-x-full')
  panelEl.classList.remove('open')
  isOpen = false
  panelEl.dispatchEvent(new CustomEvent('panel:close', { bubbles: true }))
}

// Markup shared by every panel view.
const closeButton = `
  <button id="panel-close" type="button" aria-label="Close panel"
    class="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-border)]">
    &times;
  </button>`

// Projects panel header button — crossfades into the in-app gallery view
// (see openProjectsPanel's onGalleryClick wiring).
const galleryButton = `
  <button type="button" id="panel-gallery-btn"
    class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ui-accent)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90">
    Gallery
  </button>`

function renderContent(row) {
  const tags = (row.tags ?? [])
    .map(
      (tag) => `
        <span class="mb-1.5 mr-1.5 inline-block rounded-full border border-[var(--ui-accent)]/30 bg-[var(--ui-accent)]/15 px-2.5 py-1 text-xs text-[var(--ui-accent)]">
          ${escapeHtml(tag)}
        </span>`
    )
    .join('')

  const gallery = (row.images ?? [])
    .map(
      (src) => `
        <img src="${escapeHtml(src)}" alt="" class="mb-2 h-32 w-full rounded-lg object-cover" />`
    )
    .join('')

  const links = (row.links ?? [])
    .map(
      (link) => `
        <a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer"
          class="mb-2 mr-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--ui-accent)] px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
          ${escapeHtml(link.label ?? link.url)}
        </a>`
    )
    .join('')

  return `
    <div class="relative p-6">
      ${closeButton}

      ${row.thumbnail ? `<img src="${escapeHtml(row.thumbnail)}" alt="" class="mb-4 h-44 w-full rounded-xl object-cover" />` : ''}

      ${row.eyebrow ? `<p class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--ui-accent)]">${escapeHtml(row.eyebrow)}</p>` : ''}
      <h2 class="mb-3 text-2xl font-semibold">${escapeHtml(row.label ?? '')}</h2>
      ${row.description ? `<p class="mb-4 text-sm leading-relaxed text-[var(--ui-text-muted)]">${escapeHtml(row.description)}</p>` : ''}

      ${tags ? `<div class="mb-4">${tags}</div>` : ''}
      ${gallery ? `<div class="mb-4">${gallery}</div>` : ''}
      ${links ? `<div>${links}</div>` : ''}
    </div>
  `
}

// Shared shell for the accordion-list views (Experience, Projects,
// Education, Hobbies) — same eyebrow/title/close-button/empty-state
// scaffold, with room for an optional header action button (Projects'
// "Gallery" link) and optional content before the list (Education's
// degree header).
function renderAccordionContent(eyebrow, title, entries, renderEntry, { beforeList = '', headerAction = '' } = {}) {
  const items = (entries ?? []).map(renderEntry).join('')

  return `
    <div class="relative p-6">
      ${closeButton}

      <p class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--ui-accent)]">${escapeHtml(eyebrow)}</p>
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="text-2xl font-semibold">${escapeHtml(title)}</h2>
        ${headerAction}
      </div>

      ${beforeList}

      ${items || `<p class="text-sm text-[var(--ui-text-muted)]">Nothing here yet.</p>`}
    </div>
  `
}

// Fixed, non-collapsible header shown above the certifications accordion —
// there's only ever one degree, so it doesn't need to expand/collapse.
// Field of study leads (with period stuck to the far right, next to it),
// then degree, then institution.
function renderDegreeHeader(degree) {
  if (!degree) return ''

  return `
    <div class="mb-5 border-b border-[var(--ui-border)] pb-5">
      <div class="flex items-baseline justify-between gap-3">
        ${degree.field ? `<p class="font-semibold text-[var(--ui-accent)]">${escapeHtml(degree.field)}</p>` : ''}
        ${degree.period ? `<p class="shrink-0 text-xs text-[var(--ui-text-muted)]">${escapeHtml(degree.period)}</p>` : ''}
      </div>
      ${degree.degree ? `<p class="mt-1 font-semibold">${escapeHtml(degree.degree)}</p>` : ''}
      ${degree.institution ? `<p class="text-sm text-[var(--ui-text-muted)]">${escapeHtml(degree.institution)}</p>` : ''}
      ${degree.description ? `<p class="mt-2 text-sm leading-relaxed text-[var(--ui-text-muted)]">${escapeHtml(degree.description)}</p>` : ''}
    </div>
    <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">Certifications &amp; courses</p>
  `
}

// Each entry starts on its one-line summary; clicking the header swaps to
// its bullet list (see .exp-collapse in style.css for the animation) —
// the summary and bullets are mutually exclusive, never shown together.
// Period sits stuck to the far right, ahead of the expand chevron.
function renderExperienceEntry(entry) {
  const bullets = (entry.bullets ?? []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')

  return `
    <div class="exp-entry mb-3 cursor-pointer rounded-lg border border-[var(--ui-border)] p-3"
      role="button" tabindex="0" aria-expanded="false">
      <div class="exp-toggle flex w-full items-center justify-between gap-3 text-left">
        <span class="min-w-0">
          <span class="block font-semibold">${escapeHtml(entry.role ?? '')}</span>
          ${entry.company ? `<span class="block text-xs text-[var(--ui-text-muted)]">${escapeHtml(entry.company)}</span>` : ''}
        </span>
        <span class="flex shrink-0 items-center gap-2">
          ${entry.period ? `<span class="text-xs text-[var(--ui-text-muted)]">${escapeHtml(entry.period)}</span>` : ''}
          <span class="exp-chevron text-[var(--ui-text-muted)]">&#9662;</span>
        </span>
      </div>
      <div class="exp-collapse exp-collapse--summary">
        <div class="pt-2 text-sm text-[var(--ui-text-muted)]">${escapeHtml(entry.summary ?? '')}</div>
      </div>
      <div class="exp-collapse exp-collapse--bullets">
        <div class="pt-2">
          <ul class="list-disc space-y-1.5 pl-5 text-sm text-[var(--ui-text-muted)]">${bullets}</ul>
        </div>
      </div>
    </div>`
}

// Generic card used by Projects, Education's certifications, and Hobbies —
// all three are the same shape: title, one-line summary (collapsed), and
// a longer description + tags + optional link (expanded). `showTags: false`
// (Hobbies) skips the tag chips entirely; `showLink: false` (Projects)
// skips the "View" button entirely.
function renderCardEntry(entry, { showTags = true, showLink = true } = {}) {
  const tags = showTags
    ? (entry.tags ?? [])
        .map(
          (tag) => `
        <span class="mb-1.5 mr-1.5 inline-block rounded-full border border-[var(--ui-accent)]/30 bg-[var(--ui-accent)]/15 px-2 py-0.5 text-xs text-[var(--ui-accent)]">
          ${escapeHtml(tag)}
        </span>`
        )
        .join('')
    : ''

  const link =
    showLink && entry.link
      ? `<a href="${escapeHtml(entry.link)}" target="_blank" rel="noreferrer"
        class="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[var(--ui-accent)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90">
        View
      </a>`
      : ''

  return `
    <div class="exp-entry mb-3 cursor-pointer rounded-lg border border-[var(--ui-border)] p-3"
      role="button" tabindex="0" aria-expanded="false">
      <div class="exp-toggle flex w-full items-center justify-between gap-3 text-left">
        <span class="block font-semibold">${escapeHtml(entry.title ?? '')}</span>
        <span class="exp-chevron shrink-0 text-[var(--ui-text-muted)]">&#9662;</span>
      </div>
      <div class="exp-collapse exp-collapse--summary">
        <div class="pt-2 text-sm text-[var(--ui-text-muted)]">${escapeHtml(entry.summary ?? '')}</div>
      </div>
      <div class="exp-collapse exp-collapse--bullets">
        <div class="pt-2">
          ${entry.description ? `<p class="mb-2 text-sm leading-relaxed text-[var(--ui-text-muted)]">${escapeHtml(entry.description)}</p>` : ''}
          ${tags ? `<div class="mb-1">${tags}</div>` : ''}
          ${link}
        </div>
      </div>
    </div>`
}

function escapeHtml(value) {
  const div = document.createElement('div')
  div.textContent = String(value ?? '')
  return div.innerHTML
}
