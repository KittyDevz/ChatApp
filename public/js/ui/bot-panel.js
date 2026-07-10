/**
 * bot-panel.js — Admin-only right-click bot settings panel
 *
 * Features
 * ─────────
 * • Right-click a bot entry in the sidebar → context menu
 * • Context menu → "⚙️ ตั้งค่าบอท" → opens 3-tab modal
 *   Tab 1: General  (on/off toggle, welcome message)
 *   Tab 2: Commands (add / delete custom commands)
 *   Tab 3: Announcements (add / delete, interval, on/off)
 */

import { state }                from '../state.js'
import { send }                 from '../ws.js'
import { getCurrentMusicState } from './music-player.js'

// ── State ──────────────────────────────────────────────────
let botState = null   // filled by onBotState()

// ── DOM refs (created once) ───────────────────────────────
let ctxMenu  = null
let modal    = null

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

/** Call once after #chat-screen is visible */
export function initBotPanel() {
  _buildContextMenu()
  _buildModal()

  // Right-click anywhere in the user list
  document.getElementById('user-list').addEventListener('contextmenu', e => {
    if (!state.myIsAdmin) return
    const li = e.target.closest('li[data-isbot="true"]')
    if (!li) return
    e.preventDefault()
    e.stopPropagation()   // prevent document contextmenu from immediately hiding it
    _showCtxMenu(e.clientX, e.clientY)
  })

  // Hide context menu on outside click
  document.addEventListener('click',       _hideCtxMenu)
  document.addEventListener('contextmenu', _hideCtxMenu)
}

/** Receive a bot_state payload and refresh the panel if open */
export function onBotState(payload) {
  botState = payload
  if (modal && !modal.classList.contains('hidden')) _populateModal()
}

// ─────────────────────────────────────────────────────────
// Context menu
// ─────────────────────────────────────────────────────────

function _buildContextMenu() {
  ctxMenu = document.createElement('div')
  ctxMenu.className = 'bot-ctx-menu hidden'
  ctxMenu.innerHTML = `
    <button class="ctx-item" id="ctx-bot-settings">
      <span>⚙️</span> ตั้งค่าบอท
    </button>
    <div class="ctx-sep"></div>
    <div class="ctx-section-label">🎵 ควบคุมเพลง</div>
    <button class="ctx-item ctx-music-item" id="ctx-music-pp">
      <span id="ctx-pp-icon">⏸</span>
      <span id="ctx-pp-text">หยุดชั่วคราว</span>
    </button>
    <button class="ctx-item ctx-music-item" id="ctx-music-skip">
      <span>⏭</span> ข้ามเพลง
    </button>
    <button class="ctx-item ctx-music-item" id="ctx-music-stop">
      <span>⏹</span> หยุดเพลง
    </button>
    <button class="ctx-item ctx-music-item" id="ctx-music-clear">
      <span>🗑</span> ล้างคิวเพลง
    </button>
    <button class="ctx-item" id="ctx-music-queue">
      <span>📋</span> จัดการคิวเพลง
    </button>
    <div id="ctx-no-music" class="ctx-empty-label">ไม่มีเพลงกำลังเล่น</div>
  `
  document.body.appendChild(ctxMenu)
  // Stop right-click inside the menu from hiding it
  ctxMenu.addEventListener('contextmenu', e => e.stopPropagation())

  document.getElementById('ctx-bot-settings').addEventListener('click', () => {
    _hideCtxMenu(); _openModal()
  })
  document.getElementById('ctx-music-pp').addEventListener('click', () => {
    _hideCtxMenu(); send({ type: 'music_cmd', action: 'toggle' })
  })
  document.getElementById('ctx-music-skip').addEventListener('click', () => {
    _hideCtxMenu(); send({ type: 'music_cmd', action: 'skip' })
  })
  document.getElementById('ctx-music-stop').addEventListener('click', () => {
    _hideCtxMenu(); send({ type: 'message', text: '!stop', color: '' })
  })
  document.getElementById('ctx-music-clear').addEventListener('click', () => {
    _hideCtxMenu(); send({ type: 'message', text: '!clearqueue', color: '' })
  })
  document.getElementById('ctx-music-queue').addEventListener('click', () => {
    _hideCtxMenu()
    const panel = document.getElementById('music-queue-panel')
    const btn   = document.getElementById('music-queue-btn')
    if (!panel) return
    const open = !panel.classList.contains('hidden')
    panel.classList.toggle('hidden', open)
    btn?.classList.toggle('active', !open)
    if (!open) document.dispatchEvent(new CustomEvent('music:openQueue'))
  })
}

/** Show the music-control context menu without the bot-settings button.
 *  Called when admin/DJ right-clicks a bot chat message. */
