const TOKEN_KEY = 'jb_token'

export function getToken() { return localStorage.getItem(TOKEN_KEY) }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t) }
export function removeToken() { localStorage.removeItem(TOKEN_KEY) }

export function getUser() {
  const t = getToken()
  if (!t) return null
  try { return JSON.parse(atob(t.split('.')[1])) } catch { return null }
}

const EXTRA_HEADERS = { 'ngrok-skip-browser-warning': '1' }

export function apiFetch(url, options = {}) {
  const token = getToken()
  return fetch(url, {
    ...options,
    headers: {
      ...EXTRA_HEADERS,
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
