// Persists the day/night preference to localStorage so it survives
// reloads. The *initial* read-and-apply happens even earlier than any
// module code, in a small inline script in index.html's <body> (so the
// right theme is already active before first paint, no flash of the
// wrong one) — that script can't import this file, so STORAGE_KEY is
// duplicated there by hand, the same way PANEL_WIDTH_RATIO documents its
// own manually-synced constant.
const STORAGE_KEY = 'room-portfolio:theme'

export function saveTheme(isNight) {
  try {
    localStorage.setItem(STORAGE_KEY, isNight ? 'night' : 'day')
  } catch {
    // Private browsing / storage disabled — persistence just won't work
    // this session; the toggle itself still works fine either way.
  }
}
