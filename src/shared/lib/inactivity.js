import { forceLogout } from './auth.js'

const INACTIVITY_MS = 10 * 60 * 1000
const ACTIVITY_KEY  = '_jb_last_activity'

let _timer = null

function _markActivity() {
  sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()))
  _reschedule()
}

function _reschedule() {
  clearTimeout(_timer)
  _timer = setTimeout(() => forceLogout(false), INACTIVITY_MS)
}

function _checkOnVisible() {
  const last = Number(sessionStorage.getItem(ACTIVITY_KEY) || 0)
  if (last && Date.now() - last > INACTIVITY_MS) {
    forceLogout(false)
  } else {
    _reschedule()
  }
}

const EVENTS = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll']

export function startInactivityWatcher() {
  _markActivity()

  EVENTS.forEach(e => window.addEventListener(e, _markActivity, { passive: true }))

  function onVisibility() {
    if (document.visibilityState === 'visible') {
      _checkOnVisible()
    } else {
      // Ekran o'chdi / lock — timerni to'xtat, timestamp sessionStorageda qoladi
      clearTimeout(_timer)
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    clearTimeout(_timer)
    EVENTS.forEach(e => window.removeEventListener(e, _markActivity))
    document.removeEventListener('visibilitychange', onVisibility)
    sessionStorage.removeItem(ACTIVITY_KEY)
  }
}
