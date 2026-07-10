/**
 * ChatBot — server-side virtual chat member
 *
 * Features
 * ─────────
 * • Welcome message for every new user
 * • User commands  : !help  !promo  !social  !play  !np  !queue
 * • DJ commands    : !skip
 * • Admin commands : !addcmd  !delcmd  !listcmd
 *                    !announce add|del|list|interval|on|off
 *                    !setwelcome  !boton  !botoff
 *                    !dj add|remove|list  !stop  !clearqueue
 * • Music control rights: Admin always has them; grant to others with !dj add
 * • Rotating announcements on a configurable interval
 *
 * Config via env
 * ──────────────
 * BOT_NAME                  — display name         (default: "ChatBot")
 * BOT_ANNOUNCE_INTERVAL     — interval in minutes  (default: 5)
 */

import { bots, members, djUsers, getMember } from './state'
import { broadcastAll, sendToAdmins } from './broadcast'
import { addToQueue, skipTrack, stopMusic, clearQueue, getMusicState, extractVideoId, searchYouTube, getAutoplay, setAutoplay } from './music'

// ── Bot identity ──────────────────────────────────────────
const USERNAME = process.env.BOT_NAME ?? 'ChatBot'

// ── Mutable runtime state ─────────────────────────────────
let active          = true
let welcomeTemplate = 'ยินดีต้อนรับ @{name} สู่ห้องแชท! 🎉  พิมพ์ !help เพื่อดูคำสั่ง'

// ── Profanity filter ───────────────────────────────────────
let filterActive = false
const badWords   = new Set<string>()

/** Replace bad words with *** in a message. Returns text unchanged when filter is off. */
export function filterMessage(text: string): string {
  if (!filterActive || !badWords.size) return text
  let out = text
  for (const word of badWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(escaped, 'gi'), m => '*'.repeat(m.length))
  }
  return out
}

/** User-facing commands: key → response text */
const commands = new Map<string, string>([
  ['!promo',  '🛒 ยังไม่มีโปรโมชั่น — Admin ตั้งค่าด้วย: !addcmd !promo ข้อความ'],
  ['!social', '📱 ยังไม่ได้ตั้งค่า — Admin ตั้งค่าด้วย: !addcmd !social ข้อความ'],
])

const announcements: string[] = [
  '📣 ยินดีต้อนรับทุกคน! พิมพ์ !help เพื่อดูคำสั่งที่ใช้ได้ในห้องนี้',
]

let announceInterval = Number(process.env.BOT_ANNOUNCE_INTERVAL ?? 5) * 60_000
let announceIndex    = 0
let announceTimer: ReturnType<typeof setInterval> | null = null

// ── Internal helpers ──────────────────────────────────────

function send(text: string): void {
  broadcastAll({
    type:     'message',
    username: USERNAME,
    isAdmin:  false,
    isBot:    true,
    text,
    at: new Date().toISOString(),
  })
}

/** Send with a short natural delay */
function reply(text: string, delay = 650): void {
  setTimeout(() => { if (active) send(text) }, delay)
}

// ── Public API ────────────────────────────────────────────

/** Greet a user who just joined */
export function welcomeUser(username: string): void {
  if (!active) return
  reply(welcomeTemplate.replace('{name}', username))
}

/**
 * Process a chat message for commands.
 * Call this after broadcasting the original message.
 */
