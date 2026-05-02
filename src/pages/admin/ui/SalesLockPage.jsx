import GENPLAN from '@/assets/genplan.webp'
import ABLOK from '@/assets/blocks/A-BLOK.webp'
import BBLOK from '@/assets/blocks/B-BLOK.webp'
import CBLOK from '@/assets/blocks/C-BLOK.webp'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { imgCache } from '@/shared/lib/imgCache'
import { apiFetch } from '@/shared/lib/auth'
import { BLOCK_BUILDINGS, BLOCK_VIEW_BOX } from '@/pages/block/config/buildings'
import { Lock, LockOpen, X, AlertTriangle } from 'lucide-react'

const GENPLAN_BLOCKS = [
  { id: 'A', points: '3081,2161 2935,2414 3004,2472 3811,2579 3928,2521 3996,2268', textX: 3459, textY: 2403, delay: '0s' },
  { id: 'B', points: '4191,2287 5096,2394 5077,2686 4970,2735 4172,2628 4094,2531', textX: 4600, textY: 2544, delay: '1.3s' },
  { id: 'C', points: '5194,2414 5174,2706 5262,2774 6118,2891 6206,2842 6216,2774 6157,2521', textX: 5761, textY: 2703, delay: '2.6s' },
]

const BLOCK_META = {
  A: { label: 'A-BLOK', image: ABLOK },
  B: { label: 'B-BLOK', image: BBLOK },
  C: { label: 'C-BLOK', image: CBLOK },
}

// Inline SVG lock icon for use inside <svg>
function SvgLockIcon({ cx, cy, s = 11, color = 'white' }) {
  const bw = s * 0.72, bh = s * 0.52
  const bx = cx - bw / 2, by = cy - s * 0.1
  const shW = s * 0.36, shH = s * 0.38
  return (
    <g>
      <path
        d={`M${cx - shW / 2} ${by} V${cy - shH * 0.6} a${shW / 2} ${shH * 0.6} 0 0 1 ${shW} 0 V${by}`}
        fill="none" stroke={color} strokeWidth={s * 0.13} strokeLinecap="round"
      />
      <rect x={bx} y={by} width={bw} height={bh} rx={s * 0.1} fill={color} />
    </g>
  )
}

// Inline SVG check icon for use inside <svg>
function SvgCheckIcon({ cx, cy, s = 11, color = 'rgba(255,255,255,0.85)' }) {
  return (
    <path
      d={`M${cx - s * 0.35} ${cy} l${s * 0.28} ${s * 0.28} l${s * 0.48} -${s * 0.48}`}
      fill="none" stroke={color} strokeWidth={s * 0.17} strokeLinecap="round" strokeLinejoin="round"
    />
  )
}

// ─── Step 1: Genplan ──────────────────────────────────────────────────────────

