// Slide-in detail panel populated from a Supabase `objects` row.
// Dispatches "panel:open" / "panel:close" events (bubbling, on the panel
// element) so main.js can toggle #stage's `panel-open` class in sync —
// panel.js itself doesn't know anything about the scene, #stage, or drag
// logic.

// Documents the "45%" used in two other places it must stay in sync with by
// hand (Tailwind's scanner needs a literal class, so this constant can't
// generate it): the literal `w-[45%]` class below, and style.css's
// `#stage.panel-open { right: min(45%, 90vw); }`.
export const PANEL_WIDTH_RATIO = 0.45

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

  // Close on click outside — but not for clicks on a hotspot zone, which
  // manage opening/switching the panel themselves.
  document.addEventListener('pointerdown', (e) => {
    if (!panelEl.classList.contains('open')) return
    if (panelEl.contains(e.target)) return
    if (e.target.closest?.('.hotspot-zone')) return
    closePanel()
  })

  return panelEl
}

export function openPanel(row) {
  if (!panelEl) return
  panelEl.innerHTML = renderContent(row)
  panelEl.querySelector('#panel-close').addEventListener('click', closePanel)
  panelEl.classList.remove('translate-x-full')
  panelEl.classList.add('open')
  isOpen = true
  panelEl.dispatchEvent(new CustomEvent('panel:open', { bubbles: true, detail: row }))
}

export function closePanel() {
  if (!panelEl || !isOpen) return
  panelEl.classList.add('translate-x-full')
  panelEl.classList.remove('open')
  isOpen = false
  panelEl.dispatchEvent(new CustomEvent('panel:close', { bubbles: true }))
}

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
      <button id="panel-close" type="button" aria-label="Close panel"
        class="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-border)]">
        &times;
      </button>

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

function escapeHtml(value) {
  const div = document.createElement('div')
  div.textContent = String(value ?? '')
  return div.innerHTML
}
