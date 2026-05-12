import ABLOK from '@/assets/blocks/A-BLOK.webp'
import BBLOK from '@/assets/blocks/B-BLOK.webp'
import CBLOK from '@/assets/blocks/C-BLOK.webp'
import { useRef, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { imgCache } from '@/shared/lib/imgCache'
import { apiFetch, getUser } from '@/shared/lib/auth'
import { BLOCK_BUILDINGS, BLOCK_VIEW_BOX } from '@/pages/block/config/buildings'
import { Check, X, ArrowRight } from 'lucide-react'
import { ApartmentPriceSheet } from './ApartmentPriceSheet'

const BLOCK_META = {
  A: { label: 'A-BLOK', image: ABLOK },
  B: { label: 'B-BLOK', image: BBLOK },
  C: { label: 'C-BLOK', image: CBLOK },
}

// ─── Step 0: Landing ─────────────────────────────────────────────────────────

function LandingStep({ onBolim, onAlohida, zh }) {
  return (
    <div className="absolute inset-0 bg-background flex flex-col">
      <div className="px-6 pt-8 pb-4 border-b border-border">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{zh ? '定價設定' : 'Narx belgilash'}</p>
        <p className="text-2xl font-black text-foreground mt-1">{zh ? '請選擇定價類型' : 'Narx turini tanlang'}</p>
      </div>
      <div className="p-6 grid grid-cols-2 gap-4">
        <button onClick={onBolim}
          className="flex flex-col gap-4 p-8 rounded-2xl bg-card border border-border hover:border-amber-300 hover:shadow-md hover:shadow-amber-100 transition-all text-left group relative">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
          </div>
          <div>
            <p className="font-bold text-foreground text-lg group-hover:text-amber-600 transition-colors">{zh ? '按區域定價' : "Bo'lim narxlash"}</p>
            <p className="text-sm text-muted-foreground mt-1.5">{zh ? '按棟按樓層設定整體價格' : "Blok bo'yicha, qavat bo'yicha umumiy narx"}</p>
          </div>
          <ArrowRight size={18} className="absolute bottom-7 right-7 text-amber-400 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all" />
        </button>
        <button onClick={onAlohida}
          className="flex flex-col gap-4 p-8 rounded-2xl bg-card border border-border hover:border-sky-300 hover:shadow-md hover:shadow-sky-100 transition-all text-left group relative">
          <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-600">
              <path d="M3 3h18v18H3z"/><path d="M3 9h18M3 15h18M9 3v18"/>
            </svg>
          </div>
          <div>
            <p className="font-bold text-foreground text-lg group-hover:text-sky-600 transition-colors">{zh ? '單獨定價' : 'Alohida narxlash'}</p>
            <p className="text-sm text-muted-foreground mt-1.5">{zh ? '為每個商鋪單獨設定價格' : "Har bir do'kon uchun alohida narx"}</p>
          </div>
          <ArrowRight size={18} className="absolute bottom-7 right-7 text-sky-400 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Block — bo'lim tanlash + inline narx tahrirlash ─────────────────

const WC_BOLIMS = [1, 3]

function BlockStep({ blockId, onSwitchBlock, onBack, grouped, groupedWc, mode, onModeChange, zh }) {
  const meta = BLOCK_META[blockId]
  const [loaded, setLoaded] = useState(() => imgCache.has(meta?.image))
  const [hovered, setHovered] = useState(null)
  const [selected, setSelected] = useState(null) // { bolimNum, building }
  const [activeFloor, setActiveFloor] = useState(1)
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [activeKey, setActiveKey] = useState(null)
  const inputRef = useRef(null)
  const saveRef = useRef(null)
  const buildings = BLOCK_BUILDINGS[blockId] ?? []
  const viewBox = BLOCK_VIEW_BOX[blockId] ?? '0 0 1539 672'
  const vbScale = parseInt(viewBox.split(' ')[2]) / 1376
  const qc = useQueryClient()

  // Mode'ga ko'ra narx manbasi
  const activeGrouped = mode === 'wc' ? groupedWc : grouped

  const { mutateAsync: savePrice } = useMutation({
    mutationFn: (body) => apiFetch('/api/prices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => { if (!r.ok) throw new Error() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prices-all'] })
      qc.invalidateQueries({ queryKey: ['prices-all-wc'] })
      qc.invalidateQueries({ queryKey: ['shops'] })
    },
  })

  // Block yoki mode o'zgarganda reset
  useEffect(() => {
    setSelected(null)
    setLoaded(imgCache.has(BLOCK_META[blockId]?.image))
  }, [blockId])

  useEffect(() => { setSelected(null) }, [mode])

  function fmt(digits) { return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') }

  function press(k) {
    if (k === '⌫') {
      const digits = editVal.replace(/\s/g, '').slice(0, -1)
      setEditVal(fmt(digits))
    } else {
      const digits = editVal.replace(/\s/g, '') + k
      if (digits.length > 9) return
      setEditVal(fmt(digits))
    }
    setSavedFlash(false)
  }

  function flashKey(k) { setActiveKey(k); setTimeout(() => setActiveKey(null), 150) }

  const defaultPrice = mode === 'wc' ? 2000 : 1000

  function selectBolim(building) {
    const num = parseInt(building.label)
    const floors = activeGrouped[blockId]?.[num] ?? {}
    const firstFloor = Math.min(...Object.keys(floors).map(Number).filter(f => !isNaN(f)), 1)
    setSelected({ bolimNum: num, building })
    setActiveFloor(firstFloor)
    setEditVal(fmt(String(floors[firstFloor] ?? defaultPrice)))
    setSavedFlash(false)
  }

  function changeFloor(f) {
    setActiveFloor(f)
    const price = activeGrouped[blockId]?.[selected?.bolimNum]?.[f] ?? defaultPrice
    setEditVal(fmt(String(price)))
    setSavedFlash(false)
  }

  async function save() {
    if (!selected) return
    const num = Number(String(editVal).replace(/[\s,]/g, ''))
    if (isNaN(num) || num < 0) return
    setSaving(true)
    try {
      await savePrice({ block: blockId, bolim: selected.bolimNum, floor: activeFloor, price: num, isWc: mode === 'wc' })
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1800)
    } finally { setSaving(false) }
  }

  const selectedFloors = selected ? Object.keys(activeGrouped[blockId]?.[selected.bolimNum] ?? {}).map(Number).sort() : []
  const panelOpen = !!selected
  const NUMPAD = ['7','8','9','4','5','6','1','2','3','⌫','0','✓']

  saveRef.current = save

  useEffect(() => {
    if (!panelOpen) return
    function onKey(e) {
      if (e.key >= '0' && e.key <= '9') { e.preventDefault(); flashKey(e.key); press(e.key) }
      else if (e.key === 'Backspace') { e.preventDefault(); flashKey('⌫'); press('⌫') }
      else if (e.key === 'Enter') { e.preventDefault(); saveRef.current?.() }
      else if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen, editVal, selected, activeFloor])

  return (
    <div className="absolute inset-0 bg-black flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <div className="shrink-0 flex items-center gap-4 px-4 py-3 bg-black/90 border-b border-white/8 z-20">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition-colors shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          {zh ? '返回' : 'Orqaga'}
        </button>

        <div className="flex-1 flex justify-center">
          <div className="flex gap-1 p-1 bg-white/10 rounded-xl">
            <button onClick={() => onModeChange('dokonlar')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'dokonlar' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>
              {zh ? '商鋪' : "Do'konlar"}
            </button>
            <button onClick={() => onModeChange('wc')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'wc' ? 'bg-sky-400 text-sky-950' : 'text-white/60 hover:text-white'}`}>
              {zh ? '衛生間' : 'WC'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {['A','B','C'].map(bid => (
            <button key={bid} onClick={() => bid !== blockId ? onSwitchBlock(bid) : null}
              className={`w-10 h-10 rounded-xl text-sm font-bold shadow-xl transition-all active:scale-95 ${bid === blockId ? 'bg-white text-black scale-110 shadow-white/20' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              {bid}
            </button>
          ))}
        </div>
      </div>

      {/* ── Image area ── */}
      <div className="flex-1 relative overflow-hidden">
          <img src={meta.image} className="absolute inset-0 w-full h-full object-contain" draggable={false}
            onLoad={() => { imgCache.add(meta.image); setLoaded(true) }}
            style={{ filter: loaded ? 'none' : 'blur(20px)', opacity: loaded ? 1 : 0.4, transition: 'filter .6s, opacity .6s' }}
          />
          <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full">
            {/* Pass 1: barcha polygon'lar (badge'lar bulardan keyin chiqadi) */}
            {buildings.map(b => {
              const num = parseInt(b.label)
              const isSelected = selected?.bolimNum === num
              const isHovered  = hovered === b.id && !isSelected
              const isDisabled = mode === 'wc' && !WC_BOLIMS.includes(num)
              return (
                <g key={`poly-${b.id}`} style={{
                  opacity: isDisabled ? 0 : 1,
                  transform: isDisabled ? 'scale(0.92)' : 'scale(1)',
                  transformOrigin: `${b.textX}px ${b.textY}px`,
                  transition: 'opacity 0.4s cubic-bezier(0.4,0,0.2,1), transform 0.4s cubic-bezier(0.4,0,0.2,1)',
                  pointerEvents: isDisabled ? 'none' : 'all',
                }}>
                  <polygon points={b.points}
                    fill={isSelected ? 'rgba(251,191,36,0.35)' : isHovered ? 'rgba(255,255,255,0.08)' : 'black'}
                    stroke={isSelected ? 'rgba(251,191,36,0.9)' : 'rgba(0,0,0,0.75)'}
                    strokeWidth={isSelected ? 3 * vbScale : vbScale}
                    strokeLinejoin="round"
                    className={!isSelected && !isHovered && !isDisabled ? 'block-pulse' : ''}
                    style={{ cursor: isDisabled ? 'default' : 'pointer', animationDelay: b.delay }}
                    onMouseEnter={() => !isDisabled && setHovered(b.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => !isDisabled && selectBolim(b)}
                  />
                  <polygon points={b.points} fill="none"
                    stroke={isSelected ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.3)'}
                    strokeWidth={isSelected ? 4 * vbScale : 3 * vbScale} strokeLinejoin="round" pointerEvents="none"
                  />
                </g>
              )
            })}
            {/* Pass 2: barcha narx badge'lari (doim yuqorida) */}
            {buildings.map(b => {
              const num = parseInt(b.label)
              const isSelected = selected?.bolimNum === num
              const isDisabled = mode === 'wc' && !WC_BOLIMS.includes(num)
              const bolimFloors = activeGrouped[blockId]?.[num] ?? {}
              const floorNums = Object.keys(bolimFloors).map(Number).sort()
              const hasTwo = floorNums.length >= 2
              const p1Raw = bolimFloors[floorNums[0]] ?? defaultPrice
              const p2Raw = hasTwo ? (bolimFloors[floorNums[1]] ?? defaultPrice) : null
              const editNum = Number(String(editVal).replace(/[\s,]/g, ''))
              const p1 = isSelected && activeFloor === floorNums[0] && !isNaN(editNum) ? editNum : p1Raw
              const p2 = isSelected && hasTwo && activeFloor === floorNums[1] && !isNaN(editNum) ? editNum : p2Raw
              const bw = 124 * vbScale, bh = (hasTwo ? 60 : 40) * vbScale, br = 10 * vbScale
              const bx = b.textX - bw / 2, by = b.textY - bh / 2
              const priceColor = isSelected ? '#1a0f00' : isDisabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.95)'
              const bgFill   = isSelected ? 'rgba(251,191,36,0.97)' : isDisabled ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.78)'
              const bgStroke = isSelected ? 'rgba(180,130,0,0.6)'   : isDisabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.18)'
              return (
                <g key={`badge-${b.id}`} pointerEvents="none" style={{
                  opacity: isDisabled ? 0 : 1,
                  transition: 'opacity 0.4s cubic-bezier(0.4,0,0.2,1)',
                }}>
                  <rect x={bx} y={by} width={bw} height={bh} rx={br}
                    fill={bgFill} stroke={bgStroke} strokeWidth={1.5 * vbScale}
                  />
                  {hasTwo ? (
                    <>
                      <line x1={bx + 10 * vbScale} y1={b.textY} x2={bx + bw - 10 * vbScale} y2={b.textY}
                        stroke={isSelected ? 'rgba(180,130,0,0.25)' : 'rgba(255,255,255,0.12)'} strokeWidth={vbScale} />
                      <rect x={bx + 7 * vbScale} y={by + 7 * vbScale} width={20 * vbScale} height={16 * vbScale} rx={4 * vbScale}
                        fill={isSelected ? 'rgba(120,80,0,0.18)' : 'rgba(255,255,255,0.15)'} />
                      <text x={bx + 17 * vbScale} y={by + 15 * vbScale} textAnchor="middle" dominantBaseline="middle"
                        fontSize={11 * vbScale} fontWeight="800" fontFamily="ui-sans-serif,sans-serif" fill={isSelected ? '#92400e' : 'rgba(255,255,255,0.7)'}>
                        {floorNums[0]}
                      </text>
                      <text x={bx + bw - 8 * vbScale} y={by + 15 * vbScale} textAnchor="end" dominantBaseline="middle"
                        fontSize={18 * vbScale} fontWeight="bold" fontFamily="ui-monospace,monospace" fill={priceColor}>
                        ${p1.toLocaleString('ru-RU')}
                      </text>
                      <rect x={bx + 7 * vbScale} y={by + bh - 23 * vbScale} width={20 * vbScale} height={16 * vbScale} rx={4 * vbScale}
                        fill={isSelected ? 'rgba(120,80,0,0.18)' : 'rgba(255,255,255,0.15)'} />
                      <text x={bx + 17 * vbScale} y={by + bh - 15 * vbScale} textAnchor="middle" dominantBaseline="middle"
                        fontSize={11 * vbScale} fontWeight="800" fontFamily="ui-sans-serif,sans-serif" fill={isSelected ? '#92400e' : 'rgba(255,255,255,0.7)'}>
                        {floorNums[1]}
                      </text>
                      <text x={bx + bw - 8 * vbScale} y={by + bh - 15 * vbScale} textAnchor="end" dominantBaseline="middle"
                        fontSize={18 * vbScale} fontWeight="bold" fontFamily="ui-monospace,monospace" fill={priceColor}>
                        ${p2.toLocaleString('ru-RU')}
                      </text>
                    </>
                  ) : (
                    <text x={b.textX} y={b.textY} textAnchor="middle" dominantBaseline="middle"
                      fontSize={22 * vbScale} fontWeight="bold" fontFamily="ui-monospace,monospace" fill={priceColor}>
                      ${p1.toLocaleString('ru-RU')}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

        {/* Hint overlay */}
        {!panelOpen && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 text-white text-sm font-medium pointer-events-none">
            {zh
              ? (mode === 'wc' ? '請選擇區域以修改衛生間價格' : '請選擇區域以修改價格')
              : (mode === 'wc' ? "WC narxini o'zgartirish uchun bo'limni tanlang" : "Narx o'zgartirish uchun bo'limni tanlang")}
          </div>
        )}
      </div>

      {/* Inline price edit panel */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: 0,
          transform: panelOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div className="relative bg-background border-t border-border rounded-t-3xl shadow-2xl">
        <button onClick={() => setSelected(null)}
          className="absolute top-3 right-4 w-8 h-8 rounded-full flex items-center justify-center bg-black text-white hover:bg-black/80 transition-colors z-10">
          <X size={15} strokeWidth={2.5} />
        </button>
        <div className="w-full max-w-2xl mx-auto px-4 pt-2 pb-3">
          {/* Handle */}
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-2" />

          <div className="flex gap-4">
            {/* LEFT: info + display + save */}
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-amber-400 text-amber-900 flex items-center justify-center text-sm font-black shrink-0">
                  {selected?.bolimNum}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-foreground leading-tight truncate">{zh ? `${blockId}棟 · ${selected?.bolimNum}區` : `${blockId}-BLOK · ${selected?.bolimNum}-bo'lim`}</p>
                  <p className="text-xs text-muted-foreground">{zh ? `第${activeFloor}層 ${mode === 'wc' ? '衛生間' : '商鋪'}價格` : `${activeFloor}-qavat ${mode === 'wc' ? 'WC' : "do'kon"} narxi`}</p>
                </div>
              </div>

              {/* Floor tabs */}
              {selectedFloors.length > 1 && (
                <div className="flex gap-1 p-0.5 bg-muted rounded-xl">
                  {selectedFloors.map(f => (
                    <button key={f} onClick={() => changeFloor(f)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all touch-manipulation ${activeFloor === f ? 'bg-amber-400 text-amber-900 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                      {zh ? `第${f}層` : `${f}-qavat`}
                    </button>
                  ))}
                </div>
              )}

              {/* Price display */}
              <div className="flex items-stretch border-2 border-amber-400 rounded-xl overflow-hidden bg-background">
                <span className="flex items-center px-3 text-muted-foreground font-bold text-sm select-none shrink-0">$</span>
                <input ref={inputRef} readOnly tabIndex={-1}
                  value={editVal} placeholder="0"
                  className="flex-1 py-2 text-xl font-black bg-transparent focus:outline-none tabular-nums min-w-0 caret-transparent cursor-default"
                  style={{ fontSize: '20px' }}
                />
                <span className="flex items-center px-3 bg-muted text-muted-foreground text-xs font-semibold select-none shrink-0 border-l border-border">/m²</span>
              </div>
            </div>

            {/* RIGHT: numpad */}
            <div className="grid grid-cols-3 gap-1.5 shrink-0 w-42">
              {NUMPAD.map(k => {
                const isActive = activeKey === k
                const isSave = k === '✓'
                const isBack = k === '⌫'
                return (
                  <button key={k}
                    onPointerDown={e => { e.preventDefault(); flashKey(k); isSave ? save() : press(k) }}
                    className={`h-9 rounded-xl text-base font-bold transition-all active:scale-95 select-none touch-manipulation flex items-center justify-center
                      ${isActive || (isSave && savedFlash)
                        ? isSave ? 'bg-green-500 text-white scale-95' : 'bg-primary text-primary-foreground scale-95'
                        : isSave ? (saving ? 'bg-amber-300 text-amber-800' : 'bg-amber-400 text-amber-900 hover:bg-amber-500') : 'bg-muted hover:bg-muted/70 text-foreground'
                      }`}>
                    {isBack
                      ? <svg width="18" height="14" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9L3 9z"/><line x1="13" y1="7" x2="17" y2="11"/><line x1="17" y1="7" x2="13" y2="11"/></svg>
                      : isSave ? <Check size={16} strokeWidth={2.5} />
                      : k}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PricesPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const user = getUser()
  const zh = user?.role === 'narxchi'
  const [mode, setMode] = useState('dokonlar') // 'dokonlar' | 'wc'

  const step    = params.get('step')  ?? 'landing'
  const blockId = params.get('block') ?? 'A'

  function goBlock(bid) { setParams({ step: 'block', block: bid }, { replace: true }) }
  function goLanding()  { setParams({ step: 'landing' }, { replace: true }) }

  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'narxchi') navigate('/admin', { replace: true })
  }, [])

  const canFetch = user?.role === 'admin' || user?.role === 'narxchi'

  const { data: allPrices = [] } = useQuery({
    queryKey: ['prices-all'],
    queryFn: () => apiFetch('/api/prices/all').then(r => r.json()),
    staleTime: 60_000,
    enabled: canFetch,
  })

  const { data: allWcPrices = [] } = useQuery({
    queryKey: ['prices-all-wc'],
    queryFn: () => apiFetch('/api/prices/all?is_wc=1').then(r => r.json()),
    staleTime: 60_000,
    enabled: canFetch,
  })

  function buildGrouped(rows) {
    const g = {}
    for (const row of rows) {
      if (!g[row.block]) g[row.block] = {}
      if (!g[row.block][row.bolim]) g[row.block][row.bolim] = {}
      g[row.block][row.bolim][row.floor] = row.price
    }
    return g
  }

  const grouped   = buildGrouped(allPrices)
  const groupedWc = buildGrouped(allWcPrices)

  if (!user || !canFetch) return null

  if (!step || step === 'landing') {
    return <LandingStep zh={zh}
      onBolim={() => goBlock('A')}
      onAlohida={() => setParams({ step: 'excel' }, { replace: true })}
    />
  }

  if (step === 'excel') {
    return <ApartmentPriceSheet onBack={goLanding} zh={zh} />
  }

  return (
    <BlockStep
      key={blockId}
      blockId={blockId}
      onSwitchBlock={goBlock}
      onBack={goLanding}
      grouped={grouped}
      groupedWc={groupedWc}
      mode={mode}
      onModeChange={setMode}
      zh={zh}
    />
  )
}
