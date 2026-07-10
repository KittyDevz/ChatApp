/**
 * music-player.js  v3
 *
 * Changes from v2
 * ───────────────
 * • Player is destroyed and recreated on every chat session so multiple
 *   leave/rejoin cycles never get stuck with a stale player.
 * • Event listeners are attached only once per page load (listenersAttached flag).
 * • onReady immediately tries to unMute(); after 300 ms we verify — if Chrome
 *   blocked it we fall back to the "tap anything" auto-unmute approach.
 * • stopMusicPlayer() now fully resets all state so re-join is always fresh.
 */

import { send }  from '../ws.js'
import { state } from '../state.js'

// ── Module state ─────────────────────────────────────────────
let ytPlayer         = null    // YT.Player instance
let ytReady          = false   // onReady has fired for current player
let pending          = null    // music_state buffered before player ready
let curId            = null    // currently loaded video ID
let muted            = true    // reflects player muted state
let curState         = null    // latest server music_state
let progressTimer    = null    // setInterval handle
let lastVol          = 80      // last non-zero volume (for vol-button toggle)
let unmuteHandler    = null    // one-time auto-unmute gesture listener
let endedSent        = null    // videoId we already sent track_ended for
let listenersAttached = false  // set once, never cleared (prevents duplicate listeners)

// ── Public init ───────────────────────────────────────────────

export function initMusicPlayer() {
  try {
    const bar = document.getElementById('music-bar')
    if (!bar) { console.error('[Music] #music-bar not found'); return }

    // Attach UI / document listeners only the first time
    if (!listenersAttached) {
      listenersAttached = true
      _attachListeners()
    }

    // (Re)create the YT player for this session
    _initPlayer()

    _updateControlsVisibility()
  } catch (err) {
    console.error('[Music] init error:', err)
  }
}

// ── Listener setup (once per page load) ──────────────────────

function _attachListeners() {
  // Volume slider
  const volSlider = document.getElementById('music-vol-slider')
  if (volSlider) {
    const saved = parseInt(localStorage.getItem('music-vol') ?? '80')
    volSlider.value = String(saved)
    lastVol = saved
    _updateSliderFill(volSlider)

    volSlider.addEventListener('input', () => {
      const vol = Number(volSlider.value)
      localStorage.setItem('music-vol', String(vol))
      if (vol > 0) lastVol = vol
      if (ytPlayer) {
        if (vol === 0) { ytPlayer.mute(); muted = true }
        else { ytPlayer.unMute(); ytPlayer.setVolume(vol); muted = false }
      }
      _updateSliderFill(volSlider)
      _updateVolBtn(vol)
    })
  }

  // Volume icon button — toggle mute
  document.getElementById('music-vol-btn')?.addEventListener('click', () => {
    const slider = document.getElementById('music-vol-slider')
    if (!ytPlayer || !slider) return
    if (muted || Number(slider.value) === 0) {
      const v = lastVol || 80
      slider.value = String(v)
      ytPlayer.unMute(); ytPlayer.setVolume(v)
      muted = false
      _updateSliderFill(slider); _updateVolBtn(v)
    } else {
      ytPlayer.mute(); muted = true; _updateVolBtn(0)
    }
  })

  // Play/pause
  document.getElementById('music-playpause')?.addEventListener('click', () =>
    send({ type: 'music_cmd', action: 'toggle' })
  )
  // Skip
  document.getElementById('music-skip')?.addEventListener('click', () =>
    send({ type: 'music_cmd', action: 'skip' })
  )

  // Autoplay toggle (admin only)
  const apBtn = document.getElementById('music-autoplay-btn')
  if (apBtn) {
    if (state.myIsAdmin) apBtn.classList.add('admin-ctrl')
    apBtn.addEventListener('click', () => {
      if (!state.myIsAdmin) return
      send({ type: 'message', text: '!autoplay', color: '' })
    })
  }

  // Queue toggle
  document.getElementById('music-queue-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('music-queue-panel')
    const btn   = document.getElementById('music-queue-btn')
    if (!panel) return
    const isOpen = !panel.classList.contains('hidden')
    if (isOpen) {
      panel.classList.add('hidden')
      btn?.classList.remove('active')
    } else {
      _renderQueue()
      panel.classList.remove('hidden')
      btn?.classList.add('active')
    }
  })

  // Server state
  document.addEventListener('chat:musicState', e => {
    console.log('[Music] state', e.detail?.videoId, 'playing=', e.detail?.playing)
    _onState(e.detail)
  })
  document.addEventListener('chat:djUpdate', () => _updateControlsVisibility())
}

