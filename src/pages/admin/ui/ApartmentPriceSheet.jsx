import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { apiFetch } from '@/shared/lib/auth'
import { ArrowLeft, Check, Save, X, MapPin } from 'lucide-react'

const SHEETS = [
  { id: 'A-1', block: 'A', floor: 1, label: 'A · 1-qavat' },
  { id: 'A-2', block: 'A', floor: 2, label: 'A · 2-qavat' },
  { id: 'B-1', block: 'B', floor: 1, label: 'B · 1-qavat' },
  { id: 'B-2', block: 'B', floor: 2, label: 'B · 2-qavat' },
  { id: 'C-1', block: 'C', floor: 1, label: 'C · 1-qavat' },
  { id: 'C-2', block: 'C', floor: 2, label: 'C · 2-qavat' },
]

// ─── WC overlay data ──────────────────────────────────────────────────────────

import { WC_OVERLAYS } from '../../bolim/config/hojatxonaOverlays'

// ─── Location highlight helpers (same logic as ShopsPage) ────────────────────

const allBlockImgs = import.meta.glob('@/assets/blocks/**/*.{png,jpg,webp}', { eager: true })

function loadImg(blockId, floor, bolimNum) {
  const filename = String(bolimNum)
  return Object.entries(allBlockImgs).find(([p]) => {
    const parts = p.split('/')
    const name = parts.pop().replace(/\.[^.]+$/, '')
    const floorDir = parts.pop()
    const blockDir = parts.pop()
    return name === filename && floorDir === String(floor) && blockDir === blockId
  })?.[1]?.default
}

async function getAptRect(blockId, floor, bolimNum, address) {
  try {
    const LOADERS = {
      A: [
        () => import('../../bolim/config/aRectOverlays').then(m => m.A_RECT_OVERLAYS),
        () => import('../../bolim/config/aFloor2RectOverlays').then(m => m.A_FLOOR2_RECT_OVERLAYS),
      ],
      B: [
        () => import('../../bolim/config/bRectOverlays').then(m => m.B_RECT_OVERLAYS),
        () => import('../../bolim/config/bFloor2RectOverlays').then(m => m.B_FLOOR2_RECT_OVERLAYS),
      ],
      C: [
        () => import('../../bolim/config/cRectOverlays').then(m => m.C_RECT_OVERLAYS),
        () => import('../../bolim/config/cFloor2RectOverlays').then(m => m.C_FLOOR2_RECT_OVERLAYS),
      ],
    }
    const overlays = await LOADERS[blockId]?.[floor === 2 ? 1 : 0]?.()
    const bolimData = overlays?.[bolimNum]
    if (!bolimData) return null
    const rect = bolimData.rects?.find(r => r.id === address)
    return rect ? { rect, viewBox: bolimData.viewBox } : null
  } catch { return null }
}

async function getBolimViewBox(blockId, floor, bolimNum) {
  try {
    const LOADERS = {
      A: [
        () => import('../../bolim/config/aRectOverlays').then(m => m.A_RECT_OVERLAYS),
        () => import('../../bolim/config/aFloor2RectOverlays').then(m => m.A_FLOOR2_RECT_OVERLAYS),
      ],
      B: [
        () => import('../../bolim/config/bRectOverlays').then(m => m.B_RECT_OVERLAYS),
        () => import('../../bolim/config/bFloor2RectOverlays').then(m => m.B_FLOOR2_RECT_OVERLAYS),
      ],
      C: [
        () => import('../../bolim/config/cRectOverlays').then(m => m.C_RECT_OVERLAYS),
        () => import('../../bolim/config/cFloor2RectOverlays').then(m => m.C_FLOOR2_RECT_OVERLAYS),
      ],
    }
    const overlays = await LOADERS[blockId]?.[floor === 2 ? 1 : 0]?.()
    return overlays?.[bolimNum]?.viewBox ?? null
  } catch { return null }
}

async function drawWcHighlight(imgSrc, points, viewBox) {
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgSrc })
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  if (!points || !viewBox) return canvas.toDataURL('image/png')
  const [, , vw, vh] = viewBox.split(' ').map(Number)
  const sx = img.naturalWidth / vw, sy = img.naturalHeight / vh
  const pts = points.trim().split(/\s+/).map(p => p.split(',').map(Number))
  ctx.save(); ctx.scale(sx, sy)
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  ctx.fillStyle = 'rgba(14,165,233,0.18)'
  ctx.fill()
  ctx.strokeStyle = '#0ea5e9'
  ctx.lineWidth = vw / 90
  ctx.stroke()
  ctx.restore()
  return canvas.toDataURL('image/png')
}

function pathBBox(d) {
  const nums = d.match(/[-\d.]+/g)?.map(Number) ?? []
  const xs = [], ys = []
  for (let i = 0; i + 1 < nums.length; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]) }
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
}

