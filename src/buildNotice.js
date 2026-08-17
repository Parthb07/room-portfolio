// Small "site under construction" notice, pinned bottom-left — vertically
// in line with the day/night toggle and reset-zoom buttons (both bottom-6).
// Clickable: expands to a list of upcoming changes, pulled from Supabase's
// `upcoming_changes` table (fetched once, on first expand — same lazy
// pattern gallery.js uses) so the roadmap is editable without a code change.

import { fetchUpcomingChanges } from './supabase.js'

export function initBuildNotice(root) {
  const notice = document.createElement('div')
  notice.id = 'build-notice'
  notice.setAttribute('role', 'button')
  notice.setAttribute('tabindex', '0')
  notice.setAttribute('aria-expanded', 'false')
  notice.className = [
    'fixed bottom-6 left-6 z-20 max-w-[min(90vw,24rem)] cursor-pointer',
    'rounded-xl border border-[var(--ui-border)] bg-[var(--glass-bg)] px-4 py-2.5',
    'text-xs font-medium leading-snug text-[var(--ui-text)] shadow-[var(--ui-shadow)] backdrop-blur-md',
  ].join(' ')
  notice.innerHTML = `
    <div class="flex items-start gap-2">
      ${warningIcon()}
      <span class="flex-1">This page is still being built. Some parts may be incomplete. Click to learn more</span>
      <span class="notice-chevron mt-0.5 shrink-0 text-[var(--ui-text-muted)]">&#9662;</span>
    </div>
    <div class="notice-collapse">
      <div class="pt-3">
        <p class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--ui-accent)]">Upcoming changes</p>
        <ul id="notice-changes-list" class="list-disc space-y-1 pl-4 text-[var(--ui-text-muted)]"></ul>
      </div>
    </div>
  `
  root.append(notice)

  const list = notice.querySelector('#notice-changes-list')
  let loaded = false

  function toggle() {
    const expanded = notice.classList.toggle('expanded')
    notice.setAttribute('aria-expanded', String(expanded))
    if (!expanded || loaded) return

    loaded = true
    list.innerHTML = `<li>Loading…</li>`
    fetchUpcomingChanges()
      .then((items) => {
        list.innerHTML = items.length
          ? items.map((item) => `<li>${escapeHtml(item.description)}</li>`).join('')
          : `<li>Nothing planned yet.</li>`
      })
      .catch((error) => {
        console.error('Failed to load upcoming changes from Supabase', error)
        list.innerHTML = `<li>Couldn't load this right now.</li>`
      })
  }

  notice.addEventListener('click', toggle)
  notice.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    toggle()
  })

  return notice
}

function warningIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 shrink-0 text-[var(--ui-accent)]"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
}

function escapeHtml(value) {
  const div = document.createElement('div')
  div.textContent = String(value ?? '')
  return div.innerHTML
}
