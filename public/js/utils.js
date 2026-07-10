const COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#22c55e',
  '#06b6d4', '#a855f7', '#ef4444', '#14b8a6',
]

/** Deterministic color based on username string */
export function colorFor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

/**
 * Create a flat icon avatar (no background box).
 *  • Bot   → purple robot SVG
 *  • Admin → pink   person SVG
 *  • User  → blue   person SVG
 */
export function makeAvatar(_name, size = 20, isAdmin = false, isBot = false) {
  const el = document.createElement('div')
  el.className = 'avatar'
  el.style.cssText = `width:${size}px;height:${size}px`
  el.innerHTML = isBot
    ? _robotSvg('#a78bfa')
    : _personSvg(isAdmin ? '#f472b6' : '#60a5fa')
  return el
}

// ── SVG shapes ────────────────────────────────────────────

function _personSvg(color) {
  return `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" fill="${color}">
    <circle cx="10" cy="5.5" r="3.6"/>
    <path d="M1 19.5c0-4.97 4.03-9 9-9s9 4.03 9 9"/>
  </svg>`
}

function _robotSvg(color) {
  return `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <!-- antenna -->
    <circle cx="10" cy="1"   r="1.2"              fill="${color}"/>
    <rect   x="9.3" y="1"   width="1.4" height="2.5" rx="0.7" fill="${color}"/>
    <!-- head -->
    <rect   x="2"   y="3.5" width="16"  height="11"  rx="3"   fill="${color}"/>
    <!-- eye whites -->
    <rect   x="4"   y="6"   width="4.5" height="3.5" rx="1.5" fill="white" opacity=".9"/>
    <rect   x="11.5" y="6"  width="4.5" height="3.5" rx="1.5" fill="white" opacity=".9"/>
    <!-- pupils -->
    <rect   x="5.25"  y="7" width="2"   height="1.5" rx=".75" fill="${color}"/>
    <rect   x="12.75" y="7" width="2"   height="1.5" rx=".75" fill="${color}"/>
    <!-- mouth grill (3 segments) -->
    <rect   x="5.5"  y="11.5" width="2.5" height="1.5" rx=".5" fill="white" opacity=".85"/>
    <rect   x="8.75" y="11.5" width="2.5" height="1.5" rx=".5" fill="white" opacity=".85"/>
    <rect   x="12"   y="11.5" width="2.5" height="1.5" rx=".5" fill="white" opacity=".85"/>
    <!-- body -->
    <rect   x="6.5"  y="15.5" width="7"  height="4.5" rx="2"  fill="${color}"/>
  </svg>`
}

/** Format an ISO timestamp as HH:MM (Thai locale) */
export function timeStr(iso) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
