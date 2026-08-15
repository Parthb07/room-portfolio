// Persistent site-section nav, floating below the top edge. Same frosted
// pill chrome as the day/night toggle (border/bg/shadow/backdrop-blur off
// the shared --glass-bg/--ui-* theme variables) with a white-tint hover,
// instead of the dimmed/grey-until-hovered look it used to have.
//
// Mounted inside #stage (not #app) and positioned `absolute`, not `fixed` —
// that's what makes it re-center on #stage's shrunk width when the panel
// opens instead of staying centered on the full viewport behind it.
//
// Section buttons are inert beyond the `onSectionClick` callback main.js
// hooks per-label; Home is a real link back to "/" since that much doesn't
// need any app state. Each section button carries `data-section` so
// setActiveNavSection can find and highlight whichever one corresponds to
// the panel currently open (from either a nav click or a linked hotspot).

const SECTIONS = ['Education', 'Experience', 'Projects', 'Hobbies']

export function initNav(root, onSectionClick) {
  const nav = document.createElement('nav')
  nav.id = 'side-nav'
  nav.setAttribute('aria-label', 'Site sections')
  nav.className = [
    'absolute left-1/2 top-4 z-20 -translate-x-1/2',
    'flex items-stretch gap-1 rounded-full border border-[var(--ui-border)] p-1',
    'bg-[var(--glass-bg)] shadow-[var(--ui-shadow)] backdrop-blur-md',
  ].join(' ')

  const home = document.createElement('a')
  home.href = '/'
  home.setAttribute('aria-label', 'Home')
  home.className = [
    'flex items-center justify-center rounded-full px-3 py-2',
    'bg-white/50 text-[var(--ui-text)] transition-colors duration-200 hover:bg-[var(--ui-hover-bg)]',
    'mr-1',
  ].join(' ')
  home.innerHTML = homeIcon()
  nav.append(home)

  SECTIONS.forEach((label) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.dataset.section = label
    button.className = [
      'whitespace-nowrap rounded-full px-4 py-2 text-center text-sm font-medium',
      'text-[var(--ui-text)] transition-colors duration-200 hover:bg-[var(--ui-hover-bg)]',
    ].join(' ')
    button.addEventListener('click', () => onSectionClick?.(label))
    nav.append(button)
  })

  root.append(nav)
  return nav
}

// Highlights whichever section button matches `label` (frosted chip with an
// accent ring — see #side-nav button.nav-active in style.css) and clears
// the others. Pass `null` to clear all of them (e.g. when the panel closes,
// or it's showing something that isn't a nav section).
export function setActiveNavSection(nav, label) {
  nav.querySelectorAll('[data-section]').forEach((button) => {
    button.classList.toggle('nav-active', button.dataset.section === label)
  })
}

function homeIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>`
}
