import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getUser, apiFetch } from '@/shared/lib/auth'
import { useRealtimeApts } from '@/shared/hooks/useRealtimeApts'
import { TrendingUp, ShoppingCart, Clock, LayoutGrid, Medal, Ban, Toilet, Store } from 'lucide-react'

/* ── Palette ──────────────────────────────────────────────────────────────── */
const C = { SOLD: '#ef4444', RESERVED: '#f59e0b', EMPTY: '#22c55e', NOT_SALE: '#6b7280' }
const LABEL_UZ = { SOLD: 'Sotilgan', RESERVED: 'Bron', EMPTY: "Bo'sh", NOT_SALE: 'Sotilmaydi' }
const LABEL_ZH = { SOLD: '已售出', RESERVED: '已預訂', EMPTY: '空置', NOT_SALE: '不出售' }
const BLOCKS = ['A', 'B', 'C']

/* ── Date helpers ─────────────────────────────────────────────────────────── */
function today()     { return new Date().toISOString().slice(0, 10) }
function thisMonth() {
  const d = new Date()
  return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, to: today() }
}
function thisWeek() {
  const d = new Date()
  const day = d.getDay() || 7
  const mon = new Date(d); mon.setDate(d.getDate() - day + 1)
  return { from: mon.toISOString().slice(0, 10), to: today() }
}

/* ── Donut chart ──────────────────────────────────────────────────────────── */
function DonutChart({ segments, size = 110, stroke = 16 }) {
  const r    = (size - stroke) / 2 - 1
  const circ = 2 * Math.PI * r
  const cx   = size / 2, cy = size / 2
  const total = segments.reduce((s, d) => s + d.value, 0)
  if (total === 0) return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
    </svg>
  )
  let offset = 0
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {segments.map((d, i) => {
        const dash = (d.value / total) * circ
        const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color}
          strokeWidth={stroke} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} />
        offset += dash
        return el
      })}
    </svg>
  )
}

