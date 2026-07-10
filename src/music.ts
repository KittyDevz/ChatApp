/**
 * music.ts — Shared music-queue state
 *
 * Any user can add songs with !play <youtube-url>.
 * The server tracks wall-clock start time so every client can seek
 * to the correct position when they (re)connect.
 */

import { broadcastAll } from './broadcast'

export interface Track {
  videoId: string
  title:   string
  by:      string
}

// ── State ──────────────────────────────────────────────────
let queue:       Track[] = []
let queueIndex   = 0
let playing      = false
let trackStartMs = 0    // Date.now() when current track's playback last (re)started
let pauseOffsetS = 0    // seconds already elapsed when paused
let autoplay     = false // loop queue when it ends

// ── Recently-played ring buffer (avoids autoplay repeats) ──
const recentlyPlayed: string[] = []
const RECENT_LIMIT = 25

function _recordPlayed(id: string): void {
  if (!id || recentlyPlayed.includes(id)) return
  recentlyPlayed.push(id)
  if (recentlyPlayed.length > RECENT_LIMIT) recentlyPlayed.shift()
}

// ── Snapshot ───────────────────────────────────────────────

export function getMusicState() {
  return {
    type:         'music_state' as const,
    queue:        [...queue],
    queueIndex,
    playing,
    videoId:      queue[queueIndex]?.videoId ?? null,
    title:        queue[queueIndex]?.title   ?? null,
    by:           queue[queueIndex]?.by      ?? null,
    trackStartMs,
    pauseOffsetS,
    autoplay,
  }
}

export function getAutoplay(): boolean { return autoplay }
export function setAutoplay(value: boolean): void {
  autoplay = value
  broadcastMusicState()
}

export function broadcastMusicState(): void {
  broadcastAll(getMusicState())
}

// ── Queue controls ─────────────────────────────────────────

/** Add a track immediately (sync), then update title in background */
export function addToQueue(videoId: string, by: string): Track {
  const track: Track = { videoId, title: videoId, by }   // use ID as placeholder title
  queue.push(track)

  // Auto-start when first song is added
  if (!playing && queue.length === 1) {
    queueIndex   = 0
    playing      = true
    trackStartMs = Date.now()
    pauseOffsetS = 0
  }

  broadcastMusicState()   // broadcast immediately

  // Fetch real title in background; update & re-broadcast when done
  fetchTitle(videoId).then(title => {
    const t = queue.find(t => t.videoId === videoId && t.title === videoId)
    if (t) { t.title = title; broadcastMusicState() }
  }).catch(() => {})

  return track
}

export function skipTrack(): boolean {
  // Record current track as played before advancing
  const currentId = queue[queueIndex]?.videoId
  if (currentId) _recordPlayed(currentId)

  const next = queueIndex + 1
  if (next >= queue.length) {
    if (autoplay && queue.length > 0) {
      const lastId = queue[queueIndex]!.videoId
      // Clear queue so the bar hides cleanly while we fetch
      queue.length = 0; queueIndex = 0; playing = false; trackStartMs = 0; pauseOffsetS = 0
      broadcastMusicState()
      // Fetch a related music video and auto-add it
      fetchRelatedVideoId(lastId).then(relatedId => {
        if (!autoplay || !relatedId) return
        addToQueue(relatedId, '🎲 AutoPlay')
      }).catch(() => {})
      return false
    }
    // No autoplay — clear everything so videoId becomes null
    queue.length = 0
    queueIndex   = 0
    playing      = false
    trackStartMs = 0
    pauseOffsetS = 0
    broadcastMusicState()
    return false
  }
  queueIndex   = next
  playing      = true
  trackStartMs = Date.now()
  pauseOffsetS = 0
  broadcastMusicState()
  return true
}

/** Client reports the current track ended → auto-advance */
export function handleTrackEnded(videoId: string): void {
  if (queue[queueIndex]?.videoId !== videoId) return  // already advanced
  skipTrack()
}

