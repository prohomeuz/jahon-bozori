import { useState, useEffect, useRef, useMemo, memo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import swipeHandImg from '@/assets/swipe-hand.png'
import { A_RECT_OVERLAYS } from '@/pages/bolim/config/aRectOverlays'
import { A_FLOOR2_RECT_OVERLAYS } from '@/pages/bolim/config/aFloor2RectOverlays'
import { B_RECT_OVERLAYS } from '@/pages/bolim/config/bRectOverlays'
import { B_FLOOR2_RECT_OVERLAYS } from '@/pages/bolim/config/bFloor2RectOverlays'
import { C_RECT_OVERLAYS } from '@/pages/bolim/config/cRectOverlays'
import { C_FLOOR2_RECT_OVERLAYS } from '@/pages/bolim/config/cFloor2RectOverlays'

const aImg1 = import.meta.glob('@/assets/blocks/A/1/*.webp', { eager: true })
const aImg2 = import.meta.glob('@/assets/blocks/A/2/*.webp', { eager: true })
const bImg1 = import.meta.glob('@/assets/blocks/B/1/*.webp', { eager: true })
const bImg2 = import.meta.glob('@/assets/blocks/B/2/*.webp', { eager: true })
const cImg1 = import.meta.glob('@/assets/blocks/C/1/*.webp', { eager: true })
const cImg2 = import.meta.glob('@/assets/blocks/C/2/*.webp', { eager: true })

const IMG_MAPS = { A: [aImg1, aImg2], B: [bImg1, bImg2], C: [cImg1, cImg2] }

// Module-level image cache — sahifa davomida saqlanadi
const _imgCache = new Set()
function preloadImg(src) {
  if (!src || _imgCache.has(src)) return Promise.resolve()
  return new Promise(resolve => {
    const img = new Image()
    img.onload = img.onerror = () => { _imgCache.add(src); resolve() }
    img.src = src
  })
}
const OVERLAYS = {
  A: [A_RECT_OVERLAYS, A_FLOOR2_RECT_OVERLAYS],
  B: [B_RECT_OVERLAYS, B_FLOOR2_RECT_OVERLAYS],
  C: [C_RECT_OVERLAYS, C_FLOOR2_RECT_OVERLAYS],
}

function getImg(block, floor, bolim) {
  const map = IMG_MAPS[block]?.[floor - 1] ?? {}
  const entry = Object.entries(map).find(([k]) => k.split('/').pop().split('.')[0] === String(bolim))
  return entry?.[1]?.default ?? null
}
function getOverlay(block, floor, bolim) {
  return OVERLAYS[block]?.[floor - 1]?.[bolim] ?? null
}

const S_FILL   = { EMPTY: 'rgba(34,197,94,0.50)', RESERVED: 'rgba(234,179,8,0.65)', SOLD: 'rgba(239,68,68,0.60)', NOT_SALE: 'rgba(156,163,175,0.50)' }
const S_STROKE = { EMPTY: '#15803d', RESERVED: '#854d0e', SOLD: '#b91c1c', NOT_SALE: '#6b7280' }
const BLOCKS   = ['A', 'B', 'C']
const DURATION = 15_000
const LEGEND = [
  { c: '#22c55e', l: "Bo'sh",      k: 'EMPTY'    },
  { c: '#eab308', l: 'Bron',       k: 'RESERVED' },
  { c: '#ef4444', l: 'Sotilgan',   k: 'SOLD'     },
  { c: '#9ca3af', l: 'Sotilmaydi', k: 'NOT_SALE' },
]

const ZoomablePane = memo(function ZoomablePane({ children, zoomingRef }) {
  const containerRef = useRef(null)
  const innerRef     = useRef(null)
  const scaleRef     = useRef(1)
  const txRef        = useRef(0)
  const tyRef        = useRef(0)
  const pinchRef     = useRef(null)
  const panRef       = useRef(null)
  // getBoundingClientRect reflow'dan qochish uchun gesture boshida bir marta o'lchaymiz
  const sizeRef      = useRef({ w: 0, h: 0 })

  function applyTransform(transition) {
    if (!innerRef.current) return
    if (transition) innerRef.current.style.transition = transition
    else if (innerRef.current.style.transition) innerRef.current.style.transition = ''
    innerRef.current.style.transform = `translate(${txRef.current}px,${tyRef.current}px) scale(${scaleRef.current})`
  }

  function clamp(s, tx, ty) {
    const { w, h } = sizeRef.current
    const mx = (w * (s - 1)) / 2
    const my = (h * (s - 1)) / 2
    return { tx: Math.max(-mx, Math.min(mx, tx)), ty: Math.max(-my, Math.min(my, ty)) }
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onStart(e) {
      if (e.touches.length === 2) {
        e.stopPropagation()
        if (zoomingRef) zoomingRef.current = true
        // Faqat shu yerda bir marta layout o'lchaymiz
        const rect = el.getBoundingClientRect()
        sizeRef.current = { w: rect.width, h: rect.height }
        if (innerRef.current) innerRef.current.style.willChange = 'transform'
        const [a, b] = e.touches
        pinchRef.current = {
          d0:  Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
          s0:  scaleRef.current,
          tx0: txRef.current,
          ty0: tyRef.current,
          mx0: (a.clientX + b.clientX) / 2,
          my0: (a.clientY + b.clientY) / 2,
        }
        panRef.current = null
      } else if (e.touches.length === 1 && scaleRef.current > 1.05) {
        e.stopPropagation()
        const rect = el.getBoundingClientRect()
        sizeRef.current = { w: rect.width, h: rect.height }
        if (innerRef.current) innerRef.current.style.willChange = 'transform'
        panRef.current = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, tx0: txRef.current, ty0: tyRef.current }
      }
    }

    function onMove(e) {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        e.stopPropagation()
        const [a, b] = e.touches
        const { d0, s0, tx0, ty0, mx0, my0 } = pinchRef.current
        const newS = Math.max(1, Math.min(5, s0 * Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY) / d0))
        const { tx, ty } = clamp(newS, tx0 + (a.clientX + b.clientX) / 2 - mx0, ty0 + (a.clientY + b.clientY) / 2 - my0)
        scaleRef.current = newS; txRef.current = tx; tyRef.current = ty
        applyTransform()
      } else if (e.touches.length === 1 && panRef.current) {
        e.stopPropagation()
        const { x0, y0, tx0, ty0 } = panRef.current
        const { tx, ty } = clamp(scaleRef.current, tx0 + e.touches[0].clientX - x0, ty0 + e.touches[0].clientY - y0)
        txRef.current = tx; tyRef.current = ty
        applyTransform()
      }
    }

    function onEnd(e) {
      if (e.touches.length < 2) pinchRef.current = null
      if (e.touches.length === 0) {
        panRef.current = null
        // zoomingRef ni bu yerda EMAS, outer onTouchEnd tozalaydi.
        // Aks holda outer ishlagunga qadar false bo'lib qoladi va swipe o'tib ketadi.
        if (scaleRef.current < 1.05) {
          scaleRef.current = 1; txRef.current = 0; tyRef.current = 0
          applyTransform('transform 0.2s ease')
          setTimeout(() => {
            if (innerRef.current) {
              innerRef.current.style.transition = ''
              innerRef.current.style.willChange = ''
            }
          }, 220)
        } else {
          if (innerRef.current) innerRef.current.style.willChange = ''
        }
      }
    }

    el.addEventListener('touchstart',  onStart, { passive: false })
    el.addEventListener('touchmove',   onMove,  { passive: false })
    el.addEventListener('touchend',    onEnd)
    el.addEventListener('touchcancel', onEnd)   // call/notif kelganda ham reset
    return () => {
      el.removeEventListener('touchstart',  onStart)
      el.removeEventListener('touchmove',   onMove)
      el.removeEventListener('touchend',    onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative h-full overflow-hidden" style={{ touchAction: 'none' }}>
      <div ref={innerRef} className="h-full" style={{ transformOrigin: 'center center' }}>
        {children}
      </div>
    </div>
  )
})

