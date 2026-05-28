import type { Member } from './types'

export const members      = new Set<Member>()
export const banned       = new Set<string>()  // lowercased usernames
export const typing       = new Set<string>()  // currently typing
export const typingTimers = new Map<string, ReturnType<typeof setTimeout>>()

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