// ── Player lifecycle ──────────────────────────────────────────

function _initPlayer() {
  if (ytPlayer) return   // already alive for this session

  // Ensure the container div exists (destroy() removes the iframe but we recreate it)
  _ensureYtDiv()

  if (window.YT?.Player) {
    _createPlayer()
  } else {
    console.log('[Music] loading YT IFrame API…')
    window.onYouTubeIframeAPIReady = () => {
      console.log('[Music] YT API ready')
      _createPlayer()
    }
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src   = 'https://www.youtube.com/iframe_api'
      tag.onerror = () => console.warn('[Music] YT API failed to load')
      document.head.appendChild(tag)
    }
  }
}

function _ensureYtDiv() {
  if (document.getElementById('yt-player')) return
  const div = document.createElement('div')
  div.id = 'yt-player'
  // Insert right after music-bar in chat-main
  const bar = document.getElementById('music-bar')
  if (bar?.parentNode) bar.parentNode.insertBefore(div, bar.nextSibling)
  else document.getElementById('chat-main')?.appendChild(div)
}

function _createPlayer() {
  _ensureYtDiv()
  try {
    ytPlayer = new YT.Player('yt-player', {
      width: '320', height: '180',
      playerVars: { autoplay: 0, controls: 0, playsinline: 1, rel: 0 },
      events: {
        onReady(e) {
          console.log('[Music] player ready')
          ytReady = true
          const vol = parseInt(localStorage.getItem('music-vol') ?? '80')
          e.target.setVolume(vol)

          // ── Auto-unmute: try to play with sound immediately.
          // Chrome allows this if the user has interacted with the page
          // (they just clicked "เข้าร่วม"), so this works for returning users.
          e.target.unMute()
          muted = false
          _updateVolBtn(vol)

          // 300 ms later: if isMuted() is still true, Chrome blocked it.
          // Fall back to the "interact anywhere to unmute" approach.
          setTimeout(() => {
            if (!ytPlayer) return
            try {
              if (ytPlayer.isMuted()) {
                muted = true
                _updateVolBtn(0)
                console.log('[Music] Chrome blocked audio — scheduling auto-unmute on gesture')
                _scheduleAutoUnmute()
              }
            } catch {}
          }, 300)

          if (pending) { _apply(pending); pending = null }
        },
        onStateChange(e) {
          if (e.data === YT.PlayerState.ENDED) _signalTrackEnded()
        },
        onError(e) {
          console.warn('[Music] YT error code', e.data)
          _signalTrackEnded()
        },
      },
    })
  } catch (err) {
    console.error('[Music] _createPlayer error:', err)
  }
}

// ── Public: stop playback when leaving chat ───────────────────

export function stopMusicPlayer() {
  _stopProgressTimer()

  // Cancel pending auto-unmute gesture listener
  if (unmuteHandler) {
    document.removeEventListener('click',   unmuteHandler)
    document.removeEventListener('keydown', unmuteHandler)
    unmuteHandler = null
  }

  // Destroy the YT player + record iframe position so we can recreate the div
  if (ytPlayer) {
    try {
      const el     = document.getElementById('yt-player')
      const parent = el?.parentNode
      const next   = el?.nextSibling
      ytPlayer.destroy()            // removes the <iframe>
      // Recreate empty div so the next session can create a fresh player
      if (parent) {
        const div = document.createElement('div')
        div.id = 'yt-player'
        parent.insertBefore(div, next ?? null)
      }
    } catch { /* ignore */ }
    ytPlayer = null
  }

  // Full state reset — next join starts completely fresh
  ytReady   = false
  curId     = null
  curState  = null
  pending   = null
  endedSent = null
  muted     = true   // reset so auto-unmute runs again on next join

  const bar = document.getElementById('music-bar')
  if (bar) bar.classList.add('hidden')
}

// ── State handler ─────────────────────────────────────────────

function _onState(s) {
  if (!ytReady) { pending = s; _updateBar(s); return }
  _apply(s)
}

