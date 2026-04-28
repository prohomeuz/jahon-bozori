import GENPLAN from '@/assets/genplan.webp'
import ABLOK from '@/assets/blocks/A-BLOK.webp'
import BBLOK from '@/assets/blocks/B-BLOK.webp'
import CBLOK from '@/assets/blocks/C-BLOK.webp'
import { useRef, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { imgCache } from '@/shared/lib/imgCache'
import { apiFetch, getUser } from '@/shared/lib/auth'
import { BLOCK_BUILDINGS, BLOCK_VIEW_BOX } from '@/pages/block/config/buildings'
import { Check, X } from 'lucide-react'

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
        Narx belgilash uchun blokni tanlang
      </div>
    </div>
  )
}

// ─── Step 2: Block — bo'lim tanlash + inline narx tahrirlash ─────────────────

const WC_BOLIMS = [1, 3]

function BlockStep({ blockId, onSwitchBlock, grouped, groupedWc, mode, onModeChange }) {
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
    <div className="absolute inset-0 bg-black overflow-hidden">
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
              // WC mode'da faqat 1 va 3-bo'limlar active
              const isDisabled = mode === 'wc' && !WC_BOLIMS.includes(num)
              const bolimFloors = activeGrouped[blockId]?.[num] ?? {}
              const floorNums = Object.keys(bolimFloors).map(Number).sort()
              const hasTwo = floorNums.length >= 2
              const p1Raw = bolimFloors[floorNums[0]] ?? defaultPrice
              const p2Raw = hasTwo ? (bolimFloors[floorNums[1]] ?? defaultPrice) : null
              const editNum = Number(String(editVal).replace(/[\s,]/g, ''))
              const p1 = isSelected && activeFloor === floorNums[0] && !isNaN(editNum) ? editNum : p1Raw
              const p2 = isSelected && hasTwo && activeFloor === floorNums[1] && !isNaN(editNum) ? editNum : p2Raw
              // badge dimensions
              const bw = 124, bh = hasTwo ? 60 : 40, br = 10
              const bx = b.textX - bw / 2, by = b.textY - bh / 2
              const priceColor = isSelected ? '#1a0f00' : isDisabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.95)'
              const bgFill   = isSelected ? 'rgba(251,191,36,0.97)' : isDisabled ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.78)'
              const bgStroke = isSelected ? 'rgba(180,130,0,0.6)'   : isDisabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.18)'

              return (
                <g key={b.id} style={{
                  opacity:         isDisabled ? 0 : 1,
                  transform:       isDisabled ? 'scale(0.92)' : 'scale(1)',
                  transformOrigin: `${b.textX}px ${b.textY}px`,
                  transition:      'opacity 0.4s cubic-bezier(0.4,0,0.2,1), transform 0.4s cubic-bezier(0.4,0,0.2,1)',
                  pointerEvents:   isDisabled ? 'none' : 'all',
                }}>
                  {/* Base pulse polygon */}
                  <polygon points={b.points}
                    fill={isSelected ? 'rgba(251,191,36,0.35)' : isHovered ? 'rgba(255,255,255,0.08)' : 'black'}
                    stroke={isSelected ? 'rgba(251,191,36,0.9)' : 'rgba(0,0,0,0.75)'}
                    strokeWidth={isSelected ? 3 : 1}
                    strokeLinejoin="round"
                    className={!isSelected && !isHovered && !isDisabled ? 'block-pulse' : ''}
                    style={{ cursor: isDisabled ? 'default' : 'pointer', animationDelay: b.delay }}
                    onMouseEnter={() => !isDisabled && setHovered(b.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => !isDisabled && selectBolim(b)}
                  />
                  {/* White border */}
                  <polygon points={b.points} fill="none"
                    stroke={isSelected ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.3)'}
                    strokeWidth={isSelected ? 4 : 3} strokeLinejoin="round" pointerEvents="none"
                  />

                  {/* Price badge */}
                  <g pointerEvents="none">
                    <rect x={bx} y={by} width={bw} height={bh} rx={br}
                      fill={bgFill} stroke={bgStroke} strokeWidth={1.5}
                    />
                    {hasTwo ? (
                      <>
                        {/* divider */}
                        <line x1={bx + 10} y1={b.textY} x2={bx + bw - 10} y2={b.textY}
                          stroke={isSelected ? 'rgba(180,130,0,0.25)' : 'rgba(255,255,255,0.12)'} strokeWidth={1} />
                        {/* floor 1 */}
                        <rect x={bx + 7} y={by + 7} width={20} height={16} rx={4}
                          fill={isSelected ? 'rgba(120,80,0,0.18)' : 'rgba(255,255,255,0.15)'} />
                        <text x={bx + 17} y={by + 15} textAnchor="middle" dominantBaseline="middle"
                          fontSize={11} fontWeight="800" fontFamily="ui-sans-serif,sans-serif" fill={isSelected ? '#92400e' : 'rgba(255,255,255,0.7)'}>
                          {floorNums[0]}
                        </text>
                        <text x={bx + bw - 8} y={by + 15} textAnchor="end" dominantBaseline="middle"
                          fontSize={18} fontWeight="bold" fontFamily="ui-monospace,monospace" fill={priceColor}>
                          ${p1.toLocaleString('ru-RU')}
                        </text>
                        {/* floor 2 */}
                        <rect x={bx + 7} y={by + bh - 23} width={20} height={16} rx={4}
                          fill={isSelected ? 'rgba(120,80,0,0.18)' : 'rgba(255,255,255,0.15)'} />
                        <text x={bx + 17} y={by + bh - 15} textAnchor="middle" dominantBaseline="middle"
                          fontSize={11} fontWeight="800" fontFamily="ui-sans-serif,sans-serif" fill={isSelected ? '#92400e' : 'rgba(255,255,255,0.7)'}>
                          {floorNums[1]}
                        </text>
                        <text x={bx + bw - 8} y={by + bh - 15} textAnchor="end" dominantBaseline="middle"
                          fontSize={18} fontWeight="bold" fontFamily="ui-monospace,monospace" fill={priceColor}>
                          ${p2.toLocaleString('ru-RU')}
                        </text>
                      </>
                    ) : (
                      <text x={b.textX} y={b.textY} textAnchor="middle" dominantBaseline="middle"
                        fontSize={22} fontWeight="bold" fontFamily="ui-monospace,monospace" fill={priceColor}>
                        ${p1.toLocaleString('ru-RU')}
                      </text>
                    )}
                  </g>
                </g>
              )
            })}
          </svg>
      </div>

      {/* Top hint */}
      {!panelOpen && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 text-white text-sm font-medium pointer-events-none">
          {mode === 'wc' ? "WC narxini o'zgartirish uchun bo'limni tanlang" : "Narx o'zgartirish uchun bo'limni tanlang"}
        </div>
      )}

      {/* Top left mode switcher */}
      <div className="absolute top-6 left-6 flex gap-1 p-1 bg-black/70 backdrop-blur-sm border border-white/10 rounded-xl">
        <button onClick={() => onModeChange('dokonlar')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'dokonlar' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>
          Do'konlar
        </button>
        <button onClick={() => onModeChange('wc')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'wc' ? 'bg-sky-400 text-sky-950' : 'text-white/60 hover:text-white'}`}>
          WC
        </button>
      </div>

      {/* Top right block switcher */}
      <div className="absolute top-6 right-6 flex items-center gap-2">
        {['A','B','C'].map(bid => (
          <button key={bid} onClick={() => bid !== blockId ? onSwitchBlock(bid) : null}
            className={`w-12 h-12 rounded-2xl text-base font-bold shadow-xl transition-all active:scale-95 ${bid === blockId ? 'bg-white text-black scale-110 shadow-white/20' : 'bg-black/80 text-white backdrop-blur-sm hover:bg-black/60'}`}>
            {bid}
          </button>
        ))}
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
                  <p className="text-sm font-black text-foreground leading-tight truncate">{blockId}-BLOK · {selected?.bolimNum}-bo'lim</p>
                  <p className="text-xs text-muted-foreground">{activeFloor}-qavat {mode === 'wc' ? 'WC' : "do'kon"} narxi</p>
                </div>
              </div>

              {/* Floor tabs */}
              {selectedFloors.length > 1 && (
                <div className="flex gap-1 p-0.5 bg-muted rounded-xl">
                  {selectedFloors.map(f => (
                    <button key={f} onClick={() => changeFloor(f)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all touch-manipulation ${activeFloor === f ? 'bg-amber-400 text-amber-900 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                      {f}-qavat
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
  const [mode, setMode] = useState('dokonlar') // 'dokonlar' | 'wc'

  const step    = params.get('step')  ?? 'genplan'
  const blockId = params.get('block') ?? 'A'

  function goBlock(bid) { setParams({ step: 'block', block: bid }, { replace: true }) }

  useEffect(() => {
    if (user?.role !== 'admin') navigate('/admin', { replace: true })
  }, [])

  const { data: allPrices = [] } = useQuery({
    queryKey: ['prices-all'],
    queryFn: () => apiFetch('/api/prices/all').then(r => r.json()),
    staleTime: 60_000,
    enabled: user?.role === 'admin',
  })

  const { data: allWcPrices = [] } = useQuery({
    queryKey: ['prices-all-wc'],
    queryFn: () => apiFetch('/api/prices/all?is_wc=1').then(r => r.json()),
    staleTime: 60_000,
    enabled: user?.role === 'admin',
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

  if (!user || user.role !== 'admin') return null

  if (step === 'genplan') {
    return <GenplanStep onSelect={goBlock} />
  }

  return (
    <BlockStep
      key={blockId}
      blockId={blockId}
      onSwitchBlock={goBlock}
      grouped={grouped}
      groupedWc={groupedWc}
      mode={mode}
      onModeChange={setMode}
    />
  )
}