function GenplanStep({ onSelect }) {
  const [loaded, setLoaded] = useState(() => imgCache.has(GENPLAN))
  const [hovered, setHovered] = useState(null)

  return (
    <div className="absolute inset-0 bg-black overflow-hidden">
      <div className="w-full h-full">
        <img src={GENPLAN} className="absolute inset-0 w-full h-full object-contain" draggable={false}
          onLoad={() => { imgCache.add(GENPLAN); setLoaded(true) }}
          style={{ filter: loaded ? 'none' : 'blur(20px)', opacity: loaded ? 1 : 0.4, transition: 'filter .6s, opacity .6s' }}
        />
        <svg viewBox="0 0 7000 3892" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full">
          {GENPLAN_BLOCKS.map(b => (
            <g key={b.id}>
              <polygon points={b.points} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={10} strokeLinejoin="round" pointerEvents="none" />
              <polygon points={b.points}
                fill={hovered === b.id ? 'white' : 'black'}
                fillOpacity={hovered === b.id ? 0.12 : undefined}
                stroke="rgba(0,0,0,0.75)" strokeWidth={2} strokeLinejoin="round"
                className={hovered === b.id ? '' : 'block-pulse'}
                style={{ cursor: 'pointer', animationDelay: b.delay }}
                onMouseEnter={() => setHovered(b.id)} onMouseLeave={() => setHovered(null)}
                onClick={() => onSelect(b.id)}
              />
              <circle cx={b.textX} cy={b.textY} r={152} fill="none" stroke="white" strokeWidth={10} opacity={0.9} pointerEvents="none" />
              <circle cx={b.textX} cy={b.textY} r={138} fill="rgba(0,0,0,0.82)" pointerEvents="none" />
              <text x={b.textX} y={b.textY} textAnchor="middle" dominantBaseline="middle"
                fontSize={120} fontWeight="bold" fontFamily="ui-monospace,monospace" fill="white" pointerEvents="none">
                {b.id}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 text-white text-sm font-medium pointer-events-none">
        Sotuvni boshqarish uchun blokni tanlang
      </div>
    </div>
  )
}

// ─── Step 2: Block + modal ────────────────────────────────────────────────────

function BlockStep({ blockId, onSwitchBlock, locks }) {
  const meta = BLOCK_META[blockId]
  const [loaded, setLoaded] = useState(() => imgCache.has(meta?.image))
  const [hovered, setHovered] = useState(null)
  const [selected, setSelected] = useState(null) // { bolimNum }
  const [activeFloor, setActiveFloor] = useState(1)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const qc = useQueryClient()

  const buildings = BLOCK_BUILDINGS[blockId] ?? []
  const viewBox = BLOCK_VIEW_BOX[blockId] ?? '0 0 1539 672'
  const vbScale = parseInt(viewBox.split(' ')[2]) / 1376

  useEffect(() => {
    setSelected(null)
    setLoaded(imgCache.has(BLOCK_META[blockId]?.image))
  }, [blockId])

  function getLock(bolimNum, floor) {
    return locks.find(l => l.block === blockId && l.bolim === bolimNum && l.floor === floor) ?? null
  }

  const currentLock = selected ? getLock(selected.bolimNum, activeFloor) : null

  const { mutateAsync: doLock } = useMutation({
    mutationFn: (body) => apiFetch('/api/sales-locks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-locks'] }),
  })

  const { mutateAsync: doUnlock } = useMutation({
    mutationFn: (body) => apiFetch('/api/sales-locks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-locks'] }),
  })

  async function handleLock() {
    if (!reason.trim() || !selected) return
    setBusy(true)
    try { await doLock({ block: blockId, bolim: selected.bolimNum, floor: activeFloor, reason }) }
    finally { setBusy(false); setReason('') }
  }

  async function handleUnlock() {
    if (!selected) return
    setBusy(true)
    try { await doUnlock({ block: blockId, bolim: selected.bolimNum, floor: activeFloor }) }
    finally { setBusy(false) }
  }

  function closeModal() { setSelected(null); setReason('') }

  return (
    <div className="absolute inset-0 bg-black overflow-hidden">
      {/* Blok rasmi */}
      <div className="w-full h-full">
        <img src={meta.image} className="absolute inset-0 w-full h-full object-contain" draggable={false}
          onLoad={() => { imgCache.add(meta.image); setLoaded(true) }}
          style={{ filter: loaded ? 'none' : 'blur(20px)', opacity: loaded ? 1 : 0.4, transition: 'filter .6s, opacity .6s' }}
        />
        <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full">
          {buildings.map(b => {
            const num = parseInt(b.label)
            const isSelected = selected?.bolimNum === num
            const isHovered  = hovered === b.id && !isSelected
            const lock1 = getLock(num, 1)
            const lock2 = getLock(num, 2)
            const hasAnyLock = !!(lock1 || lock2)
            const bw = 110 * vbScale, bh = 52 * vbScale, br = 10 * vbScale
            const bx = b.textX - bw / 2, by = b.textY - bh / 2
            const bgFill   = isSelected ? 'rgba(251,191,36,0.97)' : hasAnyLock ? 'rgba(220,38,38,0.88)' : 'rgba(0,0,0,0.78)'
            const bgStroke = isSelected ? 'rgba(180,130,0,0.6)' : hasAnyLock ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.18)'
            const txtColor = isSelected ? '#1a0f00' : 'rgba(255,255,255,0.95)'
            const divY = b.textY
            const row1Y = by + 14 * vbScale, row2Y = by + bh - 14 * vbScale
            const numX  = bx + 16 * vbScale, iconX = bx + bw - 14 * vbScale

            return (
              <g key={b.id}>
                <polygon points={b.points}
                  fill={isSelected ? 'rgba(251,191,36,0.35)' : isHovered ? 'rgba(255,255,255,0.08)' : hasAnyLock ? 'rgba(220,38,38,0.15)' : 'black'}
                  stroke={isSelected ? 'rgba(251,191,36,0.9)' : hasAnyLock ? 'rgba(220,38,38,0.7)' : 'rgba(0,0,0,0.75)'}
                  strokeWidth={isSelected ? 3 * vbScale : hasAnyLock ? 2 * vbScale : vbScale}
                  strokeLinejoin="round"
                  className={!isSelected && !isHovered && !hasAnyLock ? 'block-pulse' : ''}
                  style={{ cursor: 'pointer', animationDelay: b.delay }}
                  onMouseEnter={() => setHovered(b.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => { setSelected({ bolimNum: num }); setActiveFloor(1); setReason('') }}
                />
                <polygon points={b.points} fill="none"
                  stroke={isSelected ? 'rgba(251,191,36,0.6)' : hasAnyLock ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.3)'}
                  strokeWidth={isSelected ? 4 * vbScale : 3 * vbScale} strokeLinejoin="round" pointerEvents="none"
                />
                <g pointerEvents="none">
                  <rect x={bx} y={by} width={bw} height={bh} rx={br} fill={bgFill} stroke={bgStroke} strokeWidth={1.5 * vbScale} />
                  <line x1={bx + 8 * vbScale} y1={divY} x2={bx + bw - 8 * vbScale} y2={divY}
                    stroke={isSelected ? 'rgba(180,130,0,0.25)' : 'rgba(255,255,255,0.15)'} strokeWidth={vbScale} />
                  {/* floor 1 */}
                  <text x={numX} y={row1Y} textAnchor="middle" dominantBaseline="middle"
                    fontSize={10 * vbScale} fontWeight="800" fontFamily="ui-sans-serif,sans-serif" fill={txtColor} opacity={0.7}>1</text>
                  {lock1
                    ? <SvgLockIcon cx={iconX} cy={row1Y} s={11 * vbScale} color={isSelected ? '#92400e' : 'rgba(255,255,255,0.95)'} />
                    : <SvgCheckIcon cx={iconX} cy={row1Y} s={11 * vbScale} color={isSelected ? '#92400e' : 'rgba(255,255,255,0.75)'} />
                  }
                  {/* floor 2 */}
                  <text x={numX} y={row2Y} textAnchor="middle" dominantBaseline="middle"
                    fontSize={10 * vbScale} fontWeight="800" fontFamily="ui-sans-serif,sans-serif" fill={txtColor} opacity={0.7}>2</text>
                  {lock2
                    ? <SvgLockIcon cx={iconX} cy={row2Y} s={11 * vbScale} color={isSelected ? '#92400e' : 'rgba(255,255,255,0.95)'} />
                    : <SvgCheckIcon cx={iconX} cy={row2Y} s={11 * vbScale} color={isSelected ? '#92400e' : 'rgba(255,255,255,0.75)'} />
                  }
                </g>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Hint */}
      {!selected && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 text-white text-sm font-medium pointer-events-none">
          Bo'limni tanlang
        </div>
      )}

      {/* Block switcher */}
      <div className="absolute top-6 right-6 flex items-center gap-2">
        {['A','B','C'].map(bid => (
          <button key={bid} onClick={() => bid !== blockId ? onSwitchBlock(bid) : null}
            className={`w-12 h-12 rounded-2xl text-base font-bold shadow-xl transition-all active:scale-95 ${bid === blockId ? 'bg-white text-black scale-110 shadow-white/20' : 'bg-black/80 text-white backdrop-blur-sm hover:bg-black/60'}`}>
            {bid}
          </button>
        ))}
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="bg-background rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <span className="w-9 h-9 rounded-xl bg-amber-400 text-amber-900 flex items-center justify-center text-sm font-black shrink-0">
                {selected.bolimNum}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-foreground">{blockId}-BLOK · {selected.bolimNum}-bo'lim</p>
                <p className="text-xs text-muted-foreground">{activeFloor}-qavat holati</p>
              </div>
              <button onClick={closeModal}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-muted hover:bg-muted/70 transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-4">
              {/* Floor tabs */}
              <div className="flex gap-1 p-0.5 bg-muted rounded-xl">
                {[1, 2].map(f => {
                  const fLock = getLock(selected.bolimNum, f)
                  return (
                    <button key={f} onClick={() => { setActiveFloor(f); setReason('') }}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeFloor === f ? 'bg-amber-400 text-amber-900 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                      {fLock ? <Lock size={11} /> : <LockOpen size={11} />}
                      {f}-qavat
                    </button>
                  )
                })}
              </div>

              {currentLock ? (
                <div className="flex flex-col gap-3">
                  <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-red-600">
                      <Lock size={15} />
                      <span className="font-semibold text-sm">Sotuv to'xtatilgan</span>
                    </div>
                    <p className="text-sm text-foreground">"{currentLock.reason}"</p>
                    <p className="text-xs text-muted-foreground">{currentLock.locked_at} · {currentLock.locked_by}</p>
                  </div>
                  <button onClick={handleUnlock} disabled={busy}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-semibold text-sm transition-all disabled:opacity-60">
                    <LockOpen size={16} />
                    {busy ? 'Ochilmoqda…' : 'Qulfdan ochish'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center gap-2 text-muted-foreground">
                    <LockOpen size={15} />
                    <span className="text-sm">Sotuv faol</span>
                  </div>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Sabab: texnik ishlar, ta'mirlash…"
                    rows={3}
                    className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
                  />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                    <span>Bu qavatda bron va sotuv to'xtatiladi</span>
                  </div>
                  <button onClick={handleLock} disabled={busy || !reason.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 hover:bg-red-600 active:scale-[0.98] text-white font-semibold text-sm transition-all disabled:opacity-40">
                    <Lock size={16} />
                    {busy ? 'Qullanmoqda…' : "Sotuvni to'xtatish"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SalesLockPage() {
  const [params, setParams] = useSearchParams()
  const blockId = params.get('block')?.toUpperCase() ?? null

  const { data: locks = [] } = useQuery({
    queryKey: ['sales-locks'],
    queryFn: () => apiFetch('/api/sales-locks').then(r => r.json()),
    refetchInterval: 30_000,
  })

  function goBlock(id) { setParams({ block: id }) }

  if (!blockId) return <GenplanStep onSelect={goBlock} />

  return <BlockStep key={blockId} blockId={blockId} onSwitchBlock={goBlock} locks={locks} />
}
