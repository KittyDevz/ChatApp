/**
 * emoji-picker.js — Facebook-style emoji picker with categories
 */

const CATEGORIES = [
  {
    icon: '😊', label: 'Smileys',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃',
      '😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
      '🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢',
      '🤫','🤔','🫠','🤐','🤨','😐','😑','😶','😶‍🌫️','😏',
      '😒','🙄','😬','🤥','😔','😪','🤤','😴','😷','🤒',
      '🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','😵‍💫','🤯',
      '🤠','🥳','🥸','😎','🤓','🧐','😟','😕','🫤','😣',
      '😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬',
      '😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽',
      '👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾',
    ],
  },
  {
    icon: '👋', label: 'People',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌',
      '🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉',
      '👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛',
      '🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','💪','🦾',
      '🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷',
      '🦴','👀','👁️','👅','👄','🫦','💋','💅','🤳','💃',
      '🕺','🧖','🧗','🤸','⛹️','🏋️','🤼','🤺','🥊','🥋',
      '🧘','🛀','🛌','🧑','👶','🧒','👦','👧','🧑','👱',
      '🧔','🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋',
      '🧏','🙇','🤦','🤷','💆','💇','🚶','🧍','🧎','🏃',
    ],
  },
  {
    icon: '🐶', label: 'Animals',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
      '🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧',
      '🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄',
      '🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪲','🦟','🦗',
      '🪳','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑',
      '🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈',
      '🦭','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛',
      '🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎',
      '🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐈',
      '🐓','🦃','🦤','🦚','🦜','🦢','🕊️','🐇','🦝','🌸',
    ],
  },
  {
    icon: '🍕', label: 'Food',
    emojis: [
      '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐',
      '🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑',
      '🥦','🥬','🥒','🌶️','🫑','🧄','🧅','🥔','🍠','🫘',
      '🌽','🍞','🥐','🥖','🫓','🥨','🧀','🥚','🍳','🧈',
      '🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕',
      '🫔','🌮','🌯','🫔','🥙','🧆','🥚','🍜','🍝','🍛',
      '🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮',
      '🍡','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩',
      '🍪','🌰','🥜','☕','🫖','🧃','🥤','🧋','🍵','🍶',
      '🍾','🍷','🍸','🍹','🍺','🥂','🥃','🍻','🫗','🧊',
    ],
  },
  {
    icon: '⚽', label: 'Activities',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱',
      '🪀','🏓','🏸','🏒','🥍','🏑','🏏','🪃','🥅','⛳',
      '🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷',
      '⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤸','⛹️','🤺',
      '🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆',
      '🥇','🥈','🥉','🏅','🎖️','🎗️','🎫','🎟️','🎪','🤹',
      '🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷',
      '🎺','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🎰',
      '🧩','🪄','🎭','🖼️','🎠','🎡','🎢','🎪','🤺','🏋️',
      '🤼','🤸','🤾','🧗','🏌️','🏇','🏄','🧜','🧚','🧙',
    ],
  },
  {
    icon: '🚀', label: 'Travel',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐',
      '🛻','🚚','🚛','🚜','🏍️','🛵','🛺','🚲','🛴','🛹',
      '🛼','🚏','🛣️','🛤️','🛞','⛽','🚨','🚥','🚦','🛑',
      '⚓','🛟','⛵','🚤','🛥️','🛳️','⛴️','🚢','✈️','🛩️',
      '🛫','🛬','🪂','💺','🚁','🚟','🚠','🚡','🛰️','🚀',
      '🛸','🌍','🌎','🌏','🌐','🗺️','🧭','🏔️','⛰️','🌋',
      '🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🧱',
      '🪨','🪵','🛖','🏠','🏡','🏢','🏣','🏤','🏥','🏦',
      '🏨','🏩','🏪','🏫','🏭','🏯','🏰','💒','🗼','🗽',
      '⛪','🕌','🛕','🕍','⛩️','🗾','🎌','🏁','🚩','🏳️',
    ],
  },
  {
    icon: '💡', label: 'Objects',
    emojis: [
      '⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💽',
      '💾','💿','📀','🧮','📷','📸','📹','🎥','📽️','🎞️',
      '📞','☎️','📟','📠','📺','📻','🧭','⏱️','⏲️','⏰',
      '🕰️','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯️','🪔',
      '🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳',
      '💎','⚖️','🪜','🧰','🪛','🔧','🪚','🔨','⚒️','🛠️',
      '⛏️','🪤','🧲','🪣','🔩','🪝','🧱','🔑','🗝️','🔐',
      '🔏','🔓','🔒','🚪','🪞','🪟','🧴','🧷','🧹','🧺',
      '🧻','🪣','🧼','🫧','🪥','🧽','🧯','🛒','🚿','🛁',
      '🎁','🎀','🎊','🎉','🎈','🎆','🎇','🧨','🪅','🎑',
    ],
  },
  {
    icon: '❤️', label: 'Symbols',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
      '❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟',
      '☮️','✝️','☪️','🕉️','☯️','✡️','🛐','⛎','♈','♉',
      '♊','♋','♌','♍','♎','♏','♐','♑','♒','♓',
      '🔥','✨','⚡','💫','🌟','⭐','🌠','☄️','🌈','☀️',
      '🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️',
      '☃️','⛄','🌬️','💨','🌪️','🌫️','🌊','💧','💦','🫧',
      '✅','☑️','✔️','❎','❌','🚫','⛔','📛','🔴','🟠',
      '🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷','🔸',
      '🔹','🔺','🔻','💠','🔘','🔲','🔳','⬛','⬜','🟥',
    ],
  },
]