export function showMusicCtxMenu(x, y) {
  if (!ctxMenu) return
  _updateMusicItems()
  // Hide settings button in this context
  document.getElementById('ctx-bot-settings').style.display = 'none'
  document.querySelector('#bot-panel-ctx .ctx-sep')?.remove()  // no-op fallback
  ctxMenu.classList.remove('hidden')
  _positionMenu(x, y)
}

function _positionMenu(x, y) {
  ctxMenu.classList.remove('hidden')
  const vw = window.innerWidth, vh = window.innerHeight
  const w  = 190, h = ctxMenu.offsetHeight || 220
  ctxMenu.style.left = `${Math.min(x, vw - w - 8)}px`
  ctxMenu.style.top  = `${Math.min(y, vh - h - 8)}px`
}

function _updateMusicItems() {
  const ms       = getCurrentMusicState()
  const hasMusic = !!ms?.videoId

  document.querySelectorAll('.ctx-music-item').forEach(el => {
    el.style.display = hasMusic ? '' : 'none'
  })
  const noMusicEl = document.getElementById('ctx-no-music')
  if (noMusicEl) noMusicEl.style.display = hasMusic ? 'none' : ''

  if (hasMusic) {
    const ppIcon = document.getElementById('ctx-pp-icon')
    const ppText = document.getElementById('ctx-pp-text')
    if (ppIcon) ppIcon.textContent = ms.playing ? '⏸' : '▶'
    if (ppText) ppText.textContent = ms.playing ? 'หยุดชั่วคราว' : 'เล่นต่อ'
  }
}

function _showCtxMenu(x, y) {
  // Full menu — restore settings button
  document.getElementById('ctx-bot-settings').style.display = ''
  _updateMusicItems()
  _positionMenu(x, y)
}

function _hideCtxMenu() {
  ctxMenu?.classList.add('hidden')
}

// ─────────────────────────────────────────────────────────
// Modal scaffold
// ─────────────────────────────────────────────────────────

function _buildModal() {
  modal = document.createElement('div')
  modal.className = 'bot-modal-overlay hidden'
  modal.innerHTML = `
    <div class="bot-modal">
      <div class="bot-modal-header">
        <span class="bot-modal-title">🤖 ตั้งค่าบอท</span>
        <button class="bot-modal-close" id="bot-modal-close">✕</button>
      </div>

      <div class="bot-tabs">
        <button class="bot-tab active" data-tab="general">ทั่วไป</button>
        <button class="bot-tab"        data-tab="commands">คำสั่ง</button>
        <button class="bot-tab"        data-tab="announce">ประกาศ</button>
      </div>

      <!-- General -->
      <div class="bot-tab-pane active" id="tab-general">
        <div class="bp-row bp-toggle-row">
          <span class="bp-label">สถานะบอท</span>
          <label class="bp-switch">
            <input type="checkbox" id="bp-active">
            <span class="bp-slider"></span>
          </label>
        </div>
        <div class="bp-field">
          <label class="bp-label">ข้อความต้อนรับ</label>
          <textarea id="bp-welcome" rows="3" placeholder="ยินดีต้อนรับ @{name}! ใช้ {name} แทนชื่อผู้ใช้"></textarea>
          <button class="bp-btn bp-btn-primary" id="bp-save-welcome">บันทึก</button>
        </div>
      </div>

      <!-- Commands -->
      <div class="bot-tab-pane" id="tab-commands">
        <div class="bp-add-row">
          <input type="text" id="bp-cmd-key"  placeholder="!คำสั่ง" />
          <input type="text" id="bp-cmd-resp" placeholder="ข้อความตอบกลับ" />
          <button class="bp-btn bp-btn-primary" id="bp-add-cmd">เพิ่ม</button>
        </div>
        <ul class="bp-list" id="bp-cmd-list"></ul>
      </div>

      <!-- Announcements -->
      <div class="bot-tab-pane" id="tab-announce">
        <div class="bp-row bp-toggle-row">
          <span class="bp-label">ประกาศอัตโนมัติ</span>
          <label class="bp-switch">
            <input type="checkbox" id="bp-announce-running">
            <span class="bp-slider"></span>
          </label>
        </div>
        <div class="bp-row bp-interval-row">
          <span class="bp-label">ทุก</span>
          <input type="number" id="bp-interval" min="1" max="120" />
          <span class="bp-label">นาที</span>
          <button class="bp-btn bp-btn-sm" id="bp-save-interval">ตั้ง</button>
        </div>
        <div class="bp-add-row">
          <input type="text" id="bp-ann-text" placeholder="ข้อความประกาศ" />
          <button class="bp-btn bp-btn-primary" id="bp-add-ann">เพิ่ม</button>
        </div>
        <ul class="bp-list" id="bp-ann-list"></ul>
        <button class="bp-btn bp-btn-test" id="bp-test-ann" title="ส่งประกาศปัจจุบันทันที">▶ ส่งทันที</button>
      </div>
    </div>
  `
  document.body.appendChild(modal)

  // Close button
  document.getElementById('bot-modal-close').addEventListener('click', _closeModal)
  modal.addEventListener('click', e => { if (e.target === modal) _closeModal() })

  // Tabs
  modal.querySelectorAll('.bot-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.bot-tab, .bot-tab-pane').forEach(el => el.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active')
    })
  })

  // ── General tab ─────────────────────────────────────────
  document.getElementById('bp-active').addEventListener('change', e => {
    _cfg('set_active', { value: e.target.checked })
  })

  document.getElementById('bp-save-welcome').addEventListener('click', () => {
    const text = document.getElementById('bp-welcome').value.trim()
    if (text) _cfg('set_welcome', { text })
  })

  // ── Commands tab ────────────────────────────────────────
  document.getElementById('bp-add-cmd').addEventListener('click', () => {
    let cmd  = document.getElementById('bp-cmd-key').value.trim().toLowerCase()
    const resp = document.getElementById('bp-cmd-resp').value.trim()
    if (!cmd || !resp) return
    if (!cmd.startsWith('!')) cmd = '!' + cmd
    _cfg('add_command', { cmd, resp })
    document.getElementById('bp-cmd-key').value  = ''
    document.getElementById('bp-cmd-resp').value = ''
  })

  // Enter key in command inputs
  ;['bp-cmd-key','bp-cmd-resp'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('bp-add-cmd').click()
    })
  })

  // ── Announcements tab ───────────────────────────────────
  document.getElementById('bp-announce-running').addEventListener('change', e => {
    _cfg('set_announce_running', { value: e.target.checked })
  })

  document.getElementById('bp-save-interval').addEventListener('click', () => {
    const mins = Number(document.getElementById('bp-interval').value)
    if (mins > 0) _cfg('set_interval', { mins })
  })

  document.getElementById('bp-add-ann').addEventListener('click', () => {
    const text = document.getElementById('bp-ann-text').value.trim()
    if (!text) return
    const list = [...(botState?.announcements ?? []), text]
    _cfg('set_announcements', { list })
    document.getElementById('bp-ann-text').value = ''
  })

  document.getElementById('bp-ann-text').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('bp-add-ann').click()
  })

  document.getElementById('bp-test-ann').addEventListener('click', () => {
    _cfg('test_announce', {})
  })
}

