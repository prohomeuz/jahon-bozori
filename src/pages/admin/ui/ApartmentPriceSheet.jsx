import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/shared/lib/auth'
import { ArrowLeft, Check, Save } from 'lucide-react'

const SHEETS = [
  { id: 'A-1', block: 'A', floor: 1, label: 'A  1-qavat' },
  { id: 'A-2', block: 'A', floor: 2, label: 'A  2-qavat' },
  { id: 'B-1', block: 'B', floor: 1, label: 'B  1-qavat' },
  { id: 'B-2', block: 'B', floor: 2, label: 'B  2-qavat' },
  { id: 'C-1', block: 'C', floor: 1, label: 'C  1-qavat' },
  { id: 'C-2', block: 'C', floor: 2, label: 'C  2-qavat' },
]


function fmt(n) {
  if (n == null) return ''
  return Number(n).toLocaleString('ru-RU')
}

function group(rows, key) {
  const keys = [...new Set(rows.map(r => r[key]))].sort((a, b) => a - b)
  const map = {}
  for (const r of rows) { if (!map[r[key]]) map[r[key]] = []; map[r[key]].push(r) }
  return { keys, map }
}

export function ApartmentPriceSheet({ onBack }) {
  const [sheetId, setSheetId]     = useState('A-1')
  const [allDrafts, setAllDrafts] = useState({}) // { sheetId: { apt_id: number | null } }
  const [editId, setEditId]       = useState(null)
  const [editVal, setEditVal]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const qc = useQueryClient()

  const sheet = SHEETS.find(s => s.id === sheetId)
  const sheetDrafts = allDrafts[sheetId] ?? {}

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['apt-prices', sheet.block, sheet.floor],
    queryFn: () => apiFetch(`/api/apartment-prices?block=${sheet.block}&floor=${sheet.floor}`).then(r => r.json()),
    staleTime: 30_000,
  })

  useEffect(() => { setEditId(null) }, [sheetId])

  const totalDrafts = Object.values(allDrafts).reduce((s, d) => s + Object.keys(d).length, 0)

  function getEffective(row) {
    const id = row.apartment_id
    if (id in sheetDrafts) return sheetDrafts[id]
    return row.custom_price
  }

  function startEdit(row) {
    const cur = getEffective(row)
    setEditId(row.apartment_id)
    setEditVal(cur != null ? String(cur) : '')
  }

  function commitEdit(aptId) {
    const raw = editVal.trim().replace(/\s/g, '')
    if (raw === '') {
      setAllDrafts(d => ({ ...d, [sheetId]: { ...(d[sheetId] ?? {}), [aptId]: null } }))
    } else {
      const num = Number(raw)
      if (!isNaN(num) && num > 0) {
        setAllDrafts(d => ({ ...d, [sheetId]: { ...(d[sheetId] ?? {}), [aptId]: num } }))
      }
    }
    setEditId(null)
  }

  async function handleSave() {
    if (saving || !totalDrafts) return
    setSaving(true)
    try {
      const items = Object.values(allDrafts).flatMap(drafts =>
        Object.entries(drafts).map(([apartment_id, price]) => ({ apartment_id, price }))
      )
      const res = await apiFetch('/api/apartment-prices/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert('Xatolik: ' + (err?.error ?? res.status))
        return
      }
      await qc.invalidateQueries({ queryKey: ['apt-prices'] })
      setAllDrafts({})
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1800)
    } catch (e) {
      alert('Tarmoq xatoligi: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  function renderRow(row) {
    const id      = row.apartment_id
    const aptNum  = id.split('-').pop()
    const isDirty = id in sheetDrafts
    const isEdit  = editId === id
    const eff     = getEffective(row)
    const hasCustom = row.custom_price != null

    return (
      <tr key={id} className={`border-b border-gray-100 ${isDirty ? 'bg-amber-50/60' : 'hover:bg-gray-50/40'}`}>
        <td className="px-4 py-2 font-mono font-bold text-sm text-gray-800 w-16">{aptNum}</td>
        <td className="px-4 py-2 text-sm text-gray-500 tabular-nums w-20">{row.size} m²</td>
        <td className="px-4 py-2 text-sm font-mono text-gray-400 tabular-nums w-28">{fmt(row.general_price)} $</td>
        <td className="px-3 py-1.5">
          {isEdit ? (
            <input
              autoFocus
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onBlur={() => commitEdit(id)}
              onKeyDown={e => {
                if (e.key === 'Enter')  { e.preventDefault(); commitEdit(id) }
                if (e.key === 'Escape') setEditId(null)
              }}
              placeholder="bo'sh = umumiy narx"
              className="w-full px-2 py-1 rounded border border-amber-400 ring-1 ring-amber-200 bg-white font-mono text-sm focus:outline-none tabular-nums"
            />
          ) : (
            <button
              onClick={() => startEdit(row)}
              className={`w-full text-left px-2 py-1 rounded text-sm font-mono tabular-nums transition-colors
                ${isDirty
                  ? 'bg-amber-100 border border-amber-300 text-amber-900 font-bold'
                  : hasCustom
                    ? 'bg-slate-50 border border-slate-200 text-slate-700 font-semibold'
                    : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50 border border-transparent'}`}
            >
              {eff != null
                ? `${fmt(eff)} $`
                : isDirty
                  ? <span className="text-gray-400 text-xs italic">umumiy</span>
                  : '—'}
            </button>
          )}
        </td>
      </tr>
    )
  }

  const shops = rows.filter(r => !r.is_wc)
  const wcs   = rows.filter(r => r.is_wc)
  const { keys: shopBolims, map: shopMap } = group(shops, 'bolim')
  const { keys: wcBolims,   map: wcMap   } = group(wcs,   'bolim')

  return (
    <div className="flex flex-col h-full bg-background" style={{ minHeight: 0 }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} />
          Orqaga
        </button>
        <span className="text-sm font-bold flex-1 text-center text-foreground">Do'kon bo'yicha alohida narxlash</span>
        <button
          onClick={handleSave}
          disabled={!totalDrafts || saving}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95
            ${savedFlash
              ? 'bg-green-500 text-white'
              : totalDrafts
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
        >
          {savedFlash ? <Check size={15} /> : <Save size={15} />}
          {savedFlash ? 'Saqlandi!' : saving ? 'Saqlanmoqda...' : `Saqlash${totalDrafts ? ` (${totalDrafts})` : ''}`}
        </button>
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-auto min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Yuklanmoqda...</div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Bu qavat uchun ma'lumot yo'q</div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                <th className="px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider w-16">№</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Maydon</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Umumiy narx</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Alohida narx</th>
              </tr>
            </thead>
            <tbody>
              {shopBolims.flatMap(bolim => [
                <tr key={`sh-${bolim}`}>
                  <td colSpan={4} className="sticky top-[41px] z-[5] bg-gray-100 border-y border-gray-200 px-4 py-1.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">
                    {bolim}-bo'lim
                  </td>
                </tr>,
                ...shopMap[bolim].map(renderRow),
              ])}
              {wcBolims.length > 0 && (
                <tr>
                  <td colSpan={4} className="sticky top-[41px] z-[5] bg-sky-50 border-y-2 border-sky-200 px-4 py-1.5 text-[11px] font-black text-sky-500 uppercase tracking-widest">
                    Hojatxonalar
                  </td>
                </tr>
              )}
              {wcBolims.flatMap(bolim => [
                <tr key={`wch-${bolim}`}>
                  <td colSpan={4} className="sticky top-[41px] z-[5] bg-sky-50/60 border-b border-sky-100 px-6 py-1 text-[11px] font-semibold text-sky-400">
                    {bolim}-bo'lim
                  </td>
                </tr>,
                ...wcMap[bolim].map(renderRow),
              ])}
            </tbody>
          </table>
        )}
      </div>

      {/* Sheet tabs — Excel style */}
      <div className="shrink-0 border-t-2 border-border bg-gray-50 flex items-end gap-0 px-2 overflow-x-auto">
        {SHEETS.map(s => (
          <button key={s.id} onClick={() => setSheetId(s.id)}
            className={`px-5 py-2 text-xs font-bold whitespace-nowrap border-x border-t transition-all shrink-0
              ${s.id === sheetId
                ? 'bg-background text-foreground border-border -mb-0.5 rounded-t-lg shadow-sm z-10'
                : 'bg-gray-50 text-muted-foreground border-transparent hover:bg-gray-100 rounded-t-md'
              } ${allDrafts[s.id] && Object.keys(allDrafts[s.id]).length ? 'after:content-["•"] after:ml-1 after:text-amber-500' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
