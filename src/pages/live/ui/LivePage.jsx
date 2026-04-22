import { useState, useEffect, useRef, useMemo, memo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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

// memo: aptMap o'zgarmasa qayta render bo'lmaydi
const OverlayPane = memo(function OverlayPane({ src, overlay, aptMap }) {
  return (
    <div className="relative h-full overflow-hidden bg-white">
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
    async function connect() {
      try {
        const res = await fetch('/api/live/events', { signal: ctrl.signal })
        if (!res.ok || !res.body) return
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
            const { id, status } = JSON.parse(raw)
            const [block, bolimStr] = id.split('-')
            const bolim = parseInt(bolimStr)
            for (const floor of [1, 2]) {
              qc.setQueryData(['apartments', block, bolim, floor], (old) =>
                old ? old.map(a => a.address === id ? { ...a, status } : a) : old
              )
            }
          }
        }
      } catch {}
    }
    ;(async () => { while (!stopped) { await connect(); if (!stopped) await new Promise(r => setTimeout(r, 3000)) } })()
    return () => { stopped = true; ctrl.abort() }
  }, [qc])
}

export default function LivePage() {
  const opts = (block) => ({
    queryKey: ['bolims', block],
    queryFn: () => fetch(`/api/bolims?block=${block}`).then(r => r.json()),
    staleTime: Infinity,
  })
  const { data: bA = [] } = useQuery(opts('A'))
  const { data: bB = [] } = useQuery(opts('B'))
  const { data: bC = [] } = useQuery(opts('C'))

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
  const [pickerBlock,   setPickerBlock] = useState('A')
  const [swipeHint,     setSwipeHint]   = useState(() => !sessionStorage.getItem('live_hinted'))

  useEffect(() => {
    if (!swipeHint) return
    const t = setTimeout(() => {
      setSwipeHint(false)
      sessionStorage.setItem('live_hinted', '1')
    }, 2200)
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

  // Auto-advance
  useEffect(() => {
    if (!slides.length || paused) return
    const t = setTimeout(() => go(safeIdx + 1, 'right'), DURATION - 200)
    return () => clearTimeout(t)
  }, [safeIdx, slides.length, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // Timer — ref-based: DOM to'g'ridan yangilanadi, React re-render YO'Q
  const _savedElapsed  = paused ? parseInt(sessionStorage.getItem('live_timer_elapsed') ?? '0') : 0
  const timerStartRef  = useRef(Date.now() - _savedElapsed)
  const pausedAtRef    = useRef(paused ? Date.now() : null)
  const initialDelay   = useRef(paused ? `-${(_savedElapsed / 1000).toFixed(2)}s` : '0s')
  const countdownRef   = useRef(null)

  useEffect(() => {
    timerStartRef.current = Date.now()
    pausedAtRef.current   = null
    if (countdownRef.current) countdownRef.current.textContent = DURATION / 1000
  }, [tick])

  useEffect(() => {
    if (paused) {
      pausedAtRef.current = Date.now()
    } else if (pausedAtRef.current !== null) {
      timerStartRef.current += Date.now() - pausedAtRef.current
      pausedAtRef.current = null
      const left = Math.max(0, Math.ceil((DURATION - (Date.now() - timerStartRef.current)) / 1000))
      if (countdownRef.current) countdownRef.current.textContent = left
    }
  }, [paused])

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((DURATION - (Date.now() - timerStartRef.current)) / 1000))
      if (countdownRef.current) countdownRef.current.textContent = left
    }, 500)
    return () => clearInterval(id)
  }, [paused, tick])

  // Swipe
  const touchX = useRef(null)
  function onTouchStart(e) { touchX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchX.current === null || !slides.length) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 50) return
    go(dx < 0 ? safeIdx + 1 : safeIdx - 1, dx < 0 ? 'right' : 'left')
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
    >
      {/* ── TOP BANNER — faqat info ── */}
      <div className="shrink-0 flex items-center justify-center gap-3 px-6 py-5 bg-gray-100">
        <span className="font-black text-2xl tracking-[0.12em] text-gray-800 leading-none uppercase">{cur?.block} BLOK</span>
        <span className="text-gray-300 text-2xl font-light leading-none select-none">·</span>
        <span className="font-black text-2xl tracking-[0.12em] text-gray-800 leading-none uppercase tabular-nums">{cur?.bolim}-BO'LIM</span>
      </div>

      {/* ── KONTENT ── labellar statik, faqat rasmlar animatsiyalanadi */}
      <div className="flex flex-col flex-1 min-h-0 relative">

        {/* Swipe hint — faqat birinchi marta */}
        {swipeHint && (
          <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-between px-3 swipe-hint">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-black/10 backdrop-blur-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </div>
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-black/10 backdrop-blur-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </div>
        )}

        {/* 1-qavat label — statik */}
        <div className="shrink-0 flex items-center gap-2 px-4 pt-4 pb-1">
          <span className="text-xs font-black text-gray-600 uppercase tracking-[0.22em]">1-QAVAT</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* Floor 1 — animatsiyalanadi */}
        <div key={`${safeIdx}-f1`} className={`flex-1 min-h-0 ${dir === 'left' ? 'live-slide-in-left' : 'live-slide-in-right'}`}>
          <OverlayPane src={src1} overlay={ov1} aptMap={map1} />
        </div>

        {src2 && (
          <>
            {/* 2-qavat label — statik */}
            <div className="shrink-0 flex items-center gap-2 px-4 pt-2 pb-1">
              <span className="text-xs font-black text-gray-600 uppercase tracking-[0.22em]">2-QAVAT</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Floor 2 — animatsiyalanadi */}
            <div key={`${safeIdx}-f2`} className={`flex-1 min-h-0 ${dir === 'left' ? 'live-slide-in-left' : 'live-slide-in-right'}`}>
              <OverlayPane src={src2} overlay={ov2} aptMap={map2} />
            </div>
          </>
        )}
      </div>

      {/* ── BOTTOM BAR ── */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-4 pt-3 pb-4">
        {/* Legend — har doim grid-cols-2, layout shift yo'q */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 mb-3 mx-auto">
          {LEGEND.map(({ c, l, k }) => (
            <div key={k} className="flex items-center gap-2" style={{ opacity: (counts[k] ?? 0) > 0 ? 1 : 0.25 }}>
              <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: c }} />
              <span className="text-sm font-black text-gray-900 leading-none tabular-nums">{counts[k] ?? 0}</span>
              <span className="text-sm text-gray-500 font-medium leading-none">{l}</span>
            </div>
          ))}
        </div>

        {/* Controls — timer chapda, arrowlar o'ngda */}
        <div className="flex items-center gap-0.5">
          {/* Ring timer — pause/play, 56px */}
          <button onClick={togglePause} className="relative w-14 h-14 rounded-full active:scale-95 transition-transform mr-auto">
            <svg key={tick} width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
              <circle cx="28" cy="28" r="22" fill="none" stroke="#111827" strokeWidth="3.5"
                strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 22}`}
                className="live-ring" style={{
                  animationPlayState: paused ? 'paused' : 'running',
                  animationDelay: tick === 0 ? initialDelay.current : '0s',
                }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {paused
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="#111827"><path d="M8 5v14l11-7z"/></svg>
                : <svg width="17" height="17" viewBox="0 0 24 24" fill="#111827"><rect x="5" y="4" width="4" height="16" rx="1.5"/><rect x="15" y="4" width="4" height="16" rx="1.5"/></svg>}
            </div>
          </button>

          {/* Chap arrow */}
          <button onClick={() => go(safeIdx - 1, 'left')} className="w-14 h-14 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>

          {/* O'rta — picker ochadi (grid icon) */}
          <button
            onClick={() => { setPickerBlock(cur?.block ?? 'A'); setShowPicker(true) }}
            className="w-14 h-14 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
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
          <div className="absolute inset-0 z-20 bg-black/30" onClick={() => setShowPicker(false)} />
          <div className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-2xl shadow-2xl sheet-panel">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Blok tablar */}
            <div className="flex gap-2 px-4 pt-2 pb-3">
              {BLOCKS.map(block => (
                <button
                  key={block}
                  onClick={() => setPickerBlock(block)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-black tracking-widest transition-colors ${
                    pickerBlock === block ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {block}-BLOK
                </button>
              ))}
            </div>

            {/* Bo'lim grid */}
            <div className="px-4 pb-6">
              <div className="grid grid-cols-5 gap-2">
                {(pickerBlock === 'A' ? bA : pickerBlock === 'B' ? bB : bC).map(bolim => {
                  const slideI   = slides.findIndex(s => s.block === pickerBlock && s.bolim === bolim)
                  const isActive = slideI === safeIdx
                  return (
                    <button
                      key={bolim}
                      onClick={() => { go(slideI, slideI >= safeIdx ? 'right' : 'left'); setShowPicker(false) }}
                      className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                        isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 active:bg-gray-200'
                      }`}
                    >
                      {bolim}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