// ─────────────────────────────────────────────────────────
// Modal open / populate / close
// ─────────────────────────────────────────────────────────

function _openModal() {
  modal.classList.remove('hidden')
  _populateModal()
}

function _closeModal() {
  modal.classList.add('hidden')
}

function _populateModal() {
  if (!botState) return

  // General
  document.getElementById('bp-active').checked  = botState.active
  document.getElementById('bp-welcome').value    = botState.welcomeTemplate

  // Commands
  const cmdList = document.getElementById('bp-cmd-list')
  cmdList.innerHTML = ''
  for (const { cmd, response } of botState.commands) {
    cmdList.appendChild(_cmdItem(cmd, response))
  }

  // Announcements
  document.getElementById('bp-announce-running').checked = botState.announceRunning
  document.getElementById('bp-interval').value           = botState.announceIntervalMins

  const annList = document.getElementById('bp-ann-list')
  annList.innerHTML = ''
  botState.announcements.forEach((text, i) => {
    annList.appendChild(_annItem(text, i))
  })
}

// ─────────────────────────────────────────────────────────
// List-item builders
// ─────────────────────────────────────────────────────────

function _cmdItem(cmd, response) {
  const li = document.createElement('li')
  li.className = 'bp-item'
  li.innerHTML = `
    <span class="bp-item-key">${_esc(cmd)}</span>
    <span class="bp-item-val">${_esc(response)}</span>
    <button class="bp-del-btn" title="ลบ">✕</button>
  `
  li.querySelector('.bp-del-btn').addEventListener('click', () => {
    _cfg('del_command', { cmd })
  })
  return li
}

function _annItem(text, index) {
  const li = document.createElement('li')
  li.className = 'bp-item'
  li.innerHTML = `
    <span class="bp-item-num">${index + 1}.</span>
    <span class="bp-item-val">${_esc(text)}</span>
    <button class="bp-del-btn" title="ลบ">✕</button>
  `
  li.querySelector('.bp-del-btn').addEventListener('click', () => {
    const list = [...(botState?.announcements ?? [])]
    list.splice(index, 1)
    _cfg('set_announcements', { list })
  })
  return li
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function _cfg(action, data) {
  send({ type: 'bot_config', action, data })
}

function _esc(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
