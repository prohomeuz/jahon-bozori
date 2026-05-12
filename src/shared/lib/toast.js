let _listeners = []
let _toasts = []
let _nextId = 1
let _lastNetworkAt = 0

export function showToast(message, type = 'error', duration = 4500) {
  const id = _nextId++
  _toasts = [..._toasts, { id, message, type }]
  _notify()
  if (duration > 0) setTimeout(() => dismissToast(id), duration)
  return id
}

export function dismissToast(id) {
  _toasts = _toasts.filter(t => t.id !== id)
  _notify()
}

export function subscribeToasts(fn) {
  _listeners = [..._listeners, fn]
  fn(_toasts)
  return () => { _listeners = _listeners.filter(l => l !== fn) }
}

// Debounced — backend o'chiq bo'lsa har bir query uchun alohida toast chiqmasin
export function networkErrorToast() {
  const now = Date.now()
  if (now - _lastNetworkAt < 5000) return
  _lastNetworkAt = now
  showToast("Server bilan aloqa yo'q. Internet yoki serverni tekshiring.", 'error', 5000)
}

function _notify() {
  _listeners.forEach(fn => fn(_toasts))
}