let btn        = null
let panel      = null
let activeIdx  = 0

export function initEmojiPicker() {
  if (document.getElementById('emoji-btn')) return  // already in DOM
  _build()
}

// ─────────────────────────────────────────────────────────
function _build() {
  btn = document.createElement('button')
  btn.type      = 'button'
  btn.id        = 'emoji-btn'
  btn.title     = 'แทรกอีโมจิ'
  btn.textContent = '😊'

  // ── Panel scaffold ───────────────────────────────────────
  panel = document.createElement('div')
  panel.className = 'emoji-panel hidden'

  // Category tab bar
  const catBar = document.createElement('div')
  catBar.className = 'emoji-cat-bar'

  CATEGORIES.forEach((cat, i) => {
    const catBtn = document.createElement('button')
    catBtn.type      = 'button'
    catBtn.className = 'emoji-cat-btn' + (i === 0 ? ' active' : '')
    catBtn.textContent = cat.icon
    catBtn.title     = cat.label
    catBtn.dataset.idx = i
    catBtn.addEventListener('click', e => {
      e.stopPropagation()
      _switchCat(i)
    })
    catBar.appendChild(catBtn)
  })
  panel.appendChild(catBar)

  // Category label
  const catLabel = document.createElement('div')
  catLabel.className = 'emoji-cat-label'
  catLabel.id        = 'emoji-cat-label'
  catLabel.textContent = CATEGORIES[0].label
  panel.appendChild(catLabel)

  // Emoji grid (swapped out per category)
  const grid = document.createElement('div')
  grid.className = 'emoji-grid'
  grid.id        = 'emoji-grid'
  panel.appendChild(grid)

  document.body.appendChild(panel)   // must be in DOM before _renderGrid queries it
  _renderGrid(0)

  // Insert emoji button into form before color button
  const form     = document.getElementById('message-form')
  const colorBtn = document.getElementById('color-btn')
  form.insertBefore(btn, colorBtn ?? document.getElementById('send-btn'))

  // Toggle panel
  btn.addEventListener('click', e => {
    e.stopPropagation()
    const isHidden = panel.classList.contains('hidden')
    panel.classList.toggle('hidden')
    if (isHidden) {
      const r         = btn.getBoundingClientRect()
      const spaceAbove = r.top - 16
      const isMobile  = window.innerWidth <= 640

      panel.style.top    = 'auto'
      panel.style.bottom = `${window.innerHeight - r.top + 8}px`

      if (isMobile) {
        panel.style.left      = '8px'
        panel.style.right     = '8px'
        panel.style.width     = 'auto'
        panel.style.maxHeight = `${Math.min(spaceAbove, window.innerHeight * 0.65)}px`
      } else {
        panel.style.left      = 'auto'
        panel.style.right     = `${window.innerWidth - r.right}px`
        panel.style.width     = '310px'
        panel.style.maxHeight = `${Math.min(spaceAbove, 400)}px`
      }
    }
  })

  document.addEventListener('click', () => panel.classList.add('hidden'))
  panel.addEventListener('click', e => e.stopPropagation())
}

function _switchCat(idx) {
  activeIdx = idx
  // Update tab highlights
  panel.querySelectorAll('.emoji-cat-btn').forEach((b, i) =>
    b.classList.toggle('active', i === idx)
  )
  document.getElementById('emoji-cat-label').textContent = CATEGORIES[idx].label
  _renderGrid(idx)
}

function _renderGrid(idx) {
  const grid = document.getElementById('emoji-grid')
  grid.innerHTML = ''
  for (const emoji of CATEGORIES[idx].emojis) {
    const b = document.createElement('button')
    b.type        = 'button'
    b.className   = 'emoji-item'
    b.textContent = emoji
    b.addEventListener('click', () => _insert(emoji))
    grid.appendChild(b)
  }
}

function _insert(emoji) {
  const input = document.getElementById('message-input')
  if (!input) return
  const start = input.selectionStart ?? input.value.length
  const end   = input.selectionEnd   ?? input.value.length
  input.value = input.value.slice(0, start) + emoji + input.value.slice(end)
  const pos   = start + emoji.length
  input.setSelectionRange(pos, pos)
  input.focus()
  input.dispatchEvent(new Event('input'))
}
