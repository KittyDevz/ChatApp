import type { ServerWebSocket } from 'bun'
import type { WSData }           from './types'
import { members, banned, typing, typingTimers, getMember, clearTyping, djUsers } from './state'
import { broadcastAll, sendUserList, broadcastTyping }                    from './broadcast'
import { welcomeUser, handleCommand, getBotState, applyBotConfig, filterMessage } from './bot'
import { getMusicState, handleTrackEnded, skipTrack, togglePlayPause, removeFromQueue, playTrackAt } from './music'

export const websocket = {

  open(ws: ServerWebSocket<WSData>): void {
    const { username, isAdmin } = ws.data
    members.add({ ws, username, isAdmin })

    const isDJ = !isAdmin && djUsers.has(username.toLowerCase())
    ws.send(JSON.stringify({ type: 'welcome', isAdmin, isDJ }))
    broadcastAll({ type: 'system', text: `${username} เข้าร่วมห้อง` })
    sendUserList()

    // Send current bot state to admin on join
    if (isAdmin) ws.send(JSON.stringify({ type: 'bot_state', ...getBotState() }))

    // Send current music state to all users on join
    ws.send(JSON.stringify(getMusicState()))

    welcomeUser(username)

    console.log(`[+] ${username}${isAdmin ? ' [ADMIN]' : ''} (${members.size} online)`)
  },

  message(ws: ServerWebSocket<WSData>, raw: string | Buffer): void {
    const { username, isAdmin } = ws.data

    let msg: Record<string, unknown>
    try { msg = JSON.parse(raw as string) } catch { return }

    const type = String(msg.type ?? '')

    // ── Typing ────────────────────────────────────────────
    if (type === 'typing') {
      typing.add(username)
      broadcastTyping()
      if (typingTimers.has(username)) clearTimeout(typingTimers.get(username)!)
      typingTimers.set(username, setTimeout(() => {
        clearTyping(username)
        broadcastTyping()
      }, 2000))
      return
    }

    if (type === 'stop_typing') {
      clearTyping(username)
      broadcastTyping()
      return
    }

    // ── Chat message ──────────────────────────────────────
    if (type === 'message') {
      const raw   = String(msg.text ?? '').trim().slice(0, 500)
      if (!raw) return
      clearTyping(username)
      broadcastTyping()
      // Apply profanity filter (commands starting with ! are passed through unfiltered)
      const text  = raw.startsWith('!') ? raw : filterMessage(raw)
      const color = typeof msg.color === 'string' ? msg.color.slice(0, 20) : ''
      broadcastAll({ type: 'message', username, isAdmin, isBot: false, text, color, at: new Date().toISOString() })
      handleCommand(raw, username, isAdmin)
      return
    }

    // ── Music controls ────────────────────────────────────
    if (type === 'music_cmd') {
      const canControl = isAdmin || djUsers.has(username.toLowerCase())
      switch (String(msg.action ?? '')) {
        case 'toggle':      if (canControl) togglePlayPause(); break
        case 'skip':        if (canControl) skipTrack();       break
        case 'track_ended': handleTrackEnded(String(msg.videoId ?? '')); break
      }
      return
    }

    // ── Queue management (admin / DJ) ────────────────────
    if (type === 'queue_cmd') {
      const canControl = isAdmin || djUsers.has(username.toLowerCase())
      if (!canControl) return
      const action = String(msg.action ?? '')
      if (action === 'remove')  removeFromQueue(Number(msg.index))
      if (action === 'play_at') playTrackAt(Number(msg.index))
      return
    }

    // ── Admin-only actions ────────────────────────────────
    if (!isAdmin) return

    if (type === 'kick') {
      const target = getMember(String(msg.target ?? ''))
      if (!target || target.isAdmin) return
      target.ws.send(JSON.stringify({ type: 'kicked' }))
      target.ws.close()
      broadcastAll({ type: 'system', text: `⚡ ${target.username} ถูกเตะออกจากห้อง` })
      return
    }

    if (type === 'ban') {
      const name   = String(msg.target ?? '')
      const target = getMember(name)
      if (target?.isAdmin) return
      banned.add(name.toLowerCase())
      if (target) {
        target.ws.send(JSON.stringify({ type: 'banned' }))
        target.ws.close()
      }
      broadcastAll({ type: 'system', text: `🚫 ${name} ถูกแบนจากห้อง` })
      sendUserList()
      return
    }

    if (type === 'unban') {
      const name = String(msg.target ?? '')
      banned.delete(name.toLowerCase())
      sendUserList()
      for (const m of members) {
        if (m.isAdmin) m.ws.send(JSON.stringify({ type: 'system', text: `✅ ปลดแบน ${name} แล้ว` }))
      }
      return
    }

    if (type === 'bot_config') {
      const action = String(msg.action ?? '')
      const data   = (msg.data ?? {}) as Record<string, unknown>
      applyBotConfig(action, data)
      return
    }
  },

  close(ws: ServerWebSocket<WSData>): void {
    const { username } = ws.data
    for (const m of members) {
      if (m.ws === ws) { members.delete(m); break }
    }
    clearTyping(username)
    broadcastTyping()
    broadcastAll({ type: 'system', text: `${username} ออกจากห้อง` })
    sendUserList()

    console.log(`[-] ${username} (${members.size} online)`)
  },

}