// memo: aptMap o'zgarmasa qayta render bo'lmaydi
const OverlayPane = memo(function OverlayPane({ src, overlay, aptMap }) {
  return (
    <div className="relative h-full overflow-hidden" style={{
      backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
      backgroundSize: '16px 16px',
      backgroundColor: 'white',
    }}>
      {src && (
        <img src={src} alt="" draggable={false}
          className="absolute inset-0 w-full h-full object-contain select-none" />
      )}
      {overlay && (
        <svg viewBox={overlay.viewBox} preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full pointer-events-none">
          {overlay.rects.map((r) => {
            const status = aptMap[r.id.split('-').pop()]?.status ?? 'UNKNOWN'
            const fill   = S_FILL[status]   ?? 'rgba(120,120,120,0.22)'
            const stroke = S_STROKE[status] ?? '#999'
            const s = { fill, stroke, strokeWidth: 4, transition: 'fill 0.6s ease, stroke 0.6s ease' }
            return r.d
              ? <path key={r.id} d={r.d} style={s} />
              : <rect key={r.id} x={r.x} y={r.y} width={r.width} height={r.height} style={s} />
          })}
        </svg>
      )}
    </div>
  )
})

function useLiveRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const ctrl = new AbortController()
    let stopped = false
    let delay = 2_000
    async function connect() {
      try {
        const res = await fetch('/api/live/events', { signal: ctrl.signal })
        if (!res.ok || !res.body) return
        delay = 2_000 // muvaffaqiyatli ulanishda reset
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const parts = buf.split('\n\n')
          buf = parts.pop()
          for (const part of parts) {
            const ev  = part.match(/^event: (.+)/m)?.[1]
            const raw = part.match(/^data: (.+)/m)?.[1]
            if (!raw || ev !== 'apartment') continue
            try {
              const { id, status } = JSON.parse(raw)
              const [block, bolimStr] = id.split('-')
              const bolim = parseInt(bolimStr)
              for (const floor of [1, 2]) {
                qc.setQueryData(['apartments', block, bolim, floor], (old) =>
                  old ? old.map(a => a.address === id ? { ...a, status } : a) : old
                )
              }
            } catch {} // noto'g'ri JSON — bu eventni o'tkazib yuboramiz
          }
        }
      } catch (err) {
        if (ctrl.signal.aborted) return
        delay = Math.min(delay * 2, 30_000) // exponential backoff, max 30s
      }
    }
    ;(async () => { while (!stopped) { await connect(); if (!stopped) await new Promise(r => setTimeout(r, delay)) } })()
    return () => { stopped = true; ctrl.abort() }
  }, [qc])
}

