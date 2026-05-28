const overlayEl = document.getElementById('action-overlay')
const iconEl    = document.getElementById('overlay-icon')
const titleEl   = document.getElementById('overlay-title')
const descEl    = document.getElementById('overlay-desc')

export function showOverlay(icon, title, desc) {
  iconEl.textContent  = icon
  titleEl.textContent = title
  descEl.textContent  = desc
  overlayEl.classList.remove('hidden')
}

export function hideOverlay() {
  overlayEl.classList.add('hidden')
}

export function isOverlayVisible() {
  return !overlayEl.classList.contains('hidden')
}
