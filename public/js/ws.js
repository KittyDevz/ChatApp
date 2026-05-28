import { state }              from './state.js'
import { appendSystem, appendMessage, updateTypingBar, clearMessages } from './ui/chat.js'
import { updateUserList }    from './ui/sidebar.js'
import { showOverlay, hideOverlay, isOverlayVisible } from './ui/overlay.js'

// ── Public API ────────────────────────────────────────────

/**
 * Open a new WebSocket connection.
 * @param {{ name:string, adminKey:string, onOpen:function, onClose:function }} opts
 */
export function connect({ name, adminKey, onOpen, onClose }) {
  state.leavingIntentionally = false   // fresh connection — reset flag

  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  let   url   = `${proto}://${location.host}/ws?username=${encodeURIComponent(name)}`
  if (adminKey) url += `&adminKey=${encodeURIComponent(adminKey)}`

  const ws = new WebSocket(url)
  state.ws = ws

  ws.addEventListener('open', () => {
    clearMessages()
    onOpen?.()
  })

  ws.addEventListener('message', e => {
    try { _route(JSON.parse(e.data)) } catch {}
  })

  ws.addEventListener('close', () => {
    if (state.leavingIntentionally) return   // intentional — nothing to do
    if (isOverlayVisible()) return            // kicked/banned overlay is showing
    onClose?.()
  })

  ws.addEventListener('error', () => onClose?.())
}

/** Send any object as JSON over the active WebSocket */
export function send(obj) {
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(obj))
  }
}

// ── Message router ────────────────────────────────────────

function _route(msg) {
  switch (msg.type) {

    case 'welcome':
      state.myIsAdmin = msg.isAdmin
      break

    case 'system':
      appendSystem(msg.text)
      break

    case 'message':
      appendMessage(msg)
      break

    case 'users':
      updateUserList(msg.users ?? [], msg.banned ?? null, send)
      break

    case 'typing':
      updateTypingBar(msg.users ?? [])
      break

    // ── Admin actions on this client ──────────────────────

    case 'kicked':
      // Signal main.js to handle the overlay + delayed redirect
      state.leavingIntentionally = true
      document.dispatchEvent(new CustomEvent('chat:kicked'))
      break

    case 'banned':
      state.leavingIntentionally = true
      document.dispatchEvent(new CustomEvent('chat:banned'))
      break
  }
}