async function drawHighlight(imgSrc, rect, viewBox) {
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgSrc })
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  if (!rect || !viewBox) return canvas.toDataURL('image/png')
  const [, , vw, vh] = viewBox.split(' ').map(Number)
  const sx = img.naturalWidth / vw
  const sy = img.naturalHeight / vh
  if (rect.d) {
    ctx.save(); ctx.scale(sx, sy)
    ctx.fillStyle = 'rgba(239,68,68,0.22)'; ctx.fill(new Path2D(rect.d))
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = vw / 90; ctx.stroke(new Path2D(rect.d))
    ctx.restore()
  } else {
    const lw = Math.max(4, img.naturalWidth / 250)
    ctx.fillStyle = 'rgba(239,68,68,0.22)'
    ctx.fillRect(rect.x * sx, rect.y * sy, rect.width * sx, rect.height * sy)
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = lw
    ctx.strokeRect(rect.x * sx, rect.y * sy, rect.width * sx, rect.height * sy)
  }
  return canvas.toDataURL('image/png')
}

// ─── Location modal ───────────────────────────────────────────────────────────

function LocationModal({ address, block, floor, bolim, isWc, onClose }) {
  const [dataUrl, setDataUrl] = useState(null)
  const aptNum = address.split('-').pop()

  useEffect(() => {
    const src = loadImg(block, floor, bolim)
    if (!src) return
    if (isWc) {
      const points = WC_OVERLAYS[block]?.[floor]?.[bolim]
      getBolimViewBox(block, floor, bolim)
        .then(viewBox => drawWcHighlight(src, points, viewBox))
        .then(setDataUrl)
    } else {
      getAptRect(block, floor, bolim, address)
        .then(overlay => drawHighlight(src, overlay?.rect ?? null, overlay?.viewBox ?? null))
        .then(setDataUrl)
    }
  }, [address])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-2xl"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.28)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
              <MapPin size={16} className="text-amber-500" />
            </div>
            <div>
              <p className="text-base font-black text-gray-900 leading-tight">
                {block}-blok · {bolim}-bo'lim · {floor}-qavat
              </p>
              {!isWc && (
                <p className="text-sm text-gray-400 mt-0.5">
                  Do'kon № <span className="font-bold text-amber-500">{aptNum}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X size={14} strokeWidth={2.5} className="text-gray-500" />
          </button>
        </div>

        {/* Floor plan image */}
        <div className="mx-4 mb-4 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100">
          {dataUrl ? (
            <img src={dataUrl} alt={address} className="w-full object-contain block" />
          ) : (
            <div className="h-52 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export function ApartmentPriceSheet({ onBack }) {
  const [params, setParams]         = useSearchParams()
  const sheetId  = SHEETS.find(s => s.id === params.get('sheet'))?.id ?? 'A-1'
  const typeTab  = params.get('type') === 'wc' ? 'wc' : 'shops'

  function setSheetId(id) { setParams(p => { const n = new URLSearchParams(p); n.set('sheet', id); return n }, { replace: true }) }
  function setTypeTab(t)  { setParams(p => { const n = new URLSearchParams(p); n.set('type', t);  return n }, { replace: true }) }

  const [allDrafts, setAllDrafts]   = useState({})
  const [editId, setEditId]         = useState(null)
  const [editVal, setEditVal]       = useState('')
  const [saving, setSaving]         = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [locPreview, setLocPreview] = useState(null)
  const qc = useQueryClient()

  const sheet      = SHEETS.find(s => s.id === sheetId)
  const sheetDrafts = allDrafts[sheetId] ?? {}

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['apt-prices', sheet.block, sheet.floor],
    queryFn: () => apiFetch(`/api/apartment-prices?block=${sheet.block}&floor=${sheet.floor}`).then(r => r.json()),
    staleTime: 30_000,
  })

  useEffect(() => { setEditId(null) }, [sheetId])

  const totalDrafts = Object.values(allDrafts).reduce((s, d) => s + Object.keys(d).length, 0)

  function getEffective(row) {
    if (row.apartment_id in sheetDrafts) return sheetDrafts[row.apartment_id]
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
    const id       = row.apartment_id
    const aptNum   = id.split('-').pop()
    const isDirty  = id in sheetDrafts
    const isEdit   = editId === id
    const eff      = getEffective(row)
    const hasCustom = row.custom_price != null

    return (
      <tr key={id} className={`border-b border-gray-100 group/row ${isDirty ? 'bg-amber-50/60' : 'hover:bg-gray-50/40'}`}>
        {/* № */}
        <td className="px-4 py-2 font-mono font-bold text-sm text-gray-800 w-14 shrink-0">{aptNum}</td>

        {/* Maydon */}
        <td className="px-4 py-2 text-sm text-gray-400 tabular-nums w-20 shrink-0 whitespace-nowrap">{row.size} m²</td>

        {/* Umumiy narx */}
        <td className="px-4 py-2 text-sm font-mono text-gray-400 tabular-nums w-32 shrink-0 whitespace-nowrap">{fmt(row.general_price)} $</td>

        {/* Spacer */}
        <td />

        {/* Joylashuv — underlined, clickable */}
        <td className="px-3 py-2 w-56 shrink-0">
          <button
            onClick={() => setLocPreview({ address: id, block: sheet.block, floor: sheet.floor, bolim: row.bolim, isWc: !!row.is_wc })}
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 underline underline-offset-2 decoration-dashed hover:text-amber-600 hover:decoration-amber-400 transition-colors"
          >
            <MapPin size={11} className="shrink-0" />
            {sheet.block}-blok · {row.bolim}-bo'lim · {sheet.floor}-qavat
            {row.is_wc ? <span className="ml-1 text-sky-500 font-bold no-underline">WC</span> : null}
          </button>
        </td>

        {/* Alohida narx */}
        <td className="px-4 py-1.5 text-right w-48 shrink-0">
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
              className="w-44 px-2 py-1 rounded border border-amber-400 ring-1 ring-amber-200 bg-white font-mono text-sm focus:outline-none tabular-nums text-right"
            />
          ) : (
            <button
              onClick={() => startEdit(row)}
              className={`px-3 py-1 rounded text-sm font-mono tabular-nums transition-colors
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

  const visibleRows = rows.filter(r => typeTab === 'wc' ? r.is_wc : !r.is_wc)
  const { keys: bolims, map: bolimMap } = group(visibleRows, 'bolim')

  return (
    <>
      {locPreview && <LocationModal {...locPreview} onClose={() => setLocPreview(null)} />}

      <div className="flex flex-col h-full bg-background" style={{ minHeight: 0 }}>

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          {/* Back */}
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            <ArrowLeft size={17} />
          </button>

          {/* Title + type switcher */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-bold text-foreground leading-tight">Alohida narxlash</p>
            <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg">
              <button
                onClick={() => setTypeTab('shops')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${typeTab === 'shops' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Do'konlar
              </button>
              <button
                onClick={() => setTypeTab('wc')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${typeTab === 'wc' ? 'bg-white text-sky-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Hojatxonalar
              </button>
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!totalDrafts || saving}
            className={`relative flex items-center gap-1.5 pl-3.5 pr-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 select-none
              ${savedFlash
                ? 'bg-green-500 text-white shadow-sm shadow-green-200'
                : totalDrafts
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-200'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
          >
            {savedFlash ? <Check size={14} strokeWidth={2.5} /> : <Save size={14} />}
            <span>{savedFlash ? 'Saqlandi!' : saving ? 'Saqlanmoqda...' : 'Saqlash'}</span>
            {!savedFlash && !saving && totalDrafts > 0 && (
              <span className="ml-0.5 min-w-4.5 h-4.5 px-1 rounded-full bg-white/25 text-[10px] font-black flex items-center justify-center tabular-nums">
                {totalDrafts}
              </span>
            )}
          </button>
        </div>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Yuklanmoqda...</div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Bu qavat uchun ma'lumot yo'q</div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10">
                <tr className="bg-white h-10" style={{ boxShadow: '0 1px 0 0 #f3f4f6, 0 2px 0 0 #e5e7eb' }}>
                  <th className="px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-14">№</th>
                  <th className="px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-20">Maydon</th>
                  <th className="px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-32 whitespace-nowrap">Umumiy narx</th>
                  <th />
                  <th className="px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-56">Joylashuv</th>
                  <th className="px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-48 text-right">Alohida narx</th>
                </tr>
              </thead>
              <tbody>
                {bolims.flatMap(bolim => [
                  <tr key={`sec-${bolim}`}>
                    <td colSpan={6} className="sticky top-10 z-5 px-4 py-2"
                      style={typeTab === 'wc'
                        ? { background: '#e0f2fe', boxShadow: 'inset 3px 0 0 0 #0ea5e9' }
                        : { background: '#f3f4f6', boxShadow: 'inset 3px 0 0 0 #9ca3af' }}>
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${typeTab === 'wc' ? 'text-sky-600' : 'text-gray-600'}`}>
                        {bolim}-bo'lim
                      </span>
                    </td>
                  </tr>,
                  ...bolimMap[bolim].map(renderRow),
                ])}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Sheet tabs — Excel style ─────────────────────────────────────── */}
        <div className="shrink-0 border-t-2 border-border bg-gray-50 flex items-end gap-0 px-2 overflow-x-auto">
          {SHEETS.map(s => {
            const isActive = s.id === sheetId
            const hasDraft = !!(allDrafts[s.id] && Object.keys(allDrafts[s.id]).length)
            return (
              <button key={s.id} onClick={() => setSheetId(s.id)}
                className={`relative px-5 py-2 text-xs whitespace-nowrap border-x border-t transition-all shrink-0
                  ${isActive
                    ? 'bg-background font-extrabold text-amber-600 border-border -mb-0.5 rounded-t-lg shadow-md z-10'
                    : 'bg-gray-50 font-semibold text-muted-foreground border-transparent hover:bg-gray-100 hover:text-foreground rounded-t-md'
                  }`}
                style={isActive ? { boxShadow: 'inset 0 2px 0 0 rgb(245 158 11)' } : undefined}
              >
                {s.label}
                {hasDraft && (
                  <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