export default function LivePage() {
  const bolimOpts = (block) => ({
    queryKey: ['bolims', block],
    queryFn: () => fetch(`/api/bolims?block=${block}`).then(r => { if (!r.ok) throw new Error(r.status); return r.json() }),
    staleTime: Infinity,
    retry: 3,
    retryDelay: (n) => Math.min(1000 * 2 ** n, 10_000),
  })
  const { data: bA = [], isError: errA, refetch: refetchA } = useQuery(bolimOpts('A'))
  const { data: bB = [], isError: errB, refetch: refetchB } = useQuery(bolimOpts('B'))
  const { data: bC = [], isError: errC, refetch: refetchC } = useQuery(bolimOpts('C'))

  const slides = useMemo(() => [
    ...bA.map(b => ({ block: 'A', bolim: b })),
    ...bB.map(b => ({ block: 'B', bolim: b })),
    ...bC.map(b => ({ block: 'C', bolim: b })),
  ], [bA, bB, bC])

  const [idx,           setIdx]         = useState(() => parseInt(sessionStorage.getItem('live_idx') ?? '0'))
  const [tick,          setTick]        = useState(0)
  const [dir,           setDir]         = useState('right')
  const [paused,        setPaused]      = useState(() => sessionStorage.getItem('live_paused') === '1')
  const [showPicker,    setShowPicker]  = useState(false)
  const [pickerClosing, setPickerClosing] = useState(false)
  const [pickerBlock,   setPickerBlock] = useState('A')
  const [swipeHint,     setSwipeHint]   = useState(() => !sessionStorage.getItem('live_hinted'))

  useEffect(() => {
    if (!swipeHint) return
    const t = setTimeout(() => {
      setSwipeHint(false)
      sessionStorage.setItem('live_hinted', '1')
    }, 4500)
    return () => clearTimeout(t)
  }, [swipeHint])

  const safeIdx = slides.length ? idx % slides.length : 0
  const cur     = slides[safeIdx]

  function go(next, direction = 'right') {
    if (!slides.length) return
    const newIdx = (next + slides.length) % slides.length
    sessionStorage.setItem('live_idx', String(newIdx))
    setDir(direction)
    setIdx(newIdx)
    setTick(t => t + 1)
  }

  // ── TIMER (wall-clock based, DOM direct mutation, no re-render) ──
  const _savedElapsed = paused ? parseInt(sessionStorage.getItem('live_timer_elapsed') ?? '0') : 0
  const timerStartRef = useRef(Date.now() - _savedElapsed) // effective start (paused time excluded)
  const userPausedAt  = useRef(paused ? Date.now() : null) // user pause timestamp
  const touchPausedAt = useRef(null)                        // touch pause timestamp (separate!)
  const initialDelay  = useRef(paused ? `-${(_savedElapsed / 1000).toFixed(2)}s` : '0s')
  const ringRef       = useRef(null)    // ref callback tufayli har tick fresh elementni ko'rsatadi
  const touchingRef   = useRef(false)
  const touchX        = useRef(null)
  const zoomingRef    = useRef(false)   // ZoomablePane pinch faol bo'lsa true

  // Slide o'zgarganda — timer qayta boshlanadi
  useEffect(() => {
    timerStartRef.current = Date.now()
    userPausedAt.current  = paused ? Date.now() : null
    touchPausedAt.current = null
  }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps

  // User pause/unpause
  useEffect(() => {
    if (paused) {
      userPausedAt.current = Date.now()
    } else if (userPausedAt.current !== null) {
      timerStartRef.current += Date.now() - userPausedAt.current
      userPausedAt.current = null
    }
  }, [paused])


  // Auto-advance
  useEffect(() => {
    if (!slides.length || paused) return
    const t = setTimeout(() => {
      if (touchingRef.current) return // touch tugaganda onTouchEnd hal qiladi
      go(safeIdx + 1, 'right')
    }, DURATION - 200)
    return () => clearTimeout(t)
  }, [safeIdx, slides.length, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // Touch handlers
  function onTouchStart(e) {
    if (showPicker) return
    // 2-barmoq pinch boshlanganda swipe tracking bekor
    if (e.touches.length > 1) {
      touchX.current = null
      return
    }
    touchX.current = e.touches[0].clientX
    touchingRef.current = true
    if (!paused) {
      touchPausedAt.current = Date.now()
      if (ringRef.current) ringRef.current.style.animationPlayState = 'paused'
    }
  }
  function onTouchEnd(e) {
    if (showPicker) return
    // Zoom gesture — swipe o'tkazib yuboramiz; oxirgi barmoq ko'tarilganda state tozalanadi
    if (zoomingRef.current) {
      if (e.touches.length === 0) {
        zoomingRef.current = false   // shu yerda tozalanadi, ZoomablePane emas
        touchX.current = null
        touchingRef.current = false
        if (!paused && touchPausedAt.current !== null) {
          timerStartRef.current += Date.now() - touchPausedAt.current
          touchPausedAt.current = null
          if (ringRef.current) ringRef.current.style.animationPlayState = 'running'
        }
      }
      return
    }

    touchingRef.current = false
    let timerExpired = false

    if (!paused && touchPausedAt.current !== null) {
      const touchDur = Date.now() - touchPausedAt.current
      timerStartRef.current += touchDur
      touchPausedAt.current = null
      if (ringRef.current) ringRef.current.style.animationPlayState = 'running'
      if (Date.now() - timerStartRef.current >= DURATION - 200) timerExpired = true
    }

    const startX = touchX.current
    touchX.current = null

    if (timerExpired) {
      go(safeIdx + 1, 'right')
      return
    }
    if (startX === null || !slides.length) return
    const dx = e.changedTouches[0].clientX - startX
    if (Math.abs(dx) < 50) return
    go(dx < 0 ? safeIdx + 1 : safeIdx - 1, dx < 0 ? 'right' : 'left')
  }

  function onTouchCancel() {
    // Call, notifikatsiya yoki boshqa system interrupt — barcha touch state reset
    touchX.current = null
    touchingRef.current = false
    zoomingRef.current = false
    if (!paused && touchPausedAt.current !== null) {
      timerStartRef.current += Date.now() - touchPausedAt.current
      touchPausedAt.current = null
      if (ringRef.current) ringRef.current.style.animationPlayState = 'running'
    }
  }

  function togglePause(e) {
    e.stopPropagation()
    setPaused(p => {
      const next = !p
      sessionStorage.setItem('live_paused', next ? '1' : '0')
      if (next) {
        const elapsed = Date.now() - timerStartRef.current
        sessionStorage.setItem('live_timer_elapsed', String(elapsed))
      }
      return next
    })
  }

  useLiveRealtime()

  const aptOpts = (floor) => ({
    queryKey: ['apartments', cur?.block, cur?.bolim, floor],
    queryFn:  () => fetch(`/api/apartments?block=${cur.block}&bolim=${cur.bolim}&floor=${floor}`).then(r => r.json()),
    enabled:  !!cur,
    staleTime: 60_000,
  })
  const { data: apts1 = [] } = useQuery(aptOpts(1))
  const { data: apts2 = [] } = useQuery(aptOpts(2))

  const map1   = useMemo(() => Object.fromEntries(apts1.map(a => [a.address.split('-').pop(), a])), [apts1])
  const map2   = useMemo(() => Object.fromEntries(apts2.map(a => [a.address.split('-').pop(), a])), [apts2])
  const counts = useMemo(() => {
    const all = [...apts1, ...apts2]
    return Object.fromEntries(LEGEND.map(({ k }) => [k, all.filter(a => a.status === k).length]))
  }, [apts1, apts2])

  const src1 = cur ? getImg(cur.block, 1, cur.bolim) : null
  const src2 = cur ? getImg(cur.block, 2, cur.bolim) : null
  const ov1  = cur ? getOverlay(cur.block, 1, cur.bolim) : null
  const ov2  = cur ? getOverlay(cur.block, 2, cur.bolim) : null

  // Joriy slide rasmlari tayyor bo'lguncha spinner
  const [imgReady, setImgReady] = useState(false)
  useEffect(() => {
    const srcs = [src1, src2].filter(Boolean)
    if (!srcs.length) { setImgReady(true); return }
    if (srcs.every(s => _imgCache.has(s))) { setImgReady(true); return }
    setImgReady(false)
    let live = true
    Promise.all(srcs.map(preloadImg)).then(() => { if (live) setImgReady(true) })
    return () => { live = false }
  }, [src1, src2])

  // Qo'shni slidlarni background preload — optimistic UI
  useEffect(() => {
    if (!slides.length) return
    for (const offset of [1, -1]) {
      const adj = slides[(safeIdx + offset + slides.length) % slides.length]
      for (const floor of [1, 2]) preloadImg(getImg(adj.block, floor, adj.bolim))
    }
  }, [safeIdx, slides.length])

  const apiError = (errA || errB || errC) && !slides.length
  if (apiError) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-3 px-8">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span className="text-gray-800 text-base font-bold text-center">Ma'lumot yuklanmadi</span>
        <span className="text-gray-400 text-sm text-center">Internet aloqasini tekshiring</span>
        <button
          onClick={() => { refetchA(); refetchB(); refetchC() }}
          className="mt-2 px-6 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl active:bg-gray-700 transition-colors"
        >
          Qayta urinish
        </button>
      </div>
    )
  }

  if (!slides.length) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <span className="text-gray-400 text-sm font-medium">Yuklanmoqda...</span>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 flex flex-col bg-white overflow-hidden select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      {/* ── TOP BANNER — faqat info ── */}
      <div className="shrink-0 flex items-center justify-center gap-2 px-4 py-4 bg-gray-100">
        <span className="font-black text-[20px] tracking-widest text-gray-800 leading-none uppercase">{cur?.block} BLOK</span>
        <span className="text-gray-300 text-[20px] font-light leading-none select-none">·</span>
        <span className="font-black text-[20px] tracking-widest text-gray-800 leading-none uppercase tabular-nums">{cur?.bolim}-BO'LIM</span>
      </div>

      {/* ── KONTENT ── labellar statik, faqat rasmlar animatsiyalanadi */}
      <div className="flex flex-col flex-1 min-h-0 relative">

        {/* Rasm yuklanguncha spinner — overlay va dotted bg ko'rinmasin */}
        {!imgReady && (
          <div className="absolute inset-0 z-10 bg-white flex items-center justify-center">
            <svg className="animate-spin w-8 h-8" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="#e5e7eb" strokeWidth="4"/>
              <path d="M24 4a20 20 0 0 1 20 20" stroke="#374151" strokeWidth="4" strokeLinecap="round"/>
            </svg>
          </div>
        )}

        {/* Swipe hint — faqat birinchi marta */}
        {swipeHint && (
          <div className="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center gap-4 swipe-hint" style={{ background: 'rgba(0,0,0,0.55)' }}>
            {/* Qo'l + harakat */}
            <div className="swipe-hand flex items-center gap-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              <img src={swipeHandImg} alt="" width={52} height={52} style={{ filter: 'invert(1)', userSelect: 'none' }} draggable={false} />
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
            {/* Matn */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-white font-black text-lg tracking-wide">Chapga yoki o'ngga suring</span>
              <span className="text-white/70 text-sm font-medium">Bo'limlar o'rtasida o'tish uchun</span>
            </div>
          </div>
        )}

        {/* 1-qavat label — statik */}
        <div className="shrink-0 flex items-center gap-2 px-4 pt-4 pb-1">
          <span className="text-xs font-black text-gray-600 uppercase tracking-[0.22em]">1-QAVAT</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* Floor 1 — animatsiyalanadi */}
        <div key={`${safeIdx}-f1`} className={`flex-1 min-h-0 px-3 ${dir === 'left' ? 'live-slide-in-left' : 'live-slide-in-right'}`}>
          <ZoomablePane zoomingRef={zoomingRef}>
            <OverlayPane src={src1} overlay={ov1} aptMap={map1} />
          </ZoomablePane>
        </div>

        {src2 && (
          <>
            {/* 2-qavat label — statik */}
            <div className="shrink-0 flex items-center gap-2 px-4 pt-2 pb-1">
              <span className="text-xs font-black text-gray-600 uppercase tracking-[0.22em]">2-QAVAT</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Floor 2 — animatsiyalanadi */}
            <div key={`${safeIdx}-f2`} className={`flex-1 min-h-0 px-3 ${dir === 'left' ? 'live-slide-in-left' : 'live-slide-in-right'}`}>
              <ZoomablePane zoomingRef={zoomingRef}>
                <OverlayPane src={src2} overlay={ov2} aptMap={map2} />
              </ZoomablePane>
            </div>
          </>
        )}
      </div>

      {/* ── BOTTOM BAR ── */}
      <div className="shrink-0 bg-white">
        {/* Legend — border-t bilan birlashgan, full-width, no radius */}
        <div className="grid grid-cols-2 border-t border-gray-200">
          {LEGEND.map(({ c, l, k }, i) => (
            <div key={k} className={`flex items-center justify-center gap-2 py-3 ${i % 2 === 0 ? 'border-r border-gray-200' : ''} ${i < 2 ? 'border-b border-gray-200' : ''}`} style={{ opacity: (counts[k] ?? 0) > 0 ? 1 : 0.25 }}>
              <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: c }} />
              <span className="text-sm font-black text-gray-900 leading-none tabular-nums">{counts[k] ?? 0}</span>
              <span className="text-sm text-gray-500 font-medium leading-none">{l}</span>
            </div>
          ))}
        </div>

        {/* Controls: [picker | mr-auto] [← arrow] [timer] [→ arrow] */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-4">

          {/* Picker — chapda, mr-auto */}
          <button
            onClick={() => { setPickerBlock(cur?.block ?? 'A'); setPickerClosing(false); setShowPicker(true) }}
            className="w-14 h-14 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors mr-auto"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
          </button>

          {/* Chap arrow */}
          <button onClick={() => go(safeIdx - 1, 'left')} className="w-14 h-14 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>

          {/* Ring timer — 2 arrow o'rtasida, arrow bilan bir o'lcham */}
          <button onClick={togglePause} className="relative w-14 h-14 rounded-full active:bg-gray-100 transition-colors">
            <svg key={tick} width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="28" cy="28" r="26" fill="none" stroke="#d1d5db" strokeWidth="4" />
              <circle ref={(el) => {
                ringRef.current = el
                if (el && touchingRef.current && !paused) el.style.animationPlayState = 'paused'
              }} cx="28" cy="28" r="26" fill="none" stroke="#374151" strokeWidth="4"
                strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 26}`}
                className="live-ring" style={{
                  animationPlayState: paused ? 'paused' : 'running',
                  animationDelay: tick === 0 ? initialDelay.current : '0s',
                }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {paused
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151"><path d="M8 5v14l11-7z"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="#374151"><rect x="5" y="4" width="4" height="16" rx="1.5"/><rect x="15" y="4" width="4" height="16" rx="1.5"/></svg>}
            </div>
          </button>

          {/* O'ng arrow */}
          <button onClick={() => go(safeIdx + 1, 'right')} className="w-14 h-14 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── PICKER SHEET ── */}
      {showPicker && (
        <>
          <div
            className="absolute inset-0 z-20 bg-black/30"
            style={{ animation: pickerClosing ? 'sheet-backdrop-out 0.28s ease both' : undefined }}
            onClick={() => { setPickerClosing(true); setTimeout(() => setShowPicker(false), 280) }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-2xl shadow-2xl"
            style={{ animation: pickerClosing ? 'sheet-slide-down 0.28s cubic-bezier(0.4,0,0.2,1) both' : 'sheet-slide-up 0.32s cubic-bezier(0.4,0,0.2,1) both' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Blok tanlash */}
            <div className="border-b border-gray-100">
              <p className="text-[11px] font-black text-gray-500 tracking-[0.18em] uppercase px-5 pt-3 pb-2">Blok</p>
              <div className="flex">
                {BLOCKS.map((block, i) => (
                  <button
                    key={block}
                    onClick={() => setPickerBlock(block)}
                    className={`flex-1 py-3.5 text-xl font-mono font-bold tracking-wider transition-colors border-t-2 ${
                      i > 0 ? 'border-l border-gray-200' : ''
                    } ${
                      pickerBlock === block
                        ? 'border-t-gray-900 text-gray-900 bg-gray-200'
                        : 'border-t-transparent text-gray-400 bg-white active:bg-gray-100'
                    }`}
                  >
                    {block}
                  </button>
                ))}
              </div>
            </div>

            {/* Bo'lim tanlash */}
            <div className="pb-6">
              <p className="text-[11px] font-black text-gray-500 tracking-[0.18em] uppercase px-5 pt-3 pb-2">Bo'lim</p>
              {(() => {
                const bolimlar = pickerBlock === 'A' ? bA : pickerBlock === 'B' ? bB : bC
                const rows = []
                for (let i = 0; i < bolimlar.length; i += 5) rows.push(bolimlar.slice(i, i + 5))
                return rows.map((row, ri) => (
                  <div key={ri} className={`flex ${ri > 0 ? 'border-t border-gray-100' : ''}`}>
                    {row.map((bolim, ci) => {
                      const slideI = slides.findIndex(s => s.block === pickerBlock && s.bolim === bolim)
                      const isActive = slideI === safeIdx
                      return (
                        <button
                          key={bolim}
                          onClick={() => { setPickerClosing(true); setTimeout(() => { setShowPicker(false); go(slideI, slideI >= safeIdx ? 'right' : 'left') }, 280) }}
                          className={`flex-1 py-4 text-base font-mono font-bold transition-colors ${
                            ci > 0 ? 'border-l border-gray-200' : ''
                          } ${isActive ? 'text-gray-900 bg-gray-200' : 'text-gray-500 active:bg-gray-100'}`}
                          style={isActive ? { borderBottom: '2px solid #111827' } : {}}
                        >
                          {bolim}
                        </button>
                      )
                    })}
                  </div>
                ))
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