export function handleCommand(text: string, username: string, isAdmin: boolean): void {
  if (!text.startsWith('!')) return

  const parts = text.trim().split(/\s+/)
  const cmd   = parts[0].toLowerCase()

  // ── !boton works even when bot is off ─────────────────
  if (isAdmin && cmd === '!boton') {
    active = true
    send('✅ บอทพร้อมใช้งาน! พิมพ์ !help เพื่อดูคำสั่ง')
    return
  }

  if (!active) return   // bot is disabled — ignore everything else

  // Check if user has music-control rights (computed once, used below)
  const canControl = isAdmin || djUsers.has(username.toLowerCase())

  // ── Admin-only commands ───────────────────────────────
  if (isAdmin) {
    switch (cmd) {

      case '!addcmd': {
        const key  = parts[1]?.toLowerCase()
        const resp = parts.slice(2).join(' ')
        if (!key?.startsWith('!') || !resp) {
          reply('❌ รูปแบบ: !addcmd !คำสั่ง ข้อความตอบกลับ')
          return
        }
        commands.set(key, resp)
        reply(`✅ ${commands.has(key) ? 'แก้ไข' : 'เพิ่ม'}คำสั่ง ${key} แล้ว`)
        return
      }

      case '!delcmd': {
        const key = parts[1]?.toLowerCase()
        if (!key || !commands.has(key)) {
          reply(`❌ ไม่พบคำสั่ง ${key ?? '(ไม่ระบุ)'}`)
          return
        }
        commands.delete(key)
        reply(`🗑️ ลบคำสั่ง ${key} แล้ว`)
        return
      }

      case '!listcmd': {
        const list = ['!help', ...commands.keys()].join('  ')
        reply(`📋 คำสั่งทั้งหมด: ${list}`)
        return
      }

      case '!announce': {
        const sub = parts[1]?.toLowerCase()
        if (sub === 'add') {
          const msg = parts.slice(2).join(' ')
          if (!msg) { reply('❌ รูปแบบ: !announce add ข้อความ'); return }
          announcements.push(msg)
          reply(`✅ เพิ่มประกาศ #${announcements.length}: "${msg}"`)
        } else if (sub === 'del') {
          const idx = Number(parts[2]) - 1
          if (isNaN(idx) || idx < 0 || idx >= announcements.length) {
            reply(`❌ ไม่พบประกาศที่ ${parts[2] ?? '?'}`)
            return
          }
          const [removed] = announcements.splice(idx, 1)
          reply(`🗑️ ลบประกาศที่ ${idx + 1}: "${removed}"`)
        } else if (sub === 'list') {
          if (!announcements.length) { reply('📋 ยังไม่มีข้อความประกาศ'); return }
          reply('📋 รายการประกาศ:\n' + announcements.map((a, i) => `${i + 1}. ${a}`).join('\n'))
        } else if (sub === 'interval') {
          const mins = Number(parts[2])
          if (!mins || mins <= 0) { reply('❌ รูปแบบ: !announce interval <นาที>'); return }
          announceInterval = mins * 60_000
          restartAnnounceTimer()
          reply(`⏱️ ตั้งเวลาประกาศทุก ${mins} นาทีแล้ว`)
        } else if (sub === 'on') {
          startAnnounceTimer()
          reply('✅ เปิดระบบประกาศอัตโนมัติแล้ว')
        } else if (sub === 'off') {
          stopAnnounceTimer()
          reply('⛔ ปิดระบบประกาศอัตโนมัติแล้ว')
        } else {
          reply('📖 !announce  add <ข้อความ> | del <เลข> | list | interval <นาที> | on | off')
        }
        return
      }

      case '!setwelcome': {
        const msg = parts.slice(1).join(' ')
        if (!msg) { reply('❌ รูปแบบ: !setwelcome ข้อความ  (ใช้ {name} แทนชื่อผู้ใช้)'); return }
        welcomeTemplate = msg
        reply(`✅ ตั้งข้อความต้อนรับใหม่แล้ว  ตัวอย่าง: "${msg.replace('{name}', 'ผู้ใช้')}"`)
        return
      }

      case '!botoff': {
        send('⛔ บอทปิดการใช้งานแล้ว  (Admin ใช้ !boton เพื่อเปิดใหม่)')
        active = false
        return
      }

      // ── DJ management ─────────────────────────────────
      case '!dj': {
        const sub    = parts[1]?.toLowerCase()
        const target = parts[2]?.trim()
        if (sub === 'add' && target) {
          djUsers.add(target.toLowerCase())
          reply(`🎧 ${target} ได้รับสิทธิ์ DJ แล้ว (ควบคุมเพลงได้)`)
          const m = getMember(target)
          if (m && !m.isAdmin) m.ws.send(JSON.stringify({ type: 'dj_update', isDJ: true }))
        } else if (sub === 'remove' && target) {
          djUsers.delete(target.toLowerCase())
          reply(`🗑️ ถอนสิทธิ์ DJ ของ ${target} แล้ว`)
          const m = getMember(target)
          if (m && !m.isAdmin) m.ws.send(JSON.stringify({ type: 'dj_update', isDJ: false }))
        } else if (sub === 'list') {
          if (!djUsers.size) { reply('🎧 ยังไม่มี DJ'); return }
          reply(`🎧 DJ ปัจจุบัน: ${[...djUsers].join(', ')}`)
        } else {
          reply('📖 !dj  add <ชื่อ> | remove <ชื่อ> | list')
        }
        return
      }

      case '!stop':       { stopMusic();  reply('⏹ หยุดเพลงแล้ว');     return }
      case '!clearqueue': { clearQueue(); reply('🗑 ล้างคิวเพลงแล้ว'); return }

      case '!autoplay': {
        const sub = parts[1]?.toLowerCase()
        let on: boolean
        if      (sub === 'on')  on = true
        else if (sub === 'off') on = false
        else                    on = !getAutoplay()   // toggle
        setAutoplay(on)
        reply(on
          ? '🔀 เปิด AutoPlay แล้ว — สุ่มเพลงจาก YouTube ต่อเรื่อยๆ'
          : '⏹ ปิด AutoPlay แล้ว')
        return
      }

      // ── Profanity filter ───────────────────────────────
      case '!filter': {
        const sub  = parts[1]?.toLowerCase()
        const word = parts.slice(2).join(' ').toLowerCase().trim()
        if (sub === 'add' && word) {
          badWords.add(word)
          reply(`✅ เพิ่มคำต้องห้าม "${word}" แล้ว (รวม ${badWords.size} คำ)`)
        } else if (sub === 'remove' && word) {
          const ok = badWords.delete(word)
          reply(ok ? `🗑️ ลบคำต้องห้าม "${word}" แล้ว` : `❌ ไม่พบคำ "${word}"`)
        } else if (sub === 'list') {
          if (!badWords.size) { reply('📋 ยังไม่มีคำต้องห้าม'); return }
          reply(`📋 คำต้องห้าม (${badWords.size}): ${[...badWords].join(', ')}`)
        } else if (sub === 'on') {
          filterActive = true
          reply(`✅ เปิดระบบกรองคำหยาบแล้ว (${badWords.size} คำ)`)
        } else if (sub === 'off') {
          filterActive = false
          reply('⛔ ปิดระบบกรองคำหยาบแล้ว')
        } else if (sub === 'clear') {
          badWords.clear()
          reply('🗑️ ล้างคำต้องห้ามทั้งหมดแล้ว')
        } else {
          reply(`📖 !filter  add <คำ> | remove <คำ> | list | clear | on | off\n🔒 สถานะ: ${filterActive ? 'เปิด' : 'ปิด'} | ${badWords.size} คำ`)
        }
        return
      }
    }
  }

  // ── Music commands (open to all, some gated by canControl) ──

  switch (cmd) {

    case '!play': {
      const input = parts.slice(1).join(' ')
      if (!input) {
        reply('❌ ระบุ URL หรือชื่อเพลง เช่น !play never gonna give you up')
        return
      }

      // Direct URL / raw video ID → fast path
      const directId = extractVideoId(input)
      if (directId) {
        addToQueue(directId, username)
        reply(`🎵 เพิ่มเพลงเข้าคิวแล้ว! (ขอโดย ${username})`)
        return
      }

      // Search by name
      reply(`🔍 กำลังค้นหา "${input}"...`)
      searchYouTube(input).then(videoId => {
        if (!active) return
        if (!videoId) { reply(`❌ ไม่พบเพลง "${input}"`); return }
        addToQueue(videoId, username)
        reply(`🎵 เพิ่มเพลงเข้าคิวแล้ว! (ขอโดย ${username})`)
      }).catch(() => reply('❌ เกิดข้อผิดพลาดขณะค้นหา'))
      return
    }

    case '!skip': {
      if (!canControl) {
        reply('❌ เฉพาะ Admin หรือ DJ เท่านั้นที่ข้ามเพลงได้  (Admin ใช้ !dj add ชื่อ เพื่อมอบสิทธิ์)')
        return
      }
      const ok = skipTrack()
      reply(ok ? '⏭ ข้ามเพลงแล้ว' : '⏭ ไม่มีเพลงถัดไปในคิว')
      return
    }

    case '!np': {
      const ms = getMusicState()
      if (!ms.videoId) { reply('🔇 ไม่มีเพลงที่กำลังเล่นอยู่'); return }
      reply(`${ms.playing ? '▶' : '⏸'} กำลังเล่น: ${ms.title}  (ขอโดย ${ms.by})`)
      return
    }

    case '!queue': {
      const ms = getMusicState()
      if (!ms.queue.length) { reply('📋 คิวเพลงว่างเปล่า  ใช้ !play <url หรือชื่อ> เพื่อเพิ่ม'); return }
      const list = ms.queue.map((t, i) =>
        `${i === ms.queueIndex ? '▶' : i + 1 + '.'} ${t.title}  (${t.by})`
      ).join('\n')
      reply(`🎵 คิวเพลง (${ms.queue.length}):\n${list}`)
      return
    }
  }

  // ── User commands ──────────────────────────────────────

  if (cmd === '!help') {
    const userList  = ['!help', '!play <url/ชื่อเพลง>', '!np', '!queue', ...commands.keys()].join('  ')
    const djHint    = canControl && !isAdmin ? '\n🎧 DJ: !skip' : ''
    const adminHint = isAdmin
      ? '\n🔧 Admin: !addcmd  !delcmd  !listcmd  !announce  !setwelcome  !dj  !filter  !autoplay  !stop  !clearqueue  !skip  !boton  !botoff'
      : ''
    reply(`📋 คำสั่งที่ใช้ได้:\n${userList}${djHint}${adminHint}`)
    return
  }

  const resp = commands.get(cmd)
  if (resp !== undefined) reply(resp)
}

