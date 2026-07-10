import type { Server } from 'bun'
import { join }         from 'path'
import { ADMIN_KEY, PUBLIC_DIR } from './config'
import { members, banned, bots } from './state'

// ── Helpers ───────────────────────────────────────────────
function json(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function serveStatic(pathname: string): Promise<Response> {
  const file = Bun.file(join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname))
  if (await file.exists()) return new Response(file)
  return new Response(Bun.file(join(PUBLIC_DIR, 'index.html')))
}

// ── Main fetch handler ────────────────────────────────────
export async function fetchHandler(
  req: Request,
  server: Server,
): Promise<Response | undefined> {
  const url = new URL(req.url)

  // ── GET /api/check  ────────────────────────────────────
  // Pre-flight check called by the client before opening a WebSocket.
  // Returns { ok: true } or { error: 'banned' | 'taken' | 'empty' }.
  if (url.pathname === '/api/check') {
    const raw   = url.searchParams.get('username')?.trim() ?? ''
    const lower = raw.toLowerCase()
    if (!lower)              return json({ error: 'empty'  }, 400)
    if (banned.has(lower))   return json({ error: 'banned' }, 403)
    for (const m of members) {
      if (m.username.toLowerCase() === lower) return json({ error: 'taken' }, 409)
    }
    for (const b of bots) {
      if (b.username.toLowerCase() === lower) return json({ error: 'taken' }, 409)
    }
    return json({ ok: true })
  }

  // ── WebSocket upgrade  ─────────────────────────────────
  if (url.pathname === '/ws') {
    const username = url.searchParams.get('username')?.trim() ?? ''
    const adminKey = url.searchParams.get('adminKey') ?? ''
    const isAdmin  = adminKey !== '' && adminKey === ADMIN_KEY

    if (!username) return new Response('Missing username', { status: 400 })

    const upgraded = server.upgrade(req, { data: { username, isAdmin } })
    if (upgraded) return undefined
  }

  // ── Static files  ──────────────────────────────────────
  return serveStatic(url.pathname)
}
