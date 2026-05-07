import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'
import { apiFetch } from '@/shared/lib/auth'
import { BookingRow } from './BookingRow'

const LIMIT = 50

export function BookingsTable({ cancelled, isAdmin, onReset, search, typeFilter, dateFrom, dateTo, blockFilter, bolimFilter, floorFilter, managerFilter, sourceFilter, bulkMode, selectedIds, onSelect }) {
  const [scrolled,      setScrolled]      = useState(false)
  const [scrolledRight, setScrolledRight] = useState(false)
  const scrollRef        = useRef(null)
  const hasNextPageRef   = useRef(false)
  const fetchingRef      = useRef(false)
  const fetchNextPageRef = useRef(() => {})

  const scrollRefCb = useCallback(node => {
    if (!node) return
    function onScroll() {
      setScrolled(node.scrollLeft > 4)
      setScrolledRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 4)
    }
    onScroll()
    node.addEventListener('scroll', onScroll, { passive: true })
    scrollRef.current = node
  }, [])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['bookings', cancelled ? 'cancelled' : 'active', search, typeFilter, dateFrom, dateTo, blockFilter, bolimFilter, floorFilter, managerFilter, sourceFilter],
    queryFn: ({ pageParam = 0 }) => {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(pageParam) })
      if (cancelled)            params.set('cancelled', '1')
      if (search)               params.set('search',    search)
      if (typeFilter !== 'all') params.set('type',      typeFilter)
      if (blockFilter)          params.set('block',     blockFilter)
      if (bolimFilter)          params.set('bolim',     bolimFilter)
      if (floorFilter)          params.set('floor',     floorFilter)
      if (dateFrom)             params.set('from',      dateFrom)
      if (dateTo)               params.set('to',        dateTo)
      if (managerFilter)        params.set('manager',   managerFilter)
      if (sourceFilter)         params.set('source',    sourceFilter)
      return apiFetch(`/api/bookings?${params}`).then(r => r.json())
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.rows.length < LIMIT ? undefined : allPages.flatMap(p => p.rows).length,
    placeholderData: keepPreviousData,
  })

  const total       = data?.pages[0]?.total ?? null
  const bookingsRaw = useMemo(() => data?.pages.flatMap(p => p.rows) ?? [], [data])
  const bookingsRef = useRef([])
  if (bookingsRaw.length > 0) bookingsRef.current = bookingsRaw
  const bookings = bookingsRaw.length > 0 ? bookingsRaw : bookingsRef.current

  hasNextPageRef.current   = hasNextPage
  fetchingRef.current      = isFetchingNextPage
  fetchNextPageRef.current = fetchNextPage

  const sentinelRef = useCallback(node => {
    if (!node || !scrollRef.current) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPageRef.current && !fetchingRef.current) {
          fetchNextPageRef.current()
        }
      },
      { root: scrollRef.current, rootMargin: '200px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const colSpan = isAdmin ? 6 : 5

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col flex-1 min-h-0">
      {total !== null && (
        <div className="px-4 py-2 border-b border-border flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground">Jami:</span>
          <span className="text-xs font-semibold tabular-nums">{total} ta</span>
        </div>
      )}
      <div ref={scrollRefCb} className="overflow-x-auto overflow-y-auto flex-1 min-h-0 no-scrollbar">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="sticky top-0 z-20">
            <tr className="border-b border-border bg-muted/80 backdrop-blur-sm">
              <th className={`px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky left-0 bg-muted/80 backdrop-blur-sm transition-shadow ${scrolled ? 'shadow-[4px_0_12px_-2px_rgba(0,0,0,0.08)]' : ''}`}>Xonadon</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mijoz</th>
              {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Manager</th>}
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Manbaa</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{cancelled ? 'Bekor sanasi' : 'Sana'}</th>
              <th className={`px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky right-0 bg-muted/80 backdrop-blur-sm transition-shadow ${scrolledRight ? 'shadow-[-4px_0_12px_-2px_rgba(0,0,0,0.08)]' : ''}`}>Amallar</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && bookingsRaw.length === 0 && bookingsRef.current.length === 0
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    {Array.from({ length: colSpan }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted/60 rounded animate-pulse" style={{ width: `${60 + (i * j * 7) % 30}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              : bookingsRaw.length === 0 && !isFetchingNextPage && !isLoading
              ? (
                  <tr>
                    <td colSpan={colSpan} className="px-4 py-16 text-center text-muted-foreground text-sm">
                      {search ? "Qidiruv bo'yicha natija topilmadi" : cancelled ? "Bekor qilingan bitimlar yo'q" : "Bitimlar yo'q"}
                    </td>
                  </tr>
                )
              : (() => {
                  const pairSeen = new Set()
                  return bookings.map(b => {
                    let pairPosition = null
                    if (b.pair_group_id) {
                      pairPosition = pairSeen.has(b.pair_group_id) ? 'last' : 'first'
                      pairSeen.add(b.pair_group_id)
                    }
                    return (
                      <BookingRow
                        key={b.id} b={b} isAdmin={isAdmin} cancelled={cancelled} onReset={onReset}
                        scrolled={scrolled} scrolledRight={scrolledRight} pairPosition={pairPosition}
                        bulkMode={bulkMode} selected={selectedIds?.has(b.id)} onSelect={onSelect}
                      />
                    )
                  })
                })()
            }
            {bookings.length > 0 && (
              <tr ref={sentinelRef}>
                <td colSpan={colSpan} className="py-3 text-center">
                  {isFetchingNextPage && (
                    <div className="flex items-center justify-center gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
                          style={{ animation: 'loader-dot 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
