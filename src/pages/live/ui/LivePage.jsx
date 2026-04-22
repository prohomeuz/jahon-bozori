import { useState, useEffect, useRef, useCallback } from 'react'
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

function OverlayPane({ src, overlay, aptMap }) {
  const wrapRef = useRef(null)
  const [svgBox, setSvgBox] = useState(null)

  const recalc = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const img = wrap.querySelector('img')
    if (!img || !img.naturalWidth) return
    const { width: cw, height: ch } = wrap.getBoundingClientRect()
    const nr = img.naturalWidth / img.naturalHeight
    let w, h
    if (cw / ch > nr) { h = ch; w = ch * nr } else { w = cw; h = cw / nr }
    setSvgBox({ left: (cw - w) / 2, top: (ch - h) / 2, width: w, height: h })
  }, [])

  return (
    <div ref={wrapRef} className="relative flex-1 min-h-0 overflow-hidden bg-white">
      {src && (
        <img
          src={src}
          onLoad={recalc}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain select-none"
        />
      )}
      {overlay && svgBox && (
        <svg
          viewBox={overlay.viewBox}
          preserveAspectRatio="none"
          className="absolute pointer-events-none"
          style={{ left: svgBox.left, top: svgBox.top, width: svgBox.width, height: svgBox.height }}
        >
          {overlay.rects.map((r) => {
            const status = aptMap[r.id.split('-').pop()]?.status ?? 'UNKNOWN'
            const fill   = S_FILL[status]   ?? 'rgba(120,120,120,0.22)'
            const stroke = S_STROKE[status] ?? '#999'
            return r.d
              ? <path key={r.id} d={r.d} fill={fill} stroke={stroke} strokeWidth={4} style={{ transition: 'fill 0.5s ease' }} />
              : <rect key={r.id} x={r.x} y={r.y} width={r.width} height={r.height} fill={fill} stroke={stroke} strokeWidth={4} style={{ transition: 'fill 0.5s ease' }} />
          })}
        </svg>
      )}
    </div>
  )
}

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

  const slides = [
    ...bA.map(b => ({ block: 'A', bolim: b })),
    ...bB.map(b => ({ block: 'B', bolim: b })),
    ...bC.map(b => ({ block: 'C', bolim: b })),
  ]

  const [idx,         setIdx]         = useState(0)
  const [tick,        setTick]        = useState(0)
  const [dir,         setDir]         = useState('right')
  const [showPicker,  setShowPicker]  = useState(false)
  const [pickerBlock, setPickerBlock] = useState('A')
  const [paused,      setPaused]      = useState(false)
  const safeIdx = slides.length ? idx % slides.length : 0
  const cur     = slides[safeIdx]

  function go(next, direction = 'right') {
    setDir(direction)
    setIdx((next + slides.length) % slides.length)
    setTick(t => t + 1)
  }

  useEffect(() => {
    if (!slides.length || paused) return
    const t = setTimeout(() => go(safeIdx + 1, 'right'), DURATION)
    return () => clearTimeout(t)
  }, [safeIdx, slides.length, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  const timerStartRef = useRef(Date.now())
  const pausedAtRef   = useRef(null)
  const [remaining, setRemaining] = useState(DURATION / 1000)

  useEffect(() => {
    timerStartRef.current = Date.now()
    pausedAtRef.current   = null
    setRemaining(DURATION / 1000)
  }, [tick])

  useEffect(() => {
    if (paused) {
      pausedAtRef.current = Date.now()
    } else if (pausedAtRef.current !== null) {
      timerStartRef.current += Date.now() - pausedAtRef.current
      pausedAtRef.current = null
    }
  }, [paused])

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      const elapsed = Date.now() - timerStartRef.current
      setRemaining(Math.max(0, Math.ceil((DURATION - elapsed) / 1000)))
    }, 500)
    return () => clearInterval(id)
  }, [paused, tick])

  const touchX = useRef(null)
  function onPointerDown() { setPaused(true) }
  function onPointerUp()   { setPaused(false) }
  function togglePause(e)  { e.stopPropagation(); setPaused(p => !p) }
  function onTouchStart(e) { touchX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchX.current === null || !slides.length) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 50) return
    go(dx < 0 ? safeIdx + 1 : safeIdx - 1, dx < 0 ? 'right' : 'left')
  }

  useLiveRealtime()

  const aptOpts = (floor) => ({
    queryKey: ['apartments', cur?.block, cur?.bolim, floor],
    queryFn: () => fetch(`/api/apartments?block=${cur.block}&bolim=${cur.bolim}&floor=${floor}`).then(r => r.json()),
    enabled: !!cur,
    staleTime: 60_000,
  })
  const { data: apts1 = [] } = useQuery(aptOpts(1))
  const { data: apts2 = [] } = useQuery(aptOpts(2))

  const map1 = Object.fromEntries(apts1.map(a => [a.address.split('-').pop(), a]))
  const map2 = Object.fromEntries(apts2.map(a => [a.address.split('-').pop(), a]))

  const allApts = [...apts1, ...apts2]
  const counts  = Object.fromEntries(LEGEND.map(({ k }) => [k, allApts.filter(a => a.status === k).length]))
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
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Content — key triggers slide-in animation on change */}
      <div key={safeIdx} className={`flex flex-col flex-1 min-h-0 ${dir === 'left' ? 'live-slide-in-left' : 'live-slide-in-right'}`}>

        {/* Floor 1 label */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-2.5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs font-black text-gray-600 uppercase tracking-[0.18em]">1-QAVAT</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Floor 1 */}
        <OverlayPane src={src1} overlay={ov1} aptMap={map1} />

        {/* Floor 2 label */}
        {src2 && (
          <div className="shrink-0 flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-black text-gray-600 uppercase tracking-[0.18em]">2-QAVAT</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        )}

        {/* Floor 2 */}
        {src2 && <OverlayPane src={src2} overlay={ov2} aptMap={map2} />}

      </div>

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {/* Legend with counts — LEFT */}
          <div className="flex items-center gap-3 flex-wrap">
            {LEGEND.map(({ c, l, k }) => {
              const n = counts[k] ?? 0
              if (k === 'EMPTY' || n === 0) return null
              return (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c }} />
                  <span className="text-xs font-black text-gray-800 leading-none">{n}</span>
                  <span className="text-xs text-gray-500 font-medium leading-none">{l}</span>
                </div>
              )
            })}
            {(() => {
              const emptyCount = counts['EMPTY'] ?? 0
              if (emptyCount === 0) return null
              const { c, l } = LEGEND[0]
              return (
                <div key="EMPTY" className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c }} />
                  <span className="text-xs font-black text-gray-800 leading-none">{emptyCount}</span>
                  <span className="text-xs text-gray-500 font-medium leading-none">{l}</span>
                </div>
              )
            })()}
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {/* Ring timer — pause/play toggle */}
            <button
              onPointerDown={e => e.stopPropagation()}
              onPointerUp={e => e.stopPropagation()}
              onClick={togglePause}
              className="relative w-11 h-11 rounded-full active:scale-95 transition-transform"
            >
              <svg key={tick} width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="22" cy="22" r="18" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle
                  cx="22" cy="22" r="18"
                  fill="none"
                  stroke="#111827"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  className="live-ring"
                  style={{ animationPlayState: paused ? 'paused' : 'running' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                {paused
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#111827"><path d="M8 5v14l11-7z"/></svg>
                  : <span className="text-[11px] font-black text-gray-800 leading-none tabular-nums">{remaining}</span>
                }
              </div>
            </button>

            {/* Picker button */}
            <button
              onClick={() => { setPickerBlock(cur?.block ?? 'A'); setShowPicker(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <span className="text-gray-900 font-black text-sm tracking-widest leading-none">{cur?.block} BLOK</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
              <span className="text-gray-600 text-sm font-semibold leading-none">{cur?.bolim}-bo'lim</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Picker sheet */}
      {showPicker && (
        <>
          <div
            className="absolute inset-0 z-20 bg-black/30"
            onClick={() => setShowPicker(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-2xl shadow-2xl sheet-panel">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Block tabs */}
            <div className="flex gap-2 px-4 pt-2 pb-3">
              {BLOCKS.map(block => (
                <button
                  key={block}
                  onClick={() => setPickerBlock(block)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-black tracking-widest transition-colors ${
                    pickerBlock === block
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {block}-BLOK
                </button>
              ))}
            </div>

            {/* Bolim grid */}
            <div className="px-4 pb-6">
              <div className="grid grid-cols-5 gap-2">
                {(pickerBlock === 'A' ? bA : pickerBlock === 'B' ? bB : bC).map(bolim => {
                  const slideI = slides.findIndex(s => s.block === pickerBlock && s.bolim === bolim)
                  const isActive = slideI === safeIdx
                  return (
                    <button
                      key={bolim}
                      onClick={() => { go(slideI, slideI >= safeIdx ? 'right' : 'left'); setShowPicker(false) }}
                      className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                        isActive
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-700 active:bg-gray-200'
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