function _apply(s) {
  const prevPlaying = curState?.playing ?? null
  curState = s
  _updateBar(s)
  if (!s.videoId) {
    // Queue cleared or no song — stop the player
    if (ytPlayer) try { ytPlayer.stopVideo() } catch {}
    curId = null
    _stopProgressTimer()
    return
  }
  if (!ytPlayer) return

  if (s.videoId !== curId) {
    console.log('[Music] load', s.videoId, 'playing=', s.playing)
    curId     = s.videoId
    endedSent = null
    if (s.playing) {
      const sec = Math.max(0, s.pauseOffsetS + (Date.now() - s.trackStartMs) / 1000)
      ytPlayer.loadVideoById({ videoId: s.videoId, startSeconds: sec })
    } else {
      ytPlayer.cueVideoById({ videoId: s.videoId, startSeconds: s.pauseOffsetS })
    }
  } else if (s.playing !== prevPlaying) {
    // Same track — only touch player when play/pause actually changed
    if (s.playing) {
      const sec = Math.max(0, s.pauseOffsetS + (Date.now() - s.trackStartMs) / 1000)
      ytPlayer.seekTo(sec, true); ytPlayer.playVideo()
    } else {
      ytPlayer.seekTo(s.pauseOffsetS, true); ytPlayer.pauseVideo()
    }
  }
  // Same track + same state → UI update only, no player touch (prevents stutter)

  if (s.playing && muted) _scheduleAutoUnmute()
  if (s.playing) _startProgressTimer()
  else           _stopProgressTimer()
}

// ── Track-ended signal (deduplicated) ────────────────────────

function _signalTrackEnded() {
  if (!curId || curId === endedSent) return
  endedSent = curId
  console.log('[Music] ended →', curId)
  send({ type: 'music_cmd', action: 'track_ended', videoId: curId })
}

// ── Auto-unmute on first gesture ─────────────────────────────

function _scheduleAutoUnmute() {
  if (!muted || unmuteHandler) return
  unmuteHandler = () => {
    _doUnmute()
    document.removeEventListener('click',   unmuteHandler)
    document.removeEventListener('keydown', unmuteHandler)
    unmuteHandler = null
  }
  document.addEventListener('click',   unmuteHandler, { passive: true })
  document.addEventListener('keydown', unmuteHandler, { passive: true })
}

function _doUnmute() {
  if (!muted || !ytPlayer) return
  muted = false
  ytPlayer.unMute()
  const vol = parseInt(localStorage.getItem('music-vol') ?? '80') || 80
  ytPlayer.setVolume(vol)
  _updateVolBtn(vol)
  console.log('[Music] unmuted at vol', vol)
}

// ── Progress bar ──────────────────────────────────────────────

