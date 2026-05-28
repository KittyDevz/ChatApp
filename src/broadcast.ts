import { members, banned, typing } from './state'

export function broadcastAll(payload: object): void {
  const json = JSON.stringify(payload)
  for (const m of members) m.ws.send(json)
}

/**
 * Send the user list to every connected client.
 * Admins additionally receive the banned-username list.
 */
export function sendUserList(): void {
  const users     = [...members].map(m => ({ username: m.username, isAdmin: m.isAdmin }))
  const bannedArr = [...banned]

  for (const m of members) {
    const payload = m.isAdmin
      ? { type: 'users', users, banned: bannedArr }
      : { type: 'users', users }
    m.ws.send(JSON.stringify(payload))
  }
}

export function broadcastTyping(): void {
  broadcastAll({ type: 'typing', users: [...typing] })
}
