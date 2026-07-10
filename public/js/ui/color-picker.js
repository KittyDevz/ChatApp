/**
 * color-picker.js — Message text color picker
 *
 * Injects a color button into #message-form (before #send-btn).
 * Opens a swatch popup; chosen color is stored in state.myColor.
 */

import { state } from '../state.js'

const PRESETS = [
  // Row 1 — warm
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  // Row 2 — cool
  '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6',
  // Row 3 — accent
  '#ec4899', '#64748b', '#a16207', '#0f766e',
]

let btn   = null
let panel = null

export function initColorPicker() {
  if (document.getElementById('color-btn')) return  // already in DOM
  _build()
  _updateBtn()
}

function _build() {
  // ── Button ──────────────────────────────────────────────
  btn = document.createElement('button')
  btn.type      = 'button'
  btn.id        = 'color-btn'
  btn.title     = 'เลือกสีข้อความ'
  btn.innerHTML = `<span id="color-dot"></span>`

  // ── Swatch panel ────────────────────────────────────────
  panel = document.createElement('div')
  panel.id        = 'color-panel'
  panel.className = 'color-panel hidden'

  // Default (reset) chip
  const resetEl = document.createElement('button')
  resetEl.type      = 'button'
  resetEl.className = 'color-swatch color-swatch-reset'
  resetEl.title     = 'ค่าเริ่มต้น'
  resetEl.textContent = 'A'
  resetEl.addEventListener('click', () => _pick(''))
  panel.appendChild(resetEl)

  // Preset swatches
  for (const hex of PRESETS) {
    const sw = document.createElement('button')
    sw.type      = 'button'
    sw.className = 'color-swatch'
    sw.title     = hex
    sw.style.background = hex
    sw.addEventListener('click', () => _pick(hex))
    panel.appendChild(sw)
  }

  // Custom color input
  const customWrap = document.createElement('label')
  customWrap.className = 'color-swatch color-swatch-custom'
  customWrap.title = 'เลือกสีเอง'
  customWrap.textContent = '＋'
  const nativeInput = document.createElement('input')
  nativeInput.type = 'color'
  nativeInput.value = '#6366f1'
  nativeInput.addEventListener('input',  e => _pick(e.target.value))
  nativeInput.addEventListener('change', e => _pick(e.target.value))
  customWrap.appendChild(nativeInput)
  panel.appendChild(customWrap)

  // Panel lives in body so position:fixed works correctly
  document.body.appendChild(panel)

  // Insert button into form before send button
  const form    = document.getElementById('message-form')
  const sendBtn = document.getElementById('send-btn')
  form.insertBefore(btn, sendBtn)

  // Toggle panel on btn click
  btn.addEventListener('click', e => {
    e.stopPropagation()
    const isHidden = panel.classList.contains('hidden')
    panel.classList.toggle('hidden')
    if (isHidden) {
      // Position fixed: align bottom of panel to top of button, right-align
      const r = btn.getBoundingClientRect()
      panel.style.bottom = `${window.innerHeight - r.top + 8}px`
      panel.style.right  = `${window.innerWidth  - r.right}px`
      panel.style.left   = 'auto'
      panel.style.top    = 'auto'
    }
    _updateChecks()
  })

  // Close when clicking outside
  document.addEventListener('click', () => panel.classList.add('hidden'))
  panel.addEventListener('click', e => e.stopPropagation())
}

function _pick(hex) {
  state.myColor = hex
  _updateBtn()
  _updateChecks()
  panel.classList.add('hidden')
}

function _updateBtn() {
  const dot = document.getElementById('color-dot')
  if (!dot) return
  if (state.myColor) {
    dot.style.background = state.myColor
    dot.style.border     = 'none'
  } else {
    dot.style.background = 'transparent'
    dot.style.border     = '2px solid var(--text-muted)'
  }
}

function _updateChecks() {
  panel.querySelectorAll('.color-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.style.background
      ? sw.style.background === _hexToRgb(state.myColor) || sw.title === state.myColor
      : !state.myColor)
  })
}

// CSS rgb(...) vs hex comparison helper
function _hexToRgb(hex) {
  if (!hex) return ''
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgb(${r}, ${g}, ${b})`
}
