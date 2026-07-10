import { members, banned, typing, bots } from './state'

export function broadcastAll(payload: object): void {
  const json = JSON.stringify(payload)
  for (const m of members) m.ws.send(json)
}

/**
 * Send the user list to every connected client.
 * Bots appear first, then real users.
 * Admins additionally receive the banned-username list.
 */
export function sendUserList(): void {
  const botUsers     = [...bots].map(b => ({ username: b.username, isAdmin: b.isAdmin, isBot: true  as const }))
  const regularUsers = [...members].map(m => ({ username: m.username, isAdmin: m.isAdmin, isBot: false as const }))
  const users        = [...botUsers, ...regularUsers]
  const bannedArr    = [...banned]

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

/** Send a payload only to currently-connected admin members */
export function sendToAdmins(payload: object): void {
  const json = JSON.stringify(payload)
  for (const m of members) {
    if (m.isAdmin) m.ws.send(json)
  }
}
