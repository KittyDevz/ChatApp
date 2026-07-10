import { state }              from './state.js'
import { connect, send }      from './ws.js'
import { showOverlay, hideOverlay } from './ui/overlay.js'
import { showError, setJoinLoading, resetLoginForm, nicknameInput, adminkeyInput } from './ui/login.js'
import { initBotPanel, onBotState, showMusicCtxMenu } from './ui/bot-panel.js'
import { initColorPicker }          from './ui/color-picker.js'
import { initEmojiPicker }          from './ui/emoji-picker.js'
import { initMusicPlayer, stopMusicPlayer } from './ui/music-player.js'

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
      try { initEmojiPicker()  } catch (e) { console.error('[init] emoji:', e) }
      try { initColorPicker()  } catch (e) { console.error('[init] color:', e) }
      try { initMusicPlayer()  } catch (e) { console.error('[init] music:', e) }
      try { if (adminKey) initBotPanel() } catch (e) { console.error('[init] bot:', e) }
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

document.addEventListener('chat:botState', e => onBotState(e.detail))

// ── Message form ──────────────────────────────────────────
messageInput.addEventListener('input', () => {
  sendBtn.disabled = messageInput.value.trim() === ''
  send({ type: messageInput.value ? 'typing' : 'stop_typing' })
})

document.getElementById('message-form').addEventListener('submit', e => {
  e.preventDefault()
  const text = messageInput.value.trim()
  if (!text) return
  send({ type: 'message', text, color: state.myColor })
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

// ── Right-click bot messages → music context menu ─────────
document.getElementById('messages').addEventListener('contextmenu', e => {
  if (!state.myIsAdmin && !state.myIsDJ) return
  const row = e.target.closest('.msg-row.is-bot')
  if (!row) return
  e.preventDefault()
  e.stopPropagation()
  showMusicCtxMenu(e.clientX, e.clientY)
})

// ── music:openQueue (triggered by "จัดการคิว" in ctx menu) ──
document.addEventListener('music:openQueue', () => {
  const panel = document.getElementById('music-queue-panel')
  const btn   = document.getElementById('music-queue-btn')
  if (!panel) return
  panel.classList.remove('hidden')
  btn?.classList.add('active')
})

// ── Leave ─────────────────────────────────────────────────
document.getElementById('leave-btn').addEventListener('click', returnToLogin)
document.getElementById('mobile-leave-btn').addEventListener('click', returnToLogin)

// ── Mobile sidebar toggle ─────────────────────────────────
const sidebar         = document.getElementById('sidebar')
const sidebarBackdrop = document.getElementById('sidebar-backdrop')

function openSidebar() {
  sidebar.classList.add('open')
  sidebarBackdrop.classList.remove('hidden')
}
function closeSidebar() {
  sidebar.classList.remove('open')
  sidebarBackdrop.classList.add('hidden')
}

document.getElementById('sidebar-toggle').addEventListener('click', () => {
  sidebar.classList.contains('open') ? closeSidebar() : openSidebar()
})
sidebarBackdrop.addEventListener('click', closeSidebar)

function returnToLogin() {
  stopMusicPlayer()          // stop YouTube audio before leaving
  hideOverlay()
  state.leavingIntentionally = true
  if (state.ws) { state.ws.close(); state.ws = null }
  state.myIsAdmin = false
  state.myIsDJ    = false
  showLogin()
  resetLoginForm()
  nicknameInput.focus()
}