export function togglePlayPause(): void {
  if (!queue[queueIndex]) return
  if (playing) {
    pauseOffsetS += (Date.now() - trackStartMs) / 1000
    playing = false
  } else {
    playing      = true
    trackStartMs = Date.now()
  }
  broadcastMusicState()
}

export function stopMusic(): void {
  playing      = false
  pauseOffsetS = 0
  broadcastMusicState()
}

/** Remove a queued track by index. Cannot remove the currently playing track. */
export function removeFromQueue(index: number): boolean {
  if (index < 0 || index >= queue.length || index === queueIndex) return false
  queue.splice(index, 1)
  if (index < queueIndex) queueIndex--   // stay pointed at the same track
  broadcastMusicState()
  return true
}

/** Jump to a specific track in the queue and start playing it. */
export function playTrackAt(index: number): boolean {
  if (index < 0 || index >= queue.length) return false
  queueIndex   = index
  playing      = true
  trackStartMs = Date.now()
  pauseOffsetS = 0
  broadcastMusicState()
  return true
}

export function clearQueue(): void {
  queue        = []
  queueIndex   = 0
  playing      = false
  trackStartMs = 0
  pauseOffsetS = 0
  broadcastMusicState()
}

// ── YouTube helpers ────────────────────────────────────────

/** Extract an 11-char video ID from any YouTube URL format, or a raw ID */
export function extractVideoId(input: string): string | null {
  const m = input.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )
  if (m) return m[1]!
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim()
  return null
}

