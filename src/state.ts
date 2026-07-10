import type { Member } from './types'

export const members      = new Set<Member>()
export const banned       = new Set<string>()  // lowercased usernames
export const typing       = new Set<string>()  // currently typing
export const typingTimers = new Map<string, ReturnType<typeof setTimeout>>()

export interface BotInfo {
  username: string
  isAdmin:  boolean
  isBot:    true
}

/** Virtual bot members (server-side, no WebSocket) */
export const bots = new Set<BotInfo>()

/** Usernames (lowercase) that have DJ music-control rights */
export const djUsers = new Set<string>()

export function getMember(username: string): Member | undefined {
  for (const m of members) if (m.username === username) return m
}

export function clearTyping(username: string): void {
  if (!typing.has(username)) return
  typing.delete(username)
  const timer = typingTimers.get(username)
  if (timer !== undefined) {
    clearTimeout(timer)
    typingTimers.delete(username)
  }
}
