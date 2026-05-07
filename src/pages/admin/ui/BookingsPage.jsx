import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getUser, apiFetch } from '@/shared/lib/auth'
import { useRealtimeApts } from '@/shared/hooks/useRealtimeApts'
import { Search, X, SlidersHorizontal, Tag } from 'lucide-react'
import { BookingsTable } from './BookingsTable'

const BLOCKS      = ['A', 'B', 'C']
const ALL_BOLIMS  = [1,2,3,4,5,6,7,8,9,10,11,12,13]
const BOLIMS_BY_BLOCK = { A: [1,2,3,4,5,6,7,8,9,10,11], B: ALL_BOLIMS, C: ALL_BOLIMS }
const ALL_FLOORS  = [1, 2]

export default function BookingsPage() {
  useRealtimeApts()
  const user    = getUser()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()

  const [tab,           setTab]           = useState('active')
  const [search,        setSearch]        = useState('')
  const [typeFilter,    setTypeFilter]    = useState('all')
  const [blockFilter,   setBlockFilter]   = useState('')
  const [bolimFilter,   setBolimFilter]   = useState('')
  const [floorFilter,   setFloorFilter]   = useState('')
  const [dateFrom,      setDateFrom]      = useState('')
  const [dateTo,        setDateTo]        = useState('')
  const [managerFilter, setManagerFilter] = useState('')
  const [filterOpen,    setFilterOpen]    = useState(false)
  const [managers,      setManagers]      = useState([])
  const [sourceFilter,  setSourceFilter]  = useState('')
  const [bulkMode,      setBulkMode]      = useState(false)
  const [selectedIds,   setSelectedIds]   = useState(new Set())
  const [bulkSourceId,  setBulkSourceId]  = useState('')
  const [bulkLoading,   setBulkLoading]   = useState(false)

  const { data: sourcesData = [] } = useQuery({
    queryKey: ['sources'],
    queryFn: () => apiFetch('/api/sources').then(r => r.json()),
  })

  // Pending filter state — applied only on "Qo'llash"
  const [pendingType,    setPendingType]    = useState('all')
  const [pendingBlock,   setPendingBlock]   = useState('')
  const [pendingBolim,   setPendingBolim]   = useState('')
  const [pendingFloor,   setPendingFloor]   = useState('')
  const [pendingFrom,    setPendingFrom]    = useState('')
  const [pendingTo,      setPendingTo]      = useState('')
  const [pendingManager, setPendingManager] = useState('')
  const [pendingSource,  setPendingSource]  = useState('')

  useEffect(() => {
    if (!isAdmin) return
    apiFetch('/api/managers').then(r => r.json()).then(list => {
      if (Array.isArray(list)) setManagers(list)
    }).catch(() => {})
  }, [isAdmin])

  function openSheet() {
    setPendingType(typeFilter); setPendingBlock(blockFilter); setPendingBolim(bolimFilter)
    setPendingFloor(floorFilter); setPendingFrom(dateFrom); setPendingTo(dateTo)
    setPendingManager(managerFilter); setPendingSource(sourceFilter)
    setFilterOpen(true)
  }

  function applyFilters() {
    setTypeFilter(pendingType); setBlockFilter(pendingBlock); setBolimFilter(pendingBolim)
    setFloorFilter(pendingFloor); setDateFrom(pendingFrom); setDateTo(pendingTo)
    setManagerFilter(pendingManager); setSourceFilter(pendingSource)
    setFilterOpen(false)
  }

  function clearPending() {
    setPendingType('all'); setPendingBlock(''); setPendingBolim(''); setPendingFloor('')
    setPendingFrom(''); setPendingTo(''); setPendingManager(''); setPendingSource('')
  }

  function resetFilters() {
    setSearch(''); setTypeFilter('all'); setBlockFilter(''); setBolimFilter('')
    setFloorFilter(''); setDateFrom(''); setDateTo(''); setManagerFilter(''); setSourceFilter('')
  }

  const activeFilterCount = [typeFilter !== 'all' ? typeFilter : '', blockFilter, bolimFilter, floorFilter, dateFrom, dateTo, managerFilter, sourceFilter].filter(Boolean).length

  function toggleBulk() { setBulkMode(v => !v); setSelectedIds(new Set()); setBulkSourceId('') }
  function handleSelect(id) {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  async function applyBulkSource() {
    if (!bulkSourceId || selectedIds.size === 0) return
    setBulkLoading(true)
    try {
      await apiFetch('/api/bookings/bulk-source', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), source_id: bulkSourceId === 'none' ? null : parseInt(bulkSourceId) }),
      })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setSelectedIds(new Set()); setBulkSourceId(''); setBulkMode(false)
    } finally {
      setBulkLoading(false)
    }
  }

  function onReset() {
    queryClient.invalidateQueries({ queryKey: ['bookings'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['apartments'] })
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-3 h-full min-h-0 overflow-hidden relative">

      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-3 -mx-4 px-4 md:-mx-6 md:px-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 flex-wrap pt-1">
          <h1 className="text-2xl font-bold">Bitimlar</h1>
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            {[{ key: 'active', label: 'Faol bitimlar' }, { key: 'cancelled', label: 'Bekor qilingan' }].map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); resetFilters() }}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div className="relative shrink-0 w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Ism, xonadon yoki telefon..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button onClick={() => { setTypeFilter('all'); setBlockFilter(''); setBolimFilter(''); setFloorFilter(''); setDateFrom(''); setDateTo(''); setManagerFilter(''); setSourceFilter('') }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
              <X size={13} strokeWidth={2.5} /> Tozalash
            </button>
          )}

          <button onClick={openSheet}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors shrink-0 ${activeFilterCount > 0 ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
            <SlidersHorizontal size={14} />
            Filter
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-background text-foreground text-xs font-bold flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>

          {isAdmin && tab === 'active' && sourcesData.length > 0 && (
            <button onClick={toggleBulk}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors shrink-0 ${bulkMode ? 'border-blue-500 bg-blue-500 text-white' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
              <Tag size={14} />
              {bulkMode ? 'Bekor' : 'Manbaa biriktirish'}
            </button>
          )}
        </div>
      </div>

      <BookingsTable
        key={tab} cancelled={tab === 'cancelled'} isAdmin={isAdmin} onReset={onReset}
        search={search} typeFilter={typeFilter} blockFilter={blockFilter} bolimFilter={bolimFilter}
        floorFilter={floorFilter} dateFrom={dateFrom} dateTo={dateTo}
        managerFilter={managerFilter} sourceFilter={sourceFilter}
        bulkMode={bulkMode} selectedIds={selectedIds} onSelect={handleSelect}
      />

      {bulkMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 px-5 py-3 bg-background border border-border rounded-2xl shadow-2xl">
            <span className="text-sm font-semibold text-foreground">{selectedIds.size} ta tanlandi</span>
            <select value={bulkSourceId} onChange={e => setBulkSourceId(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Manbaa tanlang</option>
              {sourcesData.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="none">— Manbaa yo'q (tozalash)</option>
            </select>
            <button onClick={applyBulkSource} disabled={!bulkSourceId || bulkLoading}
              className="px-4 py-1.5 rounded-xl bg-foreground text-background text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-80">
              {bulkLoading ? 'Saqlanmoqda...' : 'Biriktirish'}
            </button>
          </div>
        </div>
      )}

      {filterOpen && (
        <div className="absolute inset-0 z-30 flex flex-col justify-end" onClick={() => setFilterOpen(false)}>
          <div className="absolute inset-0 bg-black/40 sheet-backdrop" />
          <div className="relative bg-background rounded-t-2xl shadow-2xl max-h-[72vh] flex flex-col sheet-panel" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2.5 pb-1 shrink-0"><div className="w-8 h-1 rounded-full bg-border" /></div>
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-border shrink-0">
              <span className="text-sm font-bold">Filter</span>
              <button onClick={() => setFilterOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                <X size={13} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-4">
              <FilterGroup label="Tur">
                {[{ key: 'all', label: 'Hammasi' }, { key: 'bron', label: 'Bron' }, { key: 'sotish', label: 'Sotilgan' }].map(f => (
                  <FilterBtn key={f.key} active={pendingType === f.key} onClick={() => setPendingType(f.key)}>{f.label}</FilterBtn>
                ))}
              </FilterGroup>

              <FilterGroup label="Blok">
                {['', ...BLOCKS].map(b => (
                  <FilterBtn key={b || 'all'} active={pendingBlock === b} onClick={() => {
                    const newBolims = b ? BOLIMS_BY_BLOCK[b] : Object.values(BOLIMS_BY_BLOCK).flat()
                    const bolimStillValid = pendingBolim && newBolims.includes(Number(pendingBolim))
                    setPendingBlock(b)
                    if (!bolimStillValid) setPendingBolim('')
                    setPendingFloor('')
                  }}>{b || 'Barcha'}</FilterBtn>
                ))}
              </FilterGroup>

              <FilterGroup label="Bo'lim" wrap>
                <FilterBtn active={!pendingBolim} onClick={() => { setPendingBolim(''); setPendingFloor('') }}>Barcha</FilterBtn>
                {(pendingBlock ? BOLIMS_BY_BLOCK[pendingBlock] : ALL_BOLIMS).map(n => (
                  <FilterBtn key={n} active={pendingBolim === String(n)} onClick={() => { setPendingBolim(String(n)); setPendingFloor('') }}>{n}</FilterBtn>
                ))}
              </FilterGroup>

              <FilterGroup label="Qavat" wrap>
                <FilterBtn active={!pendingFloor} onClick={() => setPendingFloor('')}>Barcha</FilterBtn>
                {ALL_FLOORS.map(f => (
                  <FilterBtn key={f} active={pendingFloor === String(f)} onClick={() => setPendingFloor(String(f))}>{f}-qavat</FilterBtn>
                ))}
              </FilterGroup>

              {isAdmin && managers.length > 0 && (
                <FilterGroup label="Menejer" wrap>
                  <FilterBtn active={!pendingManager} onClick={() => setPendingManager('')}>Barcha</FilterBtn>
                  {managers.map(m => (
                    <FilterBtn key={m.id} active={pendingManager === String(m.id)} onClick={() => setPendingManager(String(m.id))}>{m.name}</FilterBtn>
                  ))}
                </FilterGroup>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sana</p>
                <div className="flex items-center gap-2">
                  <input type="date" value={pendingFrom} onChange={e => setPendingFrom(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                  <span className="text-muted-foreground text-xs">—</span>
                  <input type="date" value={pendingTo} onChange={e => setPendingTo(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>

              {sourcesData.length > 0 && (
                <FilterGroup label="Manbaa" wrap>
                  <FilterBtn active={!pendingSource} onClick={() => setPendingSource('')}>Barcha</FilterBtn>
                  {sourcesData.map(s => (
                    <FilterBtn key={s.id} active={pendingSource === String(s.id)} onClick={() => setPendingSource(String(s.id))}>{s.name}</FilterBtn>
                  ))}
                  <FilterBtn active={pendingSource === 'none'} onClick={() => setPendingSource('none')}>Manbaa yo'q</FilterBtn>
                </FilterGroup>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border flex gap-2 shrink-0">
              <button onClick={clearPending} className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Tozalash</button>
              <button onClick={applyFilters} className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity">Qo'llash</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterGroup({ label, children, wrap = false }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
      <div className={`flex gap-1.5 ${wrap ? 'flex-wrap items-start content-start' : ''}`}>{children}</div>
    </div>
  )
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
      {children}
    </button>
  )
}