// ── Announcement timer ────────────────────────────────────

function startAnnounceTimer(): void {
  if (announceTimer) return
  announceTimer = setInterval(() => {
    if (!active || !announcements.length || members.size === 0) return
    send(announcements[announceIndex % announcements.length]!)
    announceIndex++
  }, announceInterval)
}

function stopAnnounceTimer(): void {
  if (!announceTimer) return
  clearInterval(announceTimer)
  announceTimer = null
}

function restartAnnounceTimer(): void {
  stopAnnounceTimer()
  startAnnounceTimer()
}

// ── Public state API (for admin panel) ───────────────────

export interface BotState {
  active:               boolean
  welcomeTemplate:      string
  commands:             { cmd: string; response: string }[]
  announcements:        string[]
  announceIntervalMins: number
  announceRunning:      boolean
  filterActive:         boolean
  badWords:             string[]
}

export function getBotState(): BotState {
  return {
    active,
    welcomeTemplate,
    commands:             [...commands.entries()].map(([cmd, response]) => ({ cmd, response })),
    announcements:        [...announcements],
    announceIntervalMins: announceInterval / 60_000,
    announceRunning:      announceTimer !== null,
    filterActive,
    badWords:             [...badWords],
  }
}

/** Notify all connected admins of the current bot state */
export function notifyAdmins(): void {
  sendToAdmins({ type: 'bot_state', ...getBotState() })
}

