import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getUser, apiFetch } from '@/shared/lib/auth'
import { useRealtimeApts } from '@/shared/hooks/useRealtimeApts'
import { TrendingUp, ShoppingCart, Clock, LayoutGrid, Medal, Ban } from 'lucide-react'

/* ── Palette ──────────────────────────────────────────────────────────────── */
const C = { SOLD: '#ef4444', RESERVED: '#f59e0b', EMPTY: '#22c55e', NOT_SALE: '#6b7280' }
const LABEL = { SOLD: 'Sotilgan', RESERVED: 'Bron', EMPTY: "Bo'sh", NOT_SALE: 'Sotilmaydi' }
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
function BlockCard({ blockId, stats }) {
  const segs = [
    { value: stats.SOLD     ?? 0, color: C.SOLD },
    { value: stats.RESERVED ?? 0, color: C.RESERVED },
    { value: stats.EMPTY    ?? 0, color: C.EMPTY },
    { value: stats.NOT_SALE ?? 0, color: C.NOT_SALE },
  ]
  const total = segs.reduce((s, d) => s + d.value, 0)
  const pct = v => total > 0 ? Math.round(v / total * 100) : 0
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{blockId}-Blok</p>
      {/* Donut centered */}
      <div className="relative mx-auto">
        <DonutChart segments={segs} size={90} stroke={14} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-base font-bold leading-none">{total}</span>
          <span className="text-[9px] text-muted-foreground">jami</span>
        </div>
      </div>
      {/* Legend compact */}
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
function StackedBar({ label, sold, reserved, empty, notSale = 0, maxTotal }) {
  const total = sold + reserved + empty + notSale
  const w = v => maxTotal > 0 ? (v / maxTotal * 100) : 0

  const segments = [
    { key: 'sold',     value: sold,     color: C.SOLD,     labelText: "Sotilgan" },
    { key: 'reserved', value: reserved, color: C.RESERVED, labelText: "Bron" },
    { key: 'empty',    value: empty,    color: C.EMPTY,    labelText: "Bo'sh" },
    { key: 'notSale',  value: notSale,  color: C.NOT_SALE, labelText: "Sotilmaydi" },
  ]
  const visible = segments.filter(s => s.value > 0)
  const isMulti = visible.length > 1

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-5 text-right shrink-0 tabular-nums font-medium">{label}</span>
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* Bar */}
        <div className="flex h-5 rounded-lg overflow-hidden bg-muted/40 w-full">
          {visible.map(({ key, value, color }) => (
            <div
              key={key}
              style={{ width: `${w(value)}%`, background: color }}
              className="h-full transition-all duration-500"
            />
          ))}
        </div>
        {/* Always-visible breakdown — only when multiple segments exist */}
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
const PRESETS = [
  { label: 'Bugun',    get: () => ({ from: today(), to: today() }) },
  { label: 'Bu hafta', get: thisWeek },
  { label: 'Bu oy',    get: thisMonth },
  { label: 'Hammasi',  get: () => ({ from: '', to: '' }) },
]

function DateRangeFilter({ value, onChange }) {
  const { from, to } = value
  const activePreset = PRESETS.findIndex(p => {
    const v = p.get()
    return v.from === from && v.to === to
  })
  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Preset pills */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => onChange(p.get())}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              i === activePreset
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {/* Manual inputs */}
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

/* ── Manager leaderboard ──────────────────────────────────────────────────── */
const MEDALS = ['🥇', '🥈', '🥉']

function ManagerCard({ manager, rank, maxTotal }) {
  const { name, username, sotish, bron, total, last_at } = manager
  const sotishW = maxTotal > 0 ? (sotish / maxTotal * 100) : 0
  const bronW   = maxTotal > 0 ? (bron   / maxTotal * 100) : 0
  const initials = (name || username || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const lastDate = last_at ? new Date(last_at).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

  return (
    <div className={`bg-card border rounded-2xl p-4 flex flex-col gap-3 transition-shadow hover:shadow-sm ${rank === 0 ? 'border-amber-200 dark:border-amber-800' : 'border-border'}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${
            rank === 0 ? 'bg-amber-500' : rank === 1 ? 'bg-slate-400' : rank === 2 ? 'bg-orange-400' : 'bg-muted-foreground/40'
          }`}>
            {initials}
          </div>
          {rank < 3 && (
            <span className="absolute -top-1 -right-1 text-sm leading-none">{MEDALS[rank]}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{name || username}</p>
          <p className="text-xs text-muted-foreground">So'nggi: {lastDate}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold tabular-nums leading-none">{total}</p>
          <p className="text-[10px] text-muted-foreground">jami</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/40 gap-px">
        {sotish > 0 && <div style={{ width: `${sotishW}%`, background: C.SOLD }}     className="h-full transition-all duration-700" />}
        {bron   > 0 && <div style={{ width: `${bronW}%`,   background: C.RESERVED }} className="h-full transition-all duration-700" />}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 flex-1">
          <span className="w-2 h-2 rounded-full" style={{ background: C.SOLD }} />
          <span className="text-xs text-muted-foreground">Sotish</span>
          <span className="text-xs font-bold ml-auto tabular-nums" style={{ color: C.SOLD }}>{sotish}</span>
        </div>
        <div className="w-px h-3 bg-border shrink-0" />
        <div className="flex items-center gap-1.5 flex-1">
          <span className="w-2 h-2 rounded-full" style={{ background: C.RESERVED }} />
          <span className="text-xs text-muted-foreground">Bron</span>
          <span className="text-xs font-bold ml-auto tabular-nums" style={{ color: C.RESERVED }}>{bron}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Legend ───────────────────────────────────────────────────────────────── */
function Legend() {
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
const DETAIL_TABS = [
  { key: 'bolim', label: "Bo'limlar" },
  { key: 'floor', label: 'Qavatlar' },
]

export default function DashboardPage() {
  useRealtimeApts()
  const user    = getUser()
  const isAdmin = user?.role === 'admin'

  const [detailTab,   setDetailTab]   = useState('bolim')
  const [blockFilter, setBlockFilter] = useState('A')
  const [dateRange,   setDateRange]   = useState({ from: '', to: '' })

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
    enabled: isAdmin,
  })

  if (isLoading) return (
    <div className="p-6 grid grid-cols-2 gap-3 max-w-5xl">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 rounded-2xl bg-muted/40 animate-pulse" />
      ))}
    </div>
  )

  const { total = {}, blocks = {}, myStats = {}, totalBookings = 0 } = dash ?? {}
  const { byBolim = [], byFloor = [] } = stats ?? {}

  const detailSource = detailTab === 'bolim' ? byBolim : byFloor
  const detailKey    = detailTab === 'bolim' ? 'bolim' : 'floor'
  const detailRows   = detailSource
    .filter(r => r.block === blockFilter)
    .map(r => ({ label: String(r[detailKey]), sold: r.SOLD ?? 0, reserved: r.RESERVED ?? 0, empty: r.EMPTY ?? 0, notSale: r.NOT_SALE ?? 0 }))
  const maxTotal = Math.max(...detailRows.map(r => r.sold + r.reserved + r.empty + r.notSale), 1)
  const maxManagerTotal = Math.max(...managers.map(m => m.total), 1)

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 w-full">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stat cards — 2 cols always, clean on tablet */}
      <div className="grid grid-cols-2 gap-3">
        {isAdmin ? (
          <>
            <StatCard label="Sotilgan"      value={total.SOLD}          color={C.SOLD}     icon={ShoppingCart} />
            <StatCard label="Bron"          value={total.RESERVED}      color={C.RESERVED} icon={Clock} />
            <StatCard label="Bo'sh"         value={total.EMPTY}         color={C.EMPTY}    icon={LayoutGrid} />
            <StatCard label="Sotilmaydi"    value={total.NOT_SALE ?? 0} color={C.NOT_SALE} icon={Ban} />
            <StatCard label="Jami bitimlar" value={totalBookings}       color="#6366f1"    icon={TrendingUp} />
          </>
        ) : (
          <>
            <StatCard label="Sotish"        value={myStats.sotish} color={C.SOLD}     icon={ShoppingCart} />
            <StatCard label="Bron qilish"   value={myStats.bron}   color={C.RESERVED} icon={Clock} />
            <StatCard label="Jami bitimlar" value={totalBookings}  color="#6366f1"    icon={TrendingUp} />
          </>
        )}
      </div>

      {/* Bloklar donuts — 3 cols always (3 ta blok) */}
      {isAdmin && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bloklar bo'yicha</h2>
          <div className="grid grid-cols-3 gap-3">
            {BLOCKS.map(b => <BlockCard key={b} blockId={b} stats={blocks[b] ?? {}} />)}
          </div>
        </section>
      )}

      {/* Bo'lim / Qavat detail */}
      {isAdmin && (
        <section className="flex flex-col gap-3">
          {/* Controls row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 p-1 bg-muted rounded-xl">
              {DETAIL_TABS.map(t => (
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
            <Legend />
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
            <p className="text-sm font-semibold text-muted-foreground">
              {blockFilter}-blok · {detailTab === 'bolim' ? "bo'limlar" : 'qavatlar'} kesimida
            </p>
            <div className="flex flex-col gap-2.5">
              {detailRows.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-6">Ma'lumot yo'q</p>
                : detailRows.map((r, i) => <StackedBar key={i} {...r} maxTotal={maxTotal} />)
              }
            </div>
          </div>
        </section>
      )}

      {/* Manager leaderboard */}
      {isAdmin && (
        <section className="flex flex-col gap-4">
          {/* Title row */}
          <div className="flex items-center gap-2">
            <Medal size={16} className="text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Menejerlar reytingi</h2>
          </div>

          {/* Date filter — full width row */}
          <DateRangeFilter value={dateRange} onChange={setDateRange} />

          {managers.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground text-sm">
              {dateRange.from || dateRange.to ? "Bu davrda bitim yo'q" : "Hali bitim yo'q"}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {managers.map((m, i) => (
                <ManagerCard key={m.id} manager={m} rank={i} maxTotal={maxManagerTotal} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
