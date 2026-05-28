const errorMsgEl    = document.getElementById('error-msg')
const adminToggleBtn = document.getElementById('admin-toggle')
const adminKeyGroup  = document.getElementById('admin-key-group')
export const adminkeyInput  = document.getElementById('adminkey-input')
export const nicknameInput  = document.getElementById('nickname-input')
export const joinBtn        = document.getElementById('join-btn')

// Toggle admin-key input visibility
adminToggleBtn.addEventListener('click', () => {
  const hidden = adminKeyGroup.classList.toggle('hidden')
  if (!hidden) adminkeyInput.focus()
  else         adminkeyInput.value = ''
})

export function showError(msg) {
  errorMsgEl.textContent = msg
  errorMsgEl.classList.toggle('hidden', !msg)
}

export function setJoinLoading(loading) {
  joinBtn.disabled    = loading
  joinBtn.textContent = loading ? 'กำลังเชื่อมต่อ...' : 'เข้าร่วม'
}

export function resetLoginForm() {
  nicknameInput.value = ''
  adminkeyInput.value = ''
  adminKeyGroup.classList.add('hidden')
  showError('')
  setJoinLoading(false)
}