/**
 * Apply a config action sent from the admin panel.
 */
export function applyBotConfig(action: string, data: Record<string, unknown>): void {
  switch (action) {

    case 'set_active':
      if (data.value === true && !active) {
        active = true
        send('✅ บอทพร้อมใช้งานแล้ว!')
      } else if (data.value === false && active) {
        send('⛔ บอทปิดการใช้งานแล้ว')
        active = false
      }
      break

    case 'set_welcome':
      if (typeof data.text === 'string' && data.text.trim()) {
        welcomeTemplate = data.text.trim()
      }
      break

    case 'add_command': {
      const cmd  = String(data.cmd  ?? '').trim().toLowerCase()
      const resp = String(data.resp ?? '').trim()
      if (cmd.startsWith('!') && resp) commands.set(cmd, resp)
      break
    }

    case 'del_command': {
      const cmd = String(data.cmd ?? '').trim().toLowerCase()
      commands.delete(cmd)
      break
    }

    case 'set_announcements': {
      if (!Array.isArray(data.list)) break
      announcements.length = 0
      for (const a of data.list) {
        if (typeof a === 'string' && a.trim()) announcements.push(a.trim())
      }
      break
    }

    case 'set_interval': {
      const mins = Number(data.mins)
      if (mins > 0) {
        announceInterval = mins * 60_000
        restartAnnounceTimer()
      }
      break
    }

    case 'set_announce_running':
      if (data.value === true)  restartAnnounceTimer()
      if (data.value === false) stopAnnounceTimer()
      break

    case 'test_announce':
      if (announcements.length) {
        send(announcements[announceIndex % announcements.length]!)
        announceIndex++
      }
      break
  }

  notifyAdmins()
}

// ── Init ──────────────────────────────────────────────────

export function initBot(): void {
  bots.add({ username: USERNAME, isAdmin: false, isBot: true })
  startAnnounceTimer()
  console.log(`🤖 Bot "${USERNAME}" online  (announce every ${announceInterval / 60_000} min)`)
}
