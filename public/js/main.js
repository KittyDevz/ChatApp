import { state }              from './state.js'
import { connect, send }      from './ws.js'
import { showOverlay, hideOverlay } from './ui/overlay.js'
import { showError, setJoinLoading, resetLoginForm, nicknameInput, adminkeyInput } from './ui/login.js'

// ── Screen helpers ────────────────────────────────────────
const loginScreen  = document.getElementById('login-screen')
const chatScreen   = document.getElementById('chat-screen')
const messageInput = document.getElementById('message-input')
const sendBtn      = document.getElementById('send-btn')

const showChat  = () => { loginScreen.classList.add('hidden');    chatScreen.classList.remove('hidden') }
const showLogin = () => { chatScreen.classList.add('hidden');  loginScreen.classList.remove('hidden') }

// ── Login ─────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault()
  const name     = nicknameInput.value.trim()
  const adminKey = adminkeyInput.value.trim()
  if (!name) { nicknameInput.focus(); return }

  showError('')
  setJoinLoading(true)

  // Pre-flight check
  try {
    const res  = await fetch(`/api/check?username=${encodeURIComponent(name)}`)
    const data = await res.json()
    if (!res.ok) {
      const msgs = {
        banned: 'ชื่อนี้ถูกแบน ไม่สามารถเข้าร่วมได้',
        taken:  'ชื่อนี้มีคนใช้อยู่แล้ว กรุณาเลือกชื่ออื่น',
      }
      showError(msgs[data.error] ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่')
      setJoinLoading(false)
      return
    }
  } catch {
    showError('เชื่อมต่อ server ไม่ได้ กรุณาลองใหม่')
    setJoinLoading(false)
    return
  }

  state.myName = name

  connect({
    name, adminKey,
    onOpen() {
      showChat()
      setJoinLoading(false)
      messageInput.focus()
    },
    onClose() {
      returnToLogin()
    },
  })
})

// ── Kicked / Banned events (dispatched by ws.js) ──────────
document.addEventListener('chat:kicked', () => {
  showOverlay('⚡', 'ถูกเตะออกจากห้อง', 'Admin ได้เตะคุณออก กำลังกลับไปหน้าหลัก...')
  setTimeout(() => { hideOverlay(); returnToLogin() }, 3000)
})

document.addEventListener('chat:banned', () => {
  showOverlay('🚫', 'ถูกแบน', 'Admin ได้แบนชื่อของคุณออกจากห้องแชทนี้')
  setTimeout(() => { hideOverlay(); returnToLogin() }, 4000)
})

// ── Message form ──────────────────────────────────────────
messageInput.addEventListener('input', () => {
  sendBtn.disabled = messageInput.value.trim() === ''
  send({ type: messageInput.value ? 'typing' : 'stop_typing' })
})

document.getElementById('message-form').addEventListener('submit', e => {
  e.preventDefault()
  const text = messageInput.value.trim()
  if (!text) return
  send({ type: 'message', text })
  messageInput.value = ''
  sendBtn.disabled = true
  send({ type: 'stop_typing' })
  messageInput.focus()
})

messageInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    document.getElementById('message-form').requestSubmit()
  }
})

// ── Leave ─────────────────────────────────────────────────
document.getElementById('leave-btn').addEventListener('click', returnToLogin)

function returnToLogin() {
  hideOverlay()
  state.leavingIntentionally = true
  if (state.ws) { state.ws.close(); state.ws = null }
  state.myIsAdmin = false
  showLogin()
  resetLoginForm()
  nicknameInput.focus()
}
