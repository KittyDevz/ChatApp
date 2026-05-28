import { state }              from '../state.js'
import { makeAvatar, colorFor, timeStr } from '../utils.js'

const messagesEl = document.getElementById('messages')
const typingBar  = document.getElementById('typing-bar')
const typingText = document.getElementById('typing-text')

// ── Messages ──────────────────────────────────────────────

export function appendSystem(text) {
  const el = document.createElement('div')
  el.className = 'msg-system'
  el.innerHTML = `<span>${text}</span>`
  messagesEl.appendChild(el)
  scrollBottom()
  state.lastSender = ''
}

export function appendMessage({ username, isAdmin, text, at }) {
  const ts = new Date(at).getTime()
  const isConsecutive = username === state.lastSender && (ts - state.lastTime) < 60_000

  const row = document.createElement('div')
  row.className = 'msg-row' + (isConsecutive ? ' consecutive' : '')

  // Avatar
  const avatarWrap = document.createElement('div')
  avatarWrap.className = 'msg-avatar'
  avatarWrap.appendChild(makeAvatar(username))

  // Body
  const body = document.createElement('div')
  body.className = 'msg-body'

  const meta = document.createElement('div')
  meta.className = 'msg-meta'

  const nameEl = document.createElement('span')
  nameEl.className = 'msg-name'
  nameEl.style.color = colorFor(username)
  nameEl.textContent = username + (username === state.myName ? ' (คุณ)' : '')
  meta.appendChild(nameEl)

  if (isAdmin) {
    const badge = document.createElement('span')
    badge.className = 'admin-badge'
    badge.textContent = 'ADMIN'
    meta.appendChild(badge)
  }

  const timeEl = document.createElement('span')
  timeEl.className = 'msg-time'
  timeEl.textContent = timeStr(at)
  meta.appendChild(timeEl)

  const textEl = document.createElement('div')
  textEl.className = 'msg-text'
  textEl.textContent = text

  body.append(meta, textEl)
  row.append(avatarWrap, body)
  messagesEl.appendChild(row)

  state.lastSender = username
  state.lastTime   = ts
  scrollBottom()
}

export function clearMessages() {
  messagesEl.innerHTML = ''
  state.lastSender = ''
  state.lastTime   = 0
}

// ── Typing indicator ──────────────────────────────────────

export function updateTypingBar(users) {
  const others = users.filter(u => u !== state.myName)
  if (!others.length) {
    typingBar.classList.add('hidden')
    return
  }
  typingText.textContent = others.length === 1
    ? `${others[0]} กำลังพิมพ์`
    : `${others.slice(0, -1).join(', ')} และ ${others.at(-1)} กำลังพิมพ์`
  typingBar.classList.remove('hidden')
}

// ── Scroll ────────────────────────────────────────────────

function scrollBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight
}
