import type { ServerWebSocket } from 'bun'

export interface WSData {
  username: string
  isAdmin:  boolean
}

export interface Member {
  ws:       ServerWebSocket<WSData>
  username: string
  isAdmin:  boolean
}

export interface UserInfo {
  username: string
  isAdmin:  boolean
}

// Union of every payload the server can send to a client
export type ServerPayload =
  | { type: 'welcome';  isAdmin: boolean }
  | { type: 'system';   text: string }
  | { type: 'message';  username: string; isAdmin: boolean; text: string; at: string }
  | { type: 'users';    users: UserInfo[];  banned?: string[] }
  | { type: 'typing';   users: string[] }
  | { type: 'kicked' }
  | { type: 'banned' }