// Conservative set of patterns that clearly indicate a NON-music video
const NON_MUSIC_RE = /\b(gameplay|let'?s\s+play|walkthrough|playthrough|unboxing|podcast|gaming|game\s+review|stream\s+highlight|full\s+(?:movie|episode|film)|documentary)\b/i

function _looksLikeMusic(title: string): boolean {
  return title.length > 1 && !NON_MUSIC_RE.test(title)
}

/** Extract the video title from the JSON content that follows a videoId in the HTML */
function _extractTitleNear(html: string, offset: number): string | null {
  const ahead = html.slice(offset, offset + 500)
  const m = ahead.match(/"runs":\[{"text":"([^"]{2,150})"/)
  return m?.[1] ?? null
}

/**
 * Search YouTube for the first music-looking video matching a text query.
 * Tries up to 10 results and returns the first that looks like a song.
 * Falls back to the very first result if none pass the filter.
 */
export async function searchYouTube(query: string): Promise<string | null> {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%3D%3D`
    const res = await fetch(url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    if (!res.ok) return null
    const html = await res.text()

    const seen = new Set<string>()
    let firstResult: string | null = null

    for (const m of html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)) {
      const id = m[1]!
      if (seen.has(id)) continue
      seen.add(id)
      if (!firstResult) firstResult = id

      const title = _extractTitleNear(html, (m.index ?? 0) + m[0].length)
      // Accept immediately if title looks like music, or if title can't be extracted
      if (!title || _looksLikeMusic(title)) return id
      if (seen.size >= 10) break
    }
    return firstResult   // Fallback: return first result if nothing passed filter
  } catch {
    return null
  }
}

/**
 * Fetch a music-specific related video ID for autoplay.
 *
 * Strategy (4 passes in order)
 * ─────────────────────────────
 * Pass 1 — YouTube Radio Mix (list=RD{id})
 *   playlistPanelVideoRenderer entries are always music — best source.
 *
 * Pass 2 — Regular watch page with music-signal scoring
 *   Scores each videoId by proximity to musicVideoType, VEVO,
 *   "Official Video", etc. Also checks title against non-music patterns.
 *
 * Pass 3 — Artist-based search
 *   Extracts artist name from the current song's title and searches
 *   for their official music videos.
 *
 * Pass 4 — Genre fallback
 *   Picks a random music genre search as last resort.
 */
async function fetchRelatedVideoId(videoId: string): Promise<string | null> {
  const headers = {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  }

  // Pass 1: Radio Mix — music-curated playlist ──────────────
  try {
    const res = await fetch(
      `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`,
      { headers },
    )
    if (res.ok) {
      const html = await res.text()
      const ids  = _extractPlaylistIds(html, videoId)
      if (ids.length >= 1) return _pickRandom(ids)
    }
  } catch { /* fall through */ }

  // Pass 2: Watch page with music-signal scoring ────────────
  let watchHtml: string | null = null
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { headers })
    if (res.ok) {
      watchHtml = await res.text()
      const ids = _extractMusicSignalIds(watchHtml, videoId)
      if (ids.length) return _pickRandom(ids)
    }
  } catch { /* fall through */ }

  // Pass 3: Artist-based search (uses title from watch page) ─
  if (watchHtml) {
    try {
      const titleM = watchHtml.match(/"title":\{"simpleText":"([^"]{3,100})"/)
      if (titleM) {
        const artist = titleM[1]!.split(/\s*[-–—|]\s*/)[0]?.trim() ?? ''
        if (artist.length > 2) {
          const found = await searchYouTube(`${artist} official music video`)
          if (found && found !== videoId) return found
        }
      }
    } catch { /* fall through */ }
  }

  // Pass 4: Genre fallback ───────────────────────────────────
  const fallbacks = [
    'popular music official MV',
    'official music video 2024',
    'K-pop official music video',
    'Thai pop เพลงไทย official MV',
    'pop hits official audio',
  ]
  try {
    const q = fallbacks[Math.floor(Math.random() * fallbacks.length)]!
    return await searchYouTube(q)
  } catch { /* give up */ }

  return null
}

/** Extract IDs from playlistPanelVideoRenderer entries (Radio Mix items = all music). */
function _extractPlaylistIds(html: string, exclude: string): string[] {
  const seen = new Set<string>([exclude])
  const out: string[] = []
  for (const m of html.matchAll(/"playlistPanelVideoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"/g)) {
    const id = m[1]!
    if (!seen.has(id)) { seen.add(id); out.push(id) }
  }
  return out
}

/** Score videoIds by music-specific signals and return top candidates. */
function _extractMusicSignalIds(html: string, exclude: string): string[] {
  const seen   = new Set<string>([exclude])
  const scored: { id: string; score: number }[] = []

  for (const m of html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)) {
    const id = m[1]!
    if (seen.has(id)) continue
    seen.add(id)

    const lo  = Math.max(0, (m.index ?? 0) - 400)
    const hi  = Math.min(html.length, (m.index ?? 0) + 600)
    const ctx = html.slice(lo, hi)

    let score = 0
    if (/musicVideoType/i.test(ctx))                score += 10
    if (/music\.youtube\.com/i.test(ctx))           score += 8
    if (/VEVO/i.test(ctx))                          score += 8
    if (/Official\s*(?:Music\s*)?Video/i.test(ctx)) score += 6
    if (/Official\s*Audio/i.test(ctx))              score += 6
    if (/"Music"/i.test(ctx))                       score += 4

    const title = _extractTitleNear(html, (m.index ?? 0) + m[0].length)
    if (title) {
      if (!_looksLikeMusic(title)) score -= 8
      else if (/official|feat\.?|ft\.?|prod\.?/i.test(title)) score += 2
    }

    if (score > 0) scored.push({ id, score })
    if (seen.size >= 50) break
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 10).map(c => c.id)
}

function _pickRandom(arr: string[]): string {
  // Prefer IDs not recently played for variety
  const fresh = arr.filter(id => !recentlyPlayed.includes(id))
  const pool  = (fresh.length ? fresh : arr).slice(0, 15)
  return pool[Math.floor(Math.random() * pool.length)]!
}

async function fetchTitle(videoId: string): Promise<string> {
  try {
    const res  = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    )
    if (!res.ok) return videoId
    const data = await res.json() as { title?: string }
    return data.title ?? videoId
  } catch {
    return videoId
  }
}
