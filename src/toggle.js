// Day/night pill toggle. Lives as a child of main.js's bottom-center HUD
// row (alongside the reset-zoom button) rather than positioning itself.
// Toggles body.night — style.css and scene.js both react to that class.
//
// The class may already be on <body> when this runs (applied by the inline
// script in index.html, from the stored preference) — this reads that
// instead of assuming day, so the toggle's own visual state matches.

import { saveTheme } from './theme.js'

export function initToggle(root) {
  const toggle = document.createElement('button')
  toggle.id = 'day-night-toggle'
  toggle.type = 'button'
  toggle.setAttribute('aria-label', 'Toggle day and night')

  const knob = document.createElement('span')
  knob.className = [
    'flex h-7 w-7 items-center justify-center rounded-full',
    // White accent (not the theme purple) — matches the hotspot dots and
    // the frosted white hover used elsewhere in the HUD.
    'bg-white text-gray-800',
    'transition-transform duration-300 ease-out',
  ].join(' ')

  toggle.className = [
    'flex h-9 w-16 items-center rounded-full p-1',
    'border border-[var(--ui-border)] bg-[var(--glass-bg)] shadow-[var(--ui-shadow)] backdrop-blur-md',
  ].join(' ')

  applyState(document.body.classList.contains('night'))

  toggle.append(knob)
  root.append(toggle)

  toggle.addEventListener('click', () => {
    const isNight = document.body.classList.toggle('night')
    applyState(isNight)
    saveTheme(isNight)
  })

  function applyState(isNight) {
    toggle.setAttribute('aria-pressed', String(isNight))
    knob.style.transform = isNight ? 'translateX(28px)' : 'translateX(0)'
    knob.innerHTML = isNight ? moonIcon() : sunIcon()
  }

  return toggle
}

function sunIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`
}

function moonIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
}
