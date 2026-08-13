// Reset-zoom button. Lives as a child of main.js's bottom-center HUD row,
// next to the day/night toggle — this module only builds the button and
// reports clicks; it doesn't know anything about the scene's zoom/pan state.

export function initZoomReset(root, onReset) {
  const button = document.createElement('button')
  button.id = 'zoom-reset'
  button.type = 'button'
  button.setAttribute('aria-label', 'Reset zoom')
  button.className = [
    'flex h-9 w-9 items-center justify-center rounded-full',
    'border border-[var(--ui-border)] bg-[var(--ui-bg)] text-[var(--ui-text)]',
    'shadow-[var(--ui-shadow)] backdrop-blur-sm',
    // Frosted white tint on hover (not the near-transparent --ui-border) so
    // the icon stays legible against a bright background image in light mode.
    'transition-colors duration-200 hover:bg-[var(--ui-hover-bg)] hover:backdrop-blur-md',
  ].join(' ')
  button.innerHTML = resetIcon()

  button.addEventListener('click', onReset)

  root.append(button)
  return button
}

function resetIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>`
}