/* ── Block donut card ─────────────────────────────────────────────────────── */
function BlockCard({ blockId, stats, zh }) {
  const LABEL = zh ? LABEL_ZH : LABEL_UZ
  const segs = [
    { value: stats.SOLD     ?? 0, color: C.SOLD },
    { value: stats.RESERVED ?? 0, color: C.RESERVED },
    { value: stats.EMPTY    ?? 0, color: C.EMPTY },
    { value: stats.NOT_SALE ?? 0, color: C.NOT_SALE },
  ]
  const total = segs.reduce((s, d) => s + d.value, 0)
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        {zh ? `${blockId}棟` : `${blockId}-Blok`}
      </p>
      <div className="relative mx-auto">
        <DonutChart segments={segs} size={90} stroke={14} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-base font-bold leading-none">{total}</span>
          <span className="text-[9px] text-muted-foreground">{zh ? '總計' : 'jami'}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {Object.entries(LABEL).map(([k, lbl], i) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: C[k] }} />
            <span className="text-xs text-muted-foreground flex-1 truncate">{lbl}</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: C[k] }}>{segs[i].value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Stacked horizontal bar ───────────────────────────────────────────────── */
function StackedBar({ label, sold, reserved, empty, notSale = 0, maxTotal, zh }) {
  const total = sold + reserved + empty + notSale
  const w = v => maxTotal > 0 ? (v / maxTotal * 100) : 0

  const segments = [
    { key: 'sold',     value: sold,     color: C.SOLD,     labelText: zh ? '已售出' : 'Sotilgan' },
    { key: 'reserved', value: reserved, color: C.RESERVED, labelText: zh ? '已預訂' : 'Bron' },
    { key: 'empty',    value: empty,    color: C.EMPTY,    labelText: zh ? '空置'   : "Bo'sh" },
    { key: 'notSale',  value: notSale,  color: C.NOT_SALE, labelText: zh ? '不出售' : 'Sotilmaydi' },
  ]
  const visible = segments.filter(s => s.value > 0)
  const isMulti = visible.length > 1

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-5 text-right shrink-0 tabular-nums font-medium">{label}</span>
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex h-5 rounded-lg overflow-hidden bg-muted/40 w-full">
          {visible.map(({ key, value, color }) => (
            <div key={key} style={{ width: `${w(value)}%`, background: color }} className="h-full transition-all duration-500" />
          ))}
        </div>
        {isMulti && (
          <div className="flex items-center gap-3">
            {visible.map(({ key, value, color, labelText }) => (
              <div key={key} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-[10px] text-muted-foreground">{labelText}</span>
                <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <span className="text-xs text-muted-foreground w-7 text-right tabular-nums shrink-0">{total}</span>
    </div>
  )
}

/* ── Stat card ────────────────────────────────────────────────────────────── */
function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '18' }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums leading-tight" style={{ color }}>{value ?? 0}</p>
      </div>
    </div>
  )
}

/* ── Date range filter ────────────────────────────────────────────────────── */
function DateRangeFilter({ value, onChange, zh }) {
  const PRESETS = [
    { label: zh ? '今天'  : 'Bugun',    get: () => ({ from: today(), to: today() }) },
    { label: zh ? '本週'  : 'Bu hafta', get: thisWeek },
    { label: zh ? '本月'  : 'Bu oy',    get: thisMonth },
    { label: zh ? '全部'  : 'Hammasi',  get: () => ({ from: '', to: '' }) },
  ]
  const { from, to } = value
  const activePreset = PRESETS.findIndex(p => {
    const v = p.get()
    return v.from === from && v.to === to
  })
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {PRESETS.map((p, i) => (
          <button key={p.label} onClick={() => onChange(p.get())}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              i === activePreset ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input type="date" value={from} max={to || today()}
          onChange={e => onChange({ from: e.target.value, to })}
          className="text-sm px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring flex-1 min-w-0" />
        <span className="text-muted-foreground text-xs shrink-0">→</span>
        <input type="date" value={to} min={from} max={today()}
          onChange={e => onChange({ from, to: e.target.value })}
          className="text-sm px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring flex-1 min-w-0" />
      </div>
    </div>
  )
}

/* ── Manager leaderboard card ─────────────────────────────────────────────── */
const MEDALS = ['🥇', '🥈', '🥉']

function ManagerCard({ manager, rank, maxTotal, zh }) {
  const { name, username, sotish, bron, total, last_at } = manager
  const sotishW = maxTotal > 0 ? (sotish / maxTotal * 100) : 0
  const bronW   = maxTotal > 0 ? (bron   / maxTotal * 100) : 0
  const initials = (name || username || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const lastDate = last_at ? new Date(last_at).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

  return (
    <div className={`bg-card border rounded-2xl p-4 flex flex-col gap-3 transition-shadow hover:shadow-sm ${rank === 0 ? 'border-amber-200 dark:border-amber-800' : 'border-border'}`}>
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${
            rank === 0 ? 'bg-amber-500' : rank === 1 ? 'bg-slate-400' : rank === 2 ? 'bg-orange-400' : 'bg-muted-foreground/40'
          }`}>
            {initials}
          </div>
          {rank < 3 && <span className="absolute -top-1 -right-1 text-sm leading-none">{MEDALS[rank]}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{name || username}</p>
          <p className="text-xs text-muted-foreground">{zh ? `最近：${lastDate}` : `So'nggi: ${lastDate}`}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold tabular-nums leading-none">{total}</p>
          <p className="text-[10px] text-muted-foreground">{zh ? '總計' : 'jami'}</p>
        </div>
      </div>

      <div className="flex h-2 rounded-full overflow-hidden bg-muted/40 gap-px">
        {sotish > 0 && <div style={{ width: `${sotishW}%`, background: C.SOLD }}     className="h-full transition-all duration-700" />}
        {bron   > 0 && <div style={{ width: `${bronW}%`,   background: C.RESERVED }} className="h-full transition-all duration-700" />}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 flex-1">
          <span className="w-2 h-2 rounded-full" style={{ background: C.SOLD }} />
          <span className="text-xs text-muted-foreground">{zh ? '銷售' : 'Sotish'}</span>
          <span className="text-xs font-bold ml-auto tabular-nums" style={{ color: C.SOLD }}>{sotish}</span>
        </div>
        <div className="w-px h-3 bg-border shrink-0" />
        <div className="flex items-center gap-1.5 flex-1">
          <span className="w-2 h-2 rounded-full" style={{ background: C.RESERVED }} />
          <span className="text-xs text-muted-foreground">{zh ? '預訂' : 'Bron'}</span>
          <span className="text-xs font-bold ml-auto tabular-nums" style={{ color: C.RESERVED }}>{bron}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Legend ───────────────────────────────────────────────────────────────── */
function Legend({ zh }) {
  const LABEL = zh ? LABEL_ZH : LABEL_UZ
  return (
    <div className="flex items-center gap-4">
      {Object.entries(C).map(([k, color]) => (
        <div key={k} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="text-xs text-muted-foreground">{LABEL[k]}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  useRealtimeApts()
  const user      = getUser()
  const isAdmin   = user?.role === 'admin'
  const isNarxchi = user?.role === 'narxchi'
  const zh        = isNarxchi
  const isAdminLike = isAdmin || isNarxchi

  const [detailTab,       setDetailTab]       = useState('bolim')
  const [blockFilter,     setBlockFilter]     = useState('A')
  const [dateRange,       setDateRange]       = useState({ from: '', to: '' })
  const [inventoryTab,    setInventoryTab]    = useState('all')
  const [sourceDateRange, setSourceDateRange] = useState({ from: '', to: '' })
  const [sourceIncludeCancelled, setSourceIncludeCancelled] = useState(false)

  const { data: dash, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  () => apiFetch('/api/dashboard').then(r => r.json()),
    refetchInterval: 30_000,
  })

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn:  () => apiFetch('/api/stats').then(r => r.json()),
    refetchInterval: 30_000,
  })

  const { data: managers = [] } = useQuery({
    queryKey: ['managers', dateRange],
    queryFn:  () => {
      const p = new URLSearchParams()
      if (dateRange.from) p.set('from', dateRange.from)
      if (dateRange.to)   p.set('to',   dateRange.to)
      return apiFetch(`/api/stats/managers?${p}`).then(r => r.json())
    },
    enabled: isAdminLike,
  })

  const { data: sourceStats } = useQuery({
    queryKey: ['source-stats', sourceDateRange, sourceIncludeCancelled],
    queryFn: () => {
      const p = new URLSearchParams()
      if (sourceDateRange.from) p.set('from', sourceDateRange.from)
      if (sourceDateRange.to)   p.set('to',   sourceDateRange.to)
      if (sourceIncludeCancelled) p.set('cancelled', '1')
      return apiFetch(`/api/stats/sources?${p}`).then(r => r.json())
    },
    enabled: isAdminLike,
  })

  if (isLoading) return (
    <div className="p-6 grid grid-cols-2 gap-3 max-w-5xl">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 rounded-2xl bg-muted/40 animate-pulse" />
      ))}
    </div>
  )

  const { shopBlocks = {}, wcBlocks = {}, shopTotal = {}, wcTotal = {}, myStats = {}, totalBookings = 0 } = dash ?? {}

  const allBlocks = Object.fromEntries(
    ['A','B','C'].map(b => {
      const s = shopBlocks[b] ?? {}, w = wcBlocks[b] ?? {}
      return [b, {
        SOLD:     (s.SOLD     ?? 0) + (w.SOLD     ?? 0),
        RESERVED: (s.RESERVED ?? 0) + (w.RESERVED ?? 0),
        EMPTY:    (s.EMPTY    ?? 0) + (w.EMPTY    ?? 0),
        NOT_SALE: (s.NOT_SALE ?? 0) + (w.NOT_SALE ?? 0),
      }]
    })
  )
  const allTotal = {
    SOLD:     (shopTotal.SOLD     ?? 0) + (wcTotal.SOLD     ?? 0),
    RESERVED: (shopTotal.RESERVED ?? 0) + (wcTotal.RESERVED ?? 0),
    EMPTY:    (shopTotal.EMPTY    ?? 0) + (wcTotal.EMPTY    ?? 0),
    NOT_SALE: (shopTotal.NOT_SALE ?? 0) + (wcTotal.NOT_SALE ?? 0),
  }

  const activeBlocks = inventoryTab === 'shops' ? shopBlocks : inventoryTab === 'wc' ? wcBlocks : allBlocks
  const activeTotal  = inventoryTab === 'shops' ? shopTotal  : inventoryTab === 'wc' ? wcTotal  : allTotal
  const {
    byBolim = [], byBolimShops = [], byBolimWc = [],
    byFloor = [], byFloorShops = [], byFloorWc = [],
  } = stats ?? {}

  const byBolimActive = inventoryTab === 'shops' ? byBolimShops : inventoryTab === 'wc' ? byBolimWc : byBolim
  const byFloorActive = inventoryTab === 'shops' ? byFloorShops : inventoryTab === 'wc' ? byFloorWc : byFloor

  const detailSource = detailTab === 'bolim' ? byBolimActive : byFloorActive
  const detailKey    = detailTab === 'bolim' ? 'bolim' : 'floor'
  const detailRows   = detailSource
    .filter(r => r.block === blockFilter)
    .map(r => ({ label: String(r[detailKey]), sold: r.SOLD ?? 0, reserved: r.RESERVED ?? 0, empty: r.EMPTY ?? 0, notSale: r.NOT_SALE ?? 0 }))
  const maxTotal = Math.max(...detailRows.map(r => r.sold + r.reserved + r.empty + r.notSale), 1)
  const maxManagerTotal = Math.max(...managers.map(m => m.total), 1)

  const LABEL = zh ? LABEL_ZH : LABEL_UZ

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 w-full">
      <h1 className="text-2xl font-bold">{zh ? '儀表板' : 'Dashboard'}</h1>

      {/* Stat cards — faqat salesmanager uchun */}
      {!isAdminLike && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Sotish"        value={myStats.sotish} color={C.SOLD}     icon={ShoppingCart} />
          <StatCard label="Bron qilish"   value={myStats.bron}   color={C.RESERVED} icon={Clock} />
          <StatCard label="Jami bitimlar" value={totalBookings}  color="#6366f1"    icon={TrendingUp} />
        </div>
      )}

      {/* Bloklar donuts */}
      {isAdminLike && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {zh ? '按棟分類' : "Bloklar bo'yicha"}
            </h2>
            <div className="flex items-center bg-muted rounded-xl p-1 gap-0.5">
              <button onClick={() => setInventoryTab('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${inventoryTab === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {zh ? '全部' : 'Jami'}
              </button>
              <button onClick={() => setInventoryTab('shops')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${inventoryTab === 'shops' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <Store size={11} />
                {zh ? '商鋪' : "Do'konlar"}
              </button>
              <button onClick={() => setInventoryTab('wc')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${inventoryTab === 'wc' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <Toilet size={11} />
                {zh ? '衛生間' : 'Hojatxonalar'}
              </button>
            </div>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { key: 'SOLD',     value: activeTotal.SOLD          },
              { key: 'RESERVED', value: activeTotal.RESERVED      },
              { key: 'EMPTY',    value: activeTotal.EMPTY         },
              { key: 'NOT_SALE', value: activeTotal.NOT_SALE ?? 0 },
            ].map(({ key, value }) => (
              <div key={key} className="bg-card border border-border rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground font-medium">{LABEL[key]}</span>
                <span className="text-lg font-bold tabular-nums leading-tight" style={{ color: C[key] }}>{value ?? 0}</span>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">{zh ? '成交總數' : 'Jami bitimlar'}</span>
            <span className="text-lg font-bold tabular-nums" style={{ color: '#6366f1' }}>{totalBookings}</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {BLOCKS.map(b => <BlockCard key={b} blockId={b} stats={activeBlocks[b] ?? {}} zh={zh} />)}
          </div>
        </section>
      )}

      {/* Bo'lim / Qavat detail */}
      {isAdminLike && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 p-1 bg-muted rounded-xl">
              {[
                { key: 'bolim', label: zh ? '區域' : "Bo'limlar" },
                { key: 'floor', label: zh ? '樓層' : 'Qavatlar'  },
              ].map(t => (
                <button key={t.key} onClick={() => setDetailTab(t.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    detailTab === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 p-1 bg-muted rounded-xl">
              {BLOCKS.map(b => (
                <button key={b} onClick={() => setBlockFilter(b)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                    blockFilter === b ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {b}
                </button>
              ))}
            </div>
            <Legend zh={zh} />
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
            <p className="text-sm font-semibold text-muted-foreground">
              {zh
                ? `${blockFilter}棟 · 按${detailTab === 'bolim' ? '區域' : '樓層'}統計`
                : `${blockFilter}-blok · ${detailTab === 'bolim' ? "bo'limlar" : 'qavatlar'} kesimida`
              }
            </p>
            <div className="flex flex-col gap-2.5">
              {detailRows.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-6">{zh ? '暫無數據' : "Ma'lumot yo'q"}</p>
                : detailRows.map((r, i) => <StackedBar key={i} {...r} maxTotal={maxTotal} zh={zh} />)
              }
            </div>
          </div>
        </section>
      )}

      {/* Source stats */}
      {isAdminLike && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {zh ? '客戶來源' : 'Mijoz manbalari'}
            </h2>
          </div>

          <DateRangeFilter value={sourceDateRange} onChange={setSourceDateRange} zh={zh} />

          <label className="flex items-center gap-2.5 cursor-pointer w-fit">
            <span className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-colors ${sourceIncludeCancelled ? 'bg-foreground border-foreground' : 'border-border bg-background'}`}>
              {sourceIncludeCancelled && (
                <svg viewBox="0 0 12 10" className="w-3 h-2" fill="none">
                  <path d="M1 5l2.5 3L11 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
            <input type="checkbox" className="sr-only" checked={sourceIncludeCancelled} onChange={e => setSourceIncludeCancelled(e.target.checked)} />
            <span className="text-sm text-muted-foreground">
              {zh ? '包含已取消的' : 'Bekor qilinganlarni ham kiriting'}
            </span>
          </label>

          {(() => {
            const rows = sourceStats?.rows ?? []
            const noSource = sourceStats?.noSource ?? 0
            const allRows = noSource > 0 ? [...rows, { id: null, name: zh ? '未知' : "Noma'lum", n: noSource }] : rows
            const total = allRows.reduce((s, r) => s + r.n, 0)
            if (total === 0) return (
              <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground text-sm">
                {sourceDateRange.from || sourceDateRange.to
                  ? (zh ? '該時段暫無成交' : "Bu davrda bitim yo'q")
                  : (zh ? '暫無成交記錄'   : "Hali bitim yo'q")}
              </div>
            )
            const palette = ['#3b82f6','#f59e0b','#10b981','#8b5cf6','#ef4444','#06b6d4','#f97316','#84cc16','#ec4899','#6b7280']
            const segs = allRows.map((r, i) => ({ value: r.n, color: palette[i % palette.length] }))
            return (
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-5">
                <div className="flex items-center gap-8">
                  <div className="relative shrink-0">
                    <DonutChart segments={segs} size={130} stroke={20} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xl font-bold leading-none">{total}</span>
                      <span className="text-[10px] text-muted-foreground">{zh ? '總計' : 'jami'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2.5 flex-1 min-w-0">
                    {allRows.map((r, i) => {
                      const pct = total > 0 ? Math.round(r.n / total * 100) : 0
                      return (
                        <div key={r.id ?? 'none'} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: palette[i % palette.length] }} />
                          <span className="text-xs text-muted-foreground flex-1 truncate">{r.name}</span>
                          <span className="text-xs font-bold tabular-nums" style={{ color: palette[i % palette.length] }}>{r.n}</span>
                          <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
        </section>
      )}

      {/* Manager leaderboard */}
      {isAdminLike && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Medal size={16} className="text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {zh ? '銷售員排行' : 'Menejerlar reytingi'}
            </h2>
          </div>

          <DateRangeFilter value={dateRange} onChange={setDateRange} zh={zh} />

          {managers.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground text-sm">
              {dateRange.from || dateRange.to
                ? (zh ? '該時段暫無成交' : "Bu davrda bitim yo'q")
                : (zh ? '暫無成交記錄'   : "Hali bitim yo'q")}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {managers.map((m, i) => (
                <ManagerCard key={m.id} manager={m} rank={i} maxTotal={maxManagerTotal} zh={zh} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
