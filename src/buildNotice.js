// Small "site under construction" notice, pinned bottom-left — vertically
// in line with the day/night toggle and reset-zoom buttons (both bottom-6).
// Purely informational — no interaction, no persistence — so it's safe to
// mount on any page that also has that HUD (index, gallery).

export function initBuildNotice(root) {
  const notice = document.createElement('div')
  notice.className = [
    'pointer-events-none fixed bottom-6 left-6 z-20 flex max-w-[min(90vw,22rem)] items-start gap-2',
    'rounded-xl border border-[var(--ui-border)] bg-[var(--glass-bg)] px-4 py-2.5',
    'text-xs font-medium leading-snug text-[var(--ui-text)] shadow-[var(--ui-shadow)] backdrop-blur-md',
  ].join(' ')
  notice.innerHTML = `
    ${warningIcon()}
    <span>This site is still under construction — some parts may be incomplete.</span>
  `
  root.append(notice)
  return notice
}

function warningIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 shrink-0 text-[var(--ui-accent)]"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
}
