// Persistent site-section nav pinned to the top edge — dimmed and grey by
// default, brightens to white and full opacity on hover. Buttons are inert
// for now (no routing/section data exists yet); wiring them up is a
// follow-up once those sections have somewhere to point to.
//
// Mounted inside #stage (not #app) and positioned `absolute`, not `fixed` —
// that's what makes it re-center on #stage's shrunk width when the panel
// opens instead of staying centered on the full viewport behind it.

const SECTIONS = ['Education', 'Experience', 'Projects', 'Hobbies', 'Extras']

export function initNav(root) {
  const nav = document.createElement('nav')
  nav.id = 'side-nav'
  nav.setAttribute('aria-label', 'Site sections')
  nav.className = [
    'group absolute left-1/2 top-0 z-20 -translate-x-1/2',
    'flex items-stretch gap-1 rounded-b-2xl px-3 pb-3 pt-2',
    'bg-black/30 opacity-50 backdrop-blur-sm',
    'transition-all duration-300 hover:bg-black/50 hover:opacity-100',
  ].join(' ')

  SECTIONS.forEach((label) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.className = [
      'whitespace-nowrap rounded-full px-4 py-2 text-center text-sm font-medium',
      'text-white/40 transition-colors duration-300 group-hover:text-white',
      'hover:bg-white/10',
    ].join(' ')
    nav.append(button)
  })

  root.append(nav)
  return nav
}
