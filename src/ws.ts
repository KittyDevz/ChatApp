import type { ServerWebSocket } from 'bun'
import type { WSData }           from './types'
import { members, banned, typing, typingTimers, getMember, clearTyping } from './state'
import { broadcastAll, sendUserList, broadcastTyping }                    from './broadcast'

export const websocket = {

  open(ws: ServerWebSocket<WSData>): void {
    const { username, isAdmin } = ws.data
    members.add({ ws, username, isAdmin })

    ws.send(JSON.stringify({ type: 'welcome', isAdmin }))
    broadcastAll({ type: 'system', text: `${username} เข้าร่วมห้อง` })
    sendUserList()

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
      const text = String(msg.text ?? '').trim().slice(0, 500)
      if (!text) return
      clearTyping(username)
      broadcastTyping()
      broadcastAll({ type: 'message', username, isAdmin, text, at: new Date().toISOString() })
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
