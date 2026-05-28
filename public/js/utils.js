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

/** Create an avatar <div> with initials and a background color */
export function makeAvatar(name, size = 28) {
  const el = document.createElement('div')
  el.className = 'avatar'
  el.style.cssText = [
    `background:${colorFor(name)}`,
    `width:${size}px`,
    `height:${size}px`,
    `font-size:${Math.round(size * 0.36)}px`,
  ].join(';')
  el.textContent = name.slice(0, 2).toUpperCase()
  return el
}

/** Format an ISO timestamp as HH:MM (Thai locale) */
export function timeStr(iso) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
