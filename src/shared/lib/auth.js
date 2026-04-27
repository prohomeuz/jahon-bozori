const TOKEN_KEY   = 'jb_token'
const REFRESH_KEY = 'jb_refresh'

export function getToken()        { return sessionStorage.getItem(TOKEN_KEY) }
export function setToken(t)       { sessionStorage.setItem(TOKEN_KEY, t) }
export function getRefreshToken() { return sessionStorage.getItem(REFRESH_KEY) }
export function setRefreshToken(t){ sessionStorage.setItem(REFRESH_KEY, t) }

export function removeToken() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
}

export function getUser() {
  const t = getToken()
  if (!t) return null
  try { return JSON.parse(atob(t.split('.')[1])) } catch { return null }
}

// accessToken muddati tugashiga 60 sekund qolganini tekshiradi
function isTokenExpiredSoon(token) {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1]))
    return !exp || exp - Math.floor(Date.now() / 1000) < 60
  } catch { return true }
}

let _refreshPromise = null

async function doRefresh() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new Error('no_refresh')

  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw Object.assign(new Error(data.error ?? 'refresh_failed'), { code: data.error, status: res.status })
  }

  const data = await res.json()
  setToken(data.token)
  if (data.refreshToken) setRefreshToken(data.refreshToken)
  return data.token
}

// Parallel refresh'larni birlaydi
async function refreshOnce() {
  if (!_refreshPromise) {
    _refreshPromise = doRefresh().finally(() => { _refreshPromise = null })
  }
  return _refreshPromise
}

export function forceLogout(outsideHours = false) {
  removeToken()
  const url = '/admin/login'
  const state = outsideHours ? '?reason=outside_hours' : ''
  // history API orqali redirect — React Router state bilan
  window.dispatchEvent(new CustomEvent('auth:logout', { detail: { outsideHours } }))
  window.location.href = url + state
}

export async function apiFetch(url, options = {}) {
  let token = getToken()

  // Token muddati tugashiga yaqin bo'lsa — avval yangilab ol
  if (token && isTokenExpiredSoon(token)) {
    try { token = await refreshOnce() } catch { /* refresh bajariladi retry'da */ }
  }

  const makeHeaders = (t) => ({
    ...options.headers,
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  })

  const res = await fetch(url, { ...options, headers: makeHeaders(token) })

  // 403 OUTSIDE_HOURS — ish vaqti tugagan, darhol chiqar
  if (res.status === 403) {
    const clone = res.clone()
    const data = await clone.json().catch(() => ({}))
    if (data.error === 'OUTSIDE_HOURS') {
      forceLogout(true)
      throw new Error('outside_hours')
    }
    return res
  }

  // 401 kelsa — bir marta refresh urinib, qayta so'rov
  if (res.status === 401) {
    try {
      token = await refreshOnce()
      return fetch(url, { ...options, headers: makeHeaders(token) })
    } catch {
      forceLogout(false)
      throw new Error('session_expired')
    }
  }

  return res
}