function _startProgressTimer() {
  if (progressTimer) return
  progressTimer = setInterval(_tickProgress, 500)
}
function _stopProgressTimer() {
  if (!progressTimer) return
  clearInterval(progressTimer); progressTimer = null
}
function _tickProgress() {
  if (!curState?.playing) return
  const elapsed  = curState.pauseOffsetS + (Date.now() - curState.trackStartMs) / 1000
  const duration = ytPlayer?.getDuration?.() ?? 0
  _updateProgress(Math.max(0, elapsed), duration)
  // Fallback: if elapsed > duration and ENDED event didn't fire
  if (duration > 0 && elapsed >= duration + 1) _signalTrackEnded()
}
function _updateProgress(elapsed, duration) {
  const fill = document.getElementById('music-progress-fill')
  const time = document.getElementById('music-time')
  const dur  = document.getElementById('music-duration')
  if (fill && duration > 0) fill.style.width = Math.min(100, elapsed / duration * 100) + '%'
  if (time) time.textContent = _fmt(elapsed)
  if (dur && duration > 0) dur.textContent = _fmt(duration)
}
function _fmt(sec) {
  const s = Math.floor(Math.max(0, sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ── Bar UI ────────────────────────────────────────────────────

function _updateBar(s) {
  const bar = document.getElementById('music-bar')
  if (!bar) return
  if (!s.videoId) {
    bar.classList.add('hidden')
    _stopProgressTimer()
    // Also close the queue panel — no songs means nothing to show
    document.getElementById('music-queue-panel')?.classList.add('hidden')
    document.getElementById('music-queue-btn')?.classList.remove('active')
    return
  }
  bar.classList.remove('hidden')

  const titleEl = document.getElementById('music-title')
  const byEl    = document.getElementById('music-by')
  const ppBtn   = document.getElementById('music-playpause')
  const thumb   = document.getElementById('music-thumb')

  if (titleEl) titleEl.textContent = s.title ?? s.videoId
  if (byEl)    byEl.textContent    = `ขอโดย ${s.by ?? '?'}`
  if (ppBtn) ppBtn.innerHTML = s.playing ? _svgPause() : _svgPlay()
  _updateAutoplayBtn(s.autoplay)

  if (thumb) {
    const newSrc = `https://i.ytimg.com/vi/${s.videoId}/mqdefault.jpg`
    if (thumb.getAttribute('data-vid') !== s.videoId) {
      // Track by videoId attribute to avoid false mismatches from browser URL normalisation
      thumb.setAttribute('data-vid', s.videoId)
      thumb.style.display = 'none'
      // Assign handlers BEFORE src so cached images don't miss onload
      thumb.onload  = () => { thumb.style.display = 'block' }
      thumb.onerror = () => { thumb.style.display = 'none'  }
      thumb.src = newSrc
    }
  }
  if (s.videoId !== curId) _updateProgress(0, 0)

  // Keep queue panel in sync if it's open
  if (!document.getElementById('music-queue-panel')?.classList.contains('hidden')) {
    _renderQueue()
  }
}

// ── Queue panel ───────────────────────────────────────────────

export function getCurrentMusicState() { return curState }

function _renderQueue() {
  const list     = document.getElementById('music-queue-list')
  const countEl  = document.getElementById('music-queue-count')
  const panel    = document.getElementById('music-queue-panel')
  const queueBtn = document.getElementById('music-queue-btn')

  if (!list || !curState) return

  const queue      = curState.queue      ?? []
  const queueIndex = curState.queueIndex ?? 0

  if (!queue.length) {
    panel?.classList.add('hidden')
    queueBtn?.classList.remove('active')
    return
  }

  if (countEl) countEl.textContent = `${queue.length} เพลง`

  const canControl = state.myIsAdmin || state.myIsDJ

  list.innerHTML = queue.map((track, i) => {
    const isCurrent = i === queueIndex
    const icon = isCurrent
      ? (curState.playing ? '▶' : '⏸')
      : String(i + 1) + '.'

    const actions = canControl && !isCurrent ? `
      <div class="queue-item-actions">
        <button class="queue-act-btn queue-playnow-btn" data-idx="${i}" title="เล่นทันที">▶</button>
        <button class="queue-act-btn queue-remove-btn"  data-idx="${i}" title="ลบออก">✕</button>
      </div>` : ''

    return `<div class="queue-item${isCurrent ? ' queue-item-active' : ''}" data-idx="${i}">
      <span class="queue-num">${icon}</span>
      <span class="queue-title">${_esc(track.title ?? track.videoId)}</span>
      <span class="queue-by">ขอโดย ${_esc(track.by ?? '?')}</span>
      ${actions}
    </div>`
  }).join('')

  // Wire up action buttons
  list.querySelectorAll('.queue-playnow-btn').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation()
      send({ type: 'queue_cmd', action: 'play_at', index: Number(btn.dataset.idx) })
    })
  )
  list.querySelectorAll('.queue-remove-btn').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation()
      send({ type: 'queue_cmd', action: 'remove', index: Number(btn.dataset.idx) })
    })
  )
}

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Autoplay button ───────────────────────────────────────────

function _updateAutoplayBtn(on) {
  const btn = document.getElementById('music-autoplay-btn')
  if (!btn) return
  btn.classList.toggle('active', !!on)
  btn.title = on
    ? 'AutoPlay เปิดอยู่ — สุ่มเพลงต่อเรื่อยๆ' + (state.myIsAdmin ? ' (คลิกปิด)' : '')
    : 'AutoPlay ปิดอยู่' + (state.myIsAdmin ? ' (คลิกเปิด)' : '')
}

// ── Controls visibility ───────────────────────────────────────

function _updateControlsVisibility() {
  const ctrl = document.getElementById('music-controls')
  if (!ctrl) return
  ctrl.classList.toggle('music-no-ctrl', !(state.myIsAdmin || state.myIsDJ))
}

// ── Volume helpers ────────────────────────────────────────────

function _updateVolBtn(vol) {
  const btn = document.getElementById('music-vol-btn')
  if (!btn) return
  btn.innerHTML = muted || vol === 0 ? _svgMuted() : vol < 40 ? _svgVolLow() : _svgVolHigh()
  btn.title = muted ? 'ปิดเสียง (คลิกเพื่อเปิด)' : 'เสียง'
}
function _updateSliderFill(slider) {
  const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100
  slider.style.backgroundImage =
    `linear-gradient(to right,var(--primary) 0%,var(--primary) ${pct}%,var(--surface2) ${pct}%,var(--surface2) 100%)`
}

// ── SVG icons ─────────────────────────────────────────────────

function _svgPlay()  {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>`
}
function _svgPause() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
}
function _svgMuted() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
}
function _svgVolLow() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
}
function _svgVolHigh() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
}
