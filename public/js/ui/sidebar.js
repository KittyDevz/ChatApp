import { state }      from '../state.js'
import { makeAvatar } from '../utils.js'

const onlineCountEl = document.getElementById('online-count')
const userListEl    = document.getElementById('user-list')
const bannedSection = document.getElementById('banned-section')
const bannedCountEl = document.getElementById('banned-count')
const bannedListEl  = document.getElementById('banned-list')

// ── Online users ──────────────────────────────────────────

/**
 * Re-render the online user list.
 * @param {Array<{username:string, isAdmin:boolean}>} users
 * @param {string[]|null} bannedArr  – null means "not an admin, don't show"
 * @param {function} sendFn          – ws.send wrapper for admin actions
 */
export function updateUserList(users, bannedArr, sendFn) {
  // Count only real users (not bots) for the online counter
  const realCount = users.filter(u => !u.isBot).length
  onlineCountEl.textContent = realCount
  userListEl.innerHTML = ''

  for (const { username, isAdmin, isBot } of users) {
    const li = document.createElement('li')
    li.dataset.username = username
    li.dataset.isbot    = isBot ? 'true' : 'false'
    if (isBot) li.classList.add('bot-entry')
    li.appendChild(makeAvatar(username, 20, isAdmin, isBot))

    // Name + badge (crown / robot)
    const wrap = document.createElement('div')
    wrap.className = 'user-name-wrap'
    const label = document.createElement('span')
    label.className = 'user-label' + (isBot ? ' glow-bot' : isAdmin ? ' glow-admin' : '')
    label.textContent = username === state.myName ? `${username} (คุณ)` : username
    wrap.appendChild(label)

    if (isBot) {
      const icon = document.createElement('span')
      icon.className = 'bot-icon'
      icon.textContent = '🤖'
      wrap.appendChild(icon)
    } else if (isAdmin) {
      const crown = document.createElement('span')
      crown.className = 'crown'
      crown.textContent = '👑'
      wrap.appendChild(crown)
    }
    li.appendChild(wrap)

    // Admin action buttons only for real non-admin users
    if (state.myIsAdmin && !isBot && username !== state.myName && !isAdmin) {
      li.appendChild(_makeActions(username, sendFn))
    }

    // Indicator dot
    const dot = document.createElement('span')
    dot.className = isBot ? 'bot-dot' : 'online-dot'
    li.appendChild(dot)

    userListEl.appendChild(li)
  }

  // Banned list (admin only)
  if (state.myIsAdmin && bannedArr !== null) {
    _updateBanned(bannedArr, sendFn)
  }
}

// ── Banned list ───────────────────────────────────────────

function _updateBanned(arr, sendFn) {
  bannedSection.classList.toggle('hidden', arr.length === 0)
  bannedCountEl.textContent = arr.length
  bannedListEl.innerHTML = ''

  for (const username of arr) {
    const li = document.createElement('li')
    li.appendChild(makeAvatar(username, 18))

    const nameEl = document.createElement('span')
    nameEl.className = 'banned-name'
    nameEl.textContent = username
    li.appendChild(nameEl)

    const unbanBtn = document.createElement('button')
    unbanBtn.className = 'unban-btn'
    unbanBtn.textContent = 'ปลดแบน'
    unbanBtn.addEventListener('click', () => sendFn({ type: 'unban', target: username }))
    li.appendChild(unbanBtn)

    bannedListEl.appendChild(li)
  }
}

// ── Kick / Ban buttons ────────────────────────────────────

function _makeActions(username, sendFn) {
  const wrap = document.createElement('div')
  wrap.className = 'user-actions'

  const kickBtn = document.createElement('button')
  kickBtn.className = 'action-btn kick'
  kickBtn.title     = 'เตะออก'
  kickBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>`
  kickBtn.addEventListener('click', () => sendFn({ type: 'kick', target: username }))

  const banBtn = document.createElement('button')
  banBtn.className = 'action-btn ban'
  banBtn.title     = 'แบน'
  banBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
  </svg>`
  banBtn.addEventListener('click', () => {
    if (!confirm(`แบน "${username}" จริงหรือไม่?\nผู้ใช้นี้จะไม่สามารถเข้าร่วมด้วยชื่อนี้ได้อีก`)) return
    sendFn({ type: 'ban', target: username })
  })

  wrap.append(kickBtn, banBtn)
  return wrap
}
