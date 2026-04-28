import { useState, useRef, useCallback, useEffect } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { getUser, apiFetch } from '@/shared/lib/auth'
import { Search, X, SlidersHorizontal, EyeOff, Eye } from 'lucide-react'
import { WC_OVERLAYS } from '@/pages/bolim/config/hojatxonaOverlays'

const allBlockImgs = import.meta.glob('@/assets/blocks/**/*.{png,jpg,webp}', { eager: true })

function loadImg(blockId, floor, bolimNum) {
  const filename = String(bolimNum)
  const entry = Object.entries(allBlockImgs).find(([k]) => {
    const parts = k.replace(/\\/g, '/').split('/')
    const name     = parts.pop()?.split('.')[0]
    const floorDir = parts.pop()
    const blockDir = parts.pop()
    return name === filename && floorDir === String(floor) && blockDir === blockId
  })
  return entry?.[1]?.default ?? null
}

function pathBBox(d) {
  const nums = d.match(/[-\d.]+/g)?.map(Number) ?? []
  const xs = [], ys = []
  for (let i = 0; i + 1 < nums.length; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]) }
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
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

async function getViewBox(blockId, floor, bolimNum) {
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

async function drawShopHighlight(imgSrc, rect, viewBox) {
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgSrc })
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  if (!rect || !viewBox) return canvas.toDataURL('image/png')
  const [, , vw, vh] = viewBox.split(' ').map(Number)
  const sx = img.naturalWidth / vw; const sy = img.naturalHeight / vh
  let bboxVb
  if (rect.d) {
    ctx.save(); ctx.scale(sx, sy)
    ctx.fillStyle = 'rgba(239,68,68,0.22)'; ctx.fill(new Path2D(rect.d))
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = vw / 90; ctx.stroke(new Path2D(rect.d))
    ctx.restore(); bboxVb = pathBBox(rect.d)
  } else {
    const lw = Math.max(4, img.naturalWidth / 250)
    ctx.fillStyle = 'rgba(239,68,68,0.22)'; ctx.fillRect(rect.x * sx, rect.y * sy, rect.width * sx, rect.height * sy)
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = lw; ctx.strokeRect(rect.x * sx, rect.y * sy, rect.width * sx, rect.height * sy)
    bboxVb = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  }
  const padY = bboxVb.height * sy * 1.2
  const cy = Math.max(0, bboxVb.y * sy - padY)
  const ch = Math.min(img.naturalHeight - cy, bboxVb.height * sy + padY * 2)
  const cropped = document.createElement('canvas')
  cropped.width = img.naturalWidth; cropped.height = ch
  cropped.getContext('2d').drawImage(canvas, 0, cy, img.naturalWidth, ch, 0, 0, img.naturalWidth, ch)
  return cropped.toDataURL('image/png')
}

async function drawWcHighlight(imgSrc, wcPoints, viewBox) {
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgSrc })
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  if (!wcPoints || !viewBox) return canvas.toDataURL('image/png')
  const [, , vw, vh] = viewBox.split(' ').map(Number)
  const sx = img.naturalWidth / vw; const sy = img.naturalHeight / vh
  const pts = wcPoints.split(/\s+/).map(p => p.split(',').map(Number))
  ctx.save(); ctx.scale(sx, sy)
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  ctx.fillStyle = 'rgba(14,165,233,0.28)'; ctx.fill()
  ctx.strokeStyle = 'rgba(14,165,233,0.95)'; ctx.lineWidth = vw / 90; ctx.stroke()
  ctx.restore()
  return canvas.toDataURL('image/png')
}

const LIMIT = 50
const WC_BOLIMS   = [1, 3]
const SHOP_BOLIMS = [1,2,3,4,5,6,7,8,9,10,11]
const ALL_FLOORS  = [1, 2]
const BLOCKS = ['A', 'B', 'C']

const STATUS_BADGE = {
  EMPTY:    'bg-emerald-100 text-emerald-700 border border-emerald-200',
  RESERVED: 'bg-amber-100 text-amber-700 border border-amber-200',
  SOLD:     'bg-red-100 text-red-700 border border-red-200',
  NOT_SALE: 'bg-muted text-muted-foreground border border-border',
}
const STATUS_LABEL  = { EMPTY: 'Sotuvda', RESERVED: 'Bron', SOLD: 'Sotilgan', NOT_SALE: 'Sotilmaydi' }
const STATUS_BG     = { EMPTY: 'bg-emerald-50 border-emerald-100', RESERVED: 'bg-amber-50 border-amber-100', SOLD: 'bg-red-50 border-red-100', NOT_SALE: 'bg-muted border-border' }
const STATUS_FILTERS = [
  { key: 'all',      label: 'Hammasi'    },
  { key: 'EMPTY',    label: 'Sotuvda'    },
  { key: 'RESERVED', label: 'Bron'       },
  { key: 'SOLD',     label: 'Sotilgan'   },
  { key: 'NOT_SALE', label: 'Sotilmaydi' },
]

function ShopDetailModal({ shop, onClose }) {
  const [block, bolimStr, aptStr] = shop.address.split('-')
  const bolim = parseInt(bolimStr)
  const floor = aptStr ? parseInt(aptStr[0]) : 1
  const [highlightedImg, setHighlightedImg] = useState(null)
  const [imgLoading, setImgLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setImgLoading(true)
      const rawSrc = loadImg(block, floor, bolim)
      if (!rawSrc) { setImgLoading(false); return }
      try {
        const overlay = await getAptRect(block, floor, bolim, shop.address)
        const dataUrl = await drawShopHighlight(rawSrc, overlay?.rect ?? null, overlay?.viewBox ?? null)
        if (!cancelled) setHighlightedImg(dataUrl)
      } catch {
        if (!cancelled) setHighlightedImg(rawSrc)
      } finally {
        if (!cancelled) setImgLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [shop.address])

  const rows = [
    { label: "Do'kon ID", value: shop.address },
    { label: 'Blok',      value: `${shop.block}-blok` },
    { label: "Bo'lim",    value: `${shop.bolim}-bo'lim` },
    { label: 'Qavat',     value: `${shop.floor}-qavat` },
    { label: 'Maydon',    value: `${shop.size} m²` },
    { label: 'Narx (m²)', value: shop.price ? `${shop.price.toLocaleString('ru-RU')} $` : '—' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" style={{ backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-background rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden">
        <div className={`px-6 py-4 flex items-center gap-3 border-b ${STATUS_BG[shop.status] ?? 'bg-muted border-border'}`}>
          <div className="flex-1 min-w-0">
            <p className="font-black text-xl tracking-tight">{shop.address}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{shop.block}-blok · {shop.bolim}-bo'lim · {shop.floor}-qavat</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_BADGE[shop.status] ?? ''}`}>{STATUS_LABEL[shop.status] ?? shop.status}</span>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-black/8 hover:bg-black/15 transition-colors shrink-0"><X size={15} strokeWidth={2.5} /></button>
        </div>
        <div className="relative border-b border-border bg-muted/20 overflow-hidden" style={{ height: 220 }}>
          {highlightedImg && <img src={highlightedImg} alt="" className={`w-full h-full object-contain transition-opacity duration-300 ${imgLoading ? 'opacity-0' : 'opacity-100'}`} />}
          {imgLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/30">
              <div className="w-7 h-7 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/70 animate-spin" />
              <p className="text-xs text-muted-foreground">Reja yuklanmoqda...</p>
            </div>
          )}
          {!imgLoading && !highlightedImg && <div className="absolute inset-0 flex items-center justify-center"><p className="text-xs text-muted-foreground">Reja topilmadi</p></div>}
        </div>
        <div className="px-6 py-5 flex flex-col gap-3 max-h-[40vh] overflow-y-auto">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground shrink-0">{label}</span>
              <span className="text-sm font-bold text-right">{value}</span>
            </div>
          ))}
          {shop.status === 'NOT_SALE' && (
            <div className="pt-2 mt-1 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1.5">Sabab</p>
              <p className="text-sm font-medium break-words">{shop.not_sale_reason || '—'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function WcDetailModal({ wc, onClose }) {
  const [block, bolimStr, aptStr] = wc.address.split('-')
  const bolim = parseInt(bolimStr)
  const floor = aptStr ? parseInt(aptStr[0]) : 1
  const [highlightedImg, setHighlightedImg] = useState(null)
  const [imgLoading, setImgLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setImgLoading(true)
      const rawSrc = loadImg(block, floor, bolim)
      if (!rawSrc) { setImgLoading(false); return }
      try {
        const vb      = await getViewBox(block, floor, bolim)
        const wcPts   = WC_OVERLAYS[block]?.[floor]?.[bolim] ?? null
        const dataUrl = await drawWcHighlight(rawSrc, wcPts, vb)
        if (!cancelled) setHighlightedImg(dataUrl)
      } catch {
        if (!cancelled) setHighlightedImg(rawSrc)
      } finally {
        if (!cancelled) setImgLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [wc.address])

  const rows = [
    { label: 'Hojatxona ID', value: wc.address },
    { label: 'Blok',         value: `${wc.block}-blok` },
    { label: "Bo'lim",       value: `${wc.bolim}-bo'lim` },
    { label: 'Qavat',        value: `${wc.floor}-qavat` },
    { label: 'Maydon',       value: `${wc.size} m²` },
    { label: 'Jami narx',    value: wc.price ? `${(wc.price * wc.size).toLocaleString('ru-RU')} $` : '—' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" style={{ backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-background rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden">
        <div className={`px-6 py-4 flex items-center gap-3 border-b ${STATUS_BG[wc.status] ?? 'bg-muted border-border'}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-black text-xl tracking-tight">{wc.address}</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 border border-sky-200">WC</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{wc.block}-blok · {wc.bolim}-bo'lim · {wc.floor}-qavat · Hojatxona</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_BADGE[wc.status] ?? ''}`}>{STATUS_LABEL[wc.status] ?? wc.status}</span>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-black/8 hover:bg-black/15 transition-colors shrink-0"><X size={15} strokeWidth={2.5} /></button>
        </div>
        <div className="relative border-b border-border bg-muted/20 overflow-hidden" style={{ height: 200 }}>
          {highlightedImg && <img src={highlightedImg} alt="" className={`w-full h-full object-contain transition-opacity duration-300 ${imgLoading ? 'opacity-0' : 'opacity-100'}`} />}
          {imgLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/30">
              <div className="w-7 h-7 rounded-full border-2 border-muted-foreground/20 border-t-sky-400 animate-spin" />
              <p className="text-xs text-muted-foreground">Reja yuklanmoqda...</p>
            </div>
          )}
          {!imgLoading && !highlightedImg && <div className="absolute inset-0 flex items-center justify-center"><p className="text-xs text-muted-foreground">Reja topilmadi</p></div>}
        </div>
        <div className="px-6 py-5 flex flex-col gap-3 max-h-[40vh] overflow-y-auto">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground shrink-0">{label}</span>
              <span className="text-sm font-bold text-right">{value}</span>
            </div>
          ))}
          {wc.status === 'NOT_SALE' && (
            <div className="pt-2 mt-1 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1.5">Sabab</p>
              <p className="text-sm font-medium break-words">{wc.not_sale_reason || '—'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NotSaleModal({ item, isWc, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  async function handleConfirm() {
    if (!reason.trim() || loading) return
    setLoading(true); await onConfirm(reason.trim()); setLoading(false)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-bold mb-1">Sotuvdan chiqarish</h3>
        <p className="text-sm text-muted-foreground mb-4">
          <span className="font-semibold text-foreground">{item.address}</span> {isWc ? 'hojatxonasi' : "do'koni"} sotuvdan chiqariladi.
        </p>
        <textarea autoFocus placeholder="Sababini yozing..." value={reason} onChange={e => setReason(e.target.value)} rows={3}
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none mb-4" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Bekor</button>
          <button onClick={handleConfirm} disabled={!reason.trim() || loading}
            className="flex-1 py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40">
            {loading ? 'Saqlanmoqda...' : 'Sotuvdan chiqar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RestoreModal({ item, isWc, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)
  async function handleConfirm() { setLoading(true); await onConfirm(); setLoading(false) }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-bold mb-2">Sotuvga chiqarish</h3>
        <p className="text-sm text-muted-foreground mb-6">
          <span className="font-semibold text-foreground">{item.address}</span> {isWc ? 'hojatxonasi' : "do'koni"} yana sotuvga chiqariladi.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Bekor</button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50">
            {loading ? 'Saqlanmoqda...' : 'Sotuvga chiqar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ShopRow({ shop, isAdmin, onStatusChange, onDetail }) {
  const [showNotSale, setShowNotSale] = useState(false)
  const [showRestore, setShowRestore] = useState(false)

  async function setNotSale(reason) {
    await apiFetch(`/api/apartments/${shop.address}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'NOT_SALE', reason }) })
    setShowNotSale(false); onStatusChange()
  }
  async function restoreToSale() {
    await apiFetch(`/api/apartments/${shop.address}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'EMPTY' }) })
    setShowRestore(false); onStatusChange()
  }

  const isNotSale = shop.status === 'NOT_SALE'
  const isEmpty   = shop.status === 'EMPTY'

  return (
    <>
      <tr className={`border-t border-border transition-colors cursor-pointer ${isNotSale ? 'opacity-55' : 'hover:bg-muted/40'}`} onDoubleClick={() => onDetail(shop)}>
        <td className="px-4 py-3 font-mono font-bold text-sm whitespace-nowrap">{shop.address}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          <p className="text-sm font-medium">{shop.block}-blok</p>
          <p className="text-xs text-muted-foreground">{shop.bolim}-bo'lim · {shop.floor}-qavat</p>
        </td>
        <td className="px-4 py-3 text-sm whitespace-nowrap">{shop.size} m²</td>
        <td className="px-4 py-3 text-sm whitespace-nowrap">{shop.price?.toLocaleString('ru-RU')} $</td>
        <td className="px-4 py-3">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE[shop.status] ?? ''}`}>{STATUS_LABEL[shop.status] ?? shop.status}</span>
        </td>
        {isAdmin && (
          <td className="px-4 py-3">
            {isEmpty && (
              <button onClick={() => setShowNotSale(true)}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
                <EyeOff size={12} strokeWidth={2} /> Sotuvdan chiqar
              </button>
            )}
            {isNotSale && (
              <button onClick={() => setShowRestore(true)}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                <Eye size={12} strokeWidth={2} /> Sotuvga chiqar
              </button>
            )}
          </td>
        )}
      </tr>
      {showNotSale && <tr><td className="p-0 border-0"><NotSaleModal item={shop} isWc={false} onClose={() => setShowNotSale(false)} onConfirm={setNotSale} /></td></tr>}
      {showRestore  && <tr><td className="p-0 border-0"><RestoreModal item={shop} isWc={false} onClose={() => setShowRestore(false)}  onConfirm={restoreToSale} /></td></tr>}
    </>
  )
}

function WcRow({ wc, isAdmin, onStatusChange, onDetail }) {
  const [showNotSale, setShowNotSale] = useState(false)
  const [showRestore, setShowRestore] = useState(false)

  async function setNotSale(reason) {
    await apiFetch(`/api/apartments/${wc.address}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'NOT_SALE', reason }) })
    setShowNotSale(false); onStatusChange()
  }
  async function restoreToSale() {
    await apiFetch(`/api/apartments/${wc.address}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'EMPTY' }) })
    setShowRestore(false); onStatusChange()
  }

  const isNotSale = wc.status === 'NOT_SALE'
  const isEmpty   = wc.status === 'EMPTY'

  return (
    <>
      <tr className={`border-t border-sky-200 bg-sky-50/50 transition-colors cursor-pointer ${isNotSale ? 'opacity-55' : 'hover:bg-sky-100/60'}`} onDoubleClick={() => onDetail(wc)}>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm">{wc.address}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 border border-sky-200 leading-none">WC</span>
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <p className="text-sm font-medium">{wc.block}-blok</p>
          <p className="text-xs text-muted-foreground">{wc.bolim}-bo'lim · {wc.floor}-qavat</p>
        </td>
        <td className="px-4 py-3 text-sm whitespace-nowrap">{wc.size} m²</td>
        <td className="px-4 py-3 text-sm whitespace-nowrap">{(2000 * wc.size).toLocaleString('ru-RU')} $</td>
        <td className="px-4 py-3">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE[wc.status] ?? ''}`}>{STATUS_LABEL[wc.status] ?? wc.status}</span>
        </td>
        {isAdmin && (
          <td className="px-4 py-3">
            {isEmpty && (
              <button onClick={() => setShowNotSale(true)}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
                <EyeOff size={12} strokeWidth={2} /> Sotuvdan chiqar
              </button>
            )}
            {isNotSale && (
              <button onClick={() => setShowRestore(true)}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                <Eye size={12} strokeWidth={2} /> Sotuvga chiqar
              </button>
            )}
          </td>
        )}
      </tr>
      {showNotSale && <tr><td className="p-0 border-0"><NotSaleModal item={wc} isWc onClose={() => setShowNotSale(false)} onConfirm={setNotSale} /></td></tr>}
      {showRestore  && <tr><td className="p-0 border-0"><RestoreModal item={wc} isWc onClose={() => setShowRestore(false)}  onConfirm={restoreToSale} /></td></tr>}
    </>
  )
}

export default function JoylarPage() {
  const user    = getUser()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()

  const [mode,         setMode]         = useState('dokonlar')
  const [search,       setSearch]       = useState('')
  const [blockFilter,  setBlockFilter]  = useState('')
  const [bolimFilter,  setBolimFilter]  = useState('')
  const [floorFilter,  setFloorFilter]  = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [detailItem,   setDetailItem]   = useState(null)
  const [filterOpen,   setFilterOpen]   = useState(false)

  const [pendingBlock,  setPendingBlock]  = useState('')
  const [pendingBolim,  setPendingBolim]  = useState('')
  const [pendingFloor,  setPendingFloor]  = useState('')
  const [pendingStatus, setPendingStatus] = useState('all')

  const isWc = mode === 'hojatxonalar'
  const cols = isAdmin ? 6 : 5

  function switchMode(m) {
    setMode(m)
    setSearch(''); setBlockFilter(''); setBolimFilter(''); setFloorFilter(''); setStatusFilter('all')
  }

  function openSheet() {
    setPendingBlock(blockFilter); setPendingBolim(bolimFilter)
    setPendingFloor(floorFilter); setPendingStatus(statusFilter)
    setFilterOpen(true)
  }
  function applyFilters() {
    setBlockFilter(pendingBlock); setBolimFilter(pendingBolim)
    setFloorFilter(pendingFloor); setStatusFilter(pendingStatus)
    setFilterOpen(false)
  }
  function clearFilters() {
    setPendingBlock(''); setPendingBolim(''); setPendingFloor(''); setPendingStatus('all')
  }

  const activeFilterCount = [blockFilter, bolimFilter, floorFilter, statusFilter !== 'all' ? statusFilter : ''].filter(Boolean).length

  const scrollRef        = useRef(null)
  const hasNextPageRef   = useRef(false)
  const fetchingRef      = useRef(false)
  const fetchNextPageRef = useRef(() => {})

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: [mode, search, blockFilter, bolimFilter, floorFilter, statusFilter],
    queryFn: ({ pageParam = 0 }) => {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(pageParam) })
      if (search)                 params.set('search', search)
      if (blockFilter)            params.set('block',  blockFilter)
      if (bolimFilter)            params.set('bolim',  bolimFilter)
      if (floorFilter)            params.set('floor',  floorFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const endpoint = isWc ? '/api/wc' : '/api/shops'
      return apiFetch(`${endpoint}?${params}`).then(r => r.json())
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.rows.length < LIMIT ? undefined : allPages.flatMap(p => p.rows).length,
    placeholderData: prev => prev,
  })

  const total = data?.pages[0]?.total ?? null
  const items = data?.pages.flatMap(p => p.rows) ?? []
  hasNextPageRef.current   = hasNextPage
  fetchingRef.current      = isFetchingNextPage
  fetchNextPageRef.current = fetchNextPage

  const sentinelRef = useCallback(node => {
    if (!node || !scrollRef.current) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasNextPageRef.current && !fetchingRef.current) fetchNextPageRef.current() },
      { root: scrollRef.current, rootMargin: '200px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  function onStatusChange() {
    queryClient.invalidateQueries({ queryKey: [mode] })
  }

  const headerCols = [
    isWc ? 'Hojatxona ID' : "Do'kon ID",
    'Joylashuv',
    'Maydon',
    isWc ? 'Jami narx' : 'Narx',
    'Status',
    ...(isAdmin ? ['Amallar'] : []),
  ]

  return (
    <div className="p-4 md:p-6 flex flex-col gap-3 h-full min-h-0 overflow-hidden relative">

      {/* Toolbar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-3 -mx-4 px-4 md:-mx-6 md:px-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 pt-1">
          <h1 className="text-2xl font-bold">Joylar</h1>
          <div className="flex items-center bg-muted rounded-xl p-1 gap-0.5">
            <button
              onClick={() => switchMode('dokonlar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'dokonlar' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Do'konlar
            </button>
            <button
              onClick={() => switchMode('hojatxonalar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'hojatxonalar' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Hojatxonalar
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-40 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="ID, bo'lim, qavat..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={13} /></button>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button onClick={() => { setStatusFilter('all'); setBlockFilter(''); setBolimFilter(''); setFloorFilter('') }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
              <X size={13} strokeWidth={2.5} /> Tozalash
            </button>
          )}

          <button onClick={openSheet}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors ${
              activeFilterCount > 0 ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}>
            <SlidersHorizontal size={14} />
            Filter
            {activeFilterCount > 0 && <span className="w-4 h-4 rounded-full bg-background text-foreground text-xs font-bold flex items-center justify-center">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col flex-1 min-h-0">
        {total !== null && (
          <div className="px-4 py-2 border-b border-border flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-muted-foreground">Jami:</span>
            <span className="text-xs font-semibold tabular-nums">{total} ta</span>
          </div>
        )}
        <div ref={scrollRef} className="overflow-x-auto overflow-y-auto flex-1 min-h-0 no-scrollbar">
          <table className="w-full text-sm min-w-[540px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/80 backdrop-blur-sm">
                {headerCols.map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && items.length === 0
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-t border-border">
                      {Array.from({ length: cols }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-muted/60 rounded animate-pulse" style={{ width: `${55 + (i * j * 7) % 35}%` }} /></td>
                      ))}
                    </tr>
                  ))
                : items.length === 0
                ? (
                    <tr><td colSpan={cols} className="px-4 py-16 text-center text-muted-foreground text-sm">
                      {search ? "Qidiruv bo'yicha natija topilmadi" : isWc ? 'Hojatxonalar topilmadi' : "Do'konlar topilmadi"}
                    </td></tr>
                  )
                : items.map(item =>
                    isWc
                      ? <WcRow   key={item.address} wc={item}   isAdmin={isAdmin} onStatusChange={onStatusChange} onDetail={setDetailItem} />
                      : <ShopRow key={item.address} shop={item} isAdmin={isAdmin} onStatusChange={onStatusChange} onDetail={setDetailItem} />
                  )
              }
              {items.length > 0 && (
                <tr ref={sentinelRef}><td colSpan={cols} className="p-0 border-0" /></tr>
              )}
              {isFetchingNextPage && Array.from({ length: 4 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-t border-border">
                  {Array.from({ length: cols }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted/60 rounded animate-pulse" style={{ width: `${60 + (i * j * 11) % 30}%` }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter sheet */}
      {filterOpen && (
        <div className="absolute inset-0 z-30 flex flex-col justify-end" onClick={() => setFilterOpen(false)}>
          <div className="absolute inset-0 bg-black/40 sheet-backdrop" />
          <div className="relative bg-background rounded-t-2xl shadow-2xl flex flex-col max-h-[72vh] sheet-panel" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2.5 pb-1 shrink-0"><div className="w-8 h-1 rounded-full bg-border" /></div>
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-border shrink-0">
              <p className="font-bold text-sm">Filter</p>
              <button onClick={() => setFilterOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors"><X size={13} strokeWidth={2.5} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-4">

              {/* Status */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Status</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_FILTERS.map(f => (
                    <button key={f.key} onClick={() => setPendingStatus(f.key)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${pendingStatus === f.key ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Blok */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Blok</p>
                <div className="flex gap-1.5">
                  <button onClick={() => { setPendingBlock(''); setPendingBolim(''); setPendingFloor('') }}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${!pendingBlock ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                    Barcha
                  </button>
                  {BLOCKS.map(b => (
                    <button key={b} onClick={() => { setPendingBlock(b); setPendingBolim(''); setPendingFloor('') }}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${pendingBlock === b ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                      {b}-blok
                    </button>
                  ))}
                </div>
              </div>

              {/* Bo'lim */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Bo'lim</p>
                <div className="flex flex-wrap gap-1.5 items-start content-start">
                  <button onClick={() => { setPendingBolim(''); setPendingFloor('') }}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${!pendingBolim ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                    Barcha
                  </button>
                  {(isWc ? WC_BOLIMS : SHOP_BOLIMS).map(n => (
                    <button key={n} onClick={() => { setPendingBolim(String(n)); setPendingFloor('') }}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${pendingBolim === String(n) ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Qavat */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Qavat</p>
                <div className="flex flex-wrap gap-1.5 items-start content-start">
                  <button onClick={() => setPendingFloor('')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${!pendingFloor ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                    Barcha
                  </button>
                  {ALL_FLOORS.map(f => (
                    <button key={f} onClick={() => setPendingFloor(String(f))}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${pendingFloor === String(f) ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                      {f}-qavat
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-border flex gap-2 shrink-0">
              <button onClick={clearFilters} className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Tozalash</button>
              <button onClick={applyFilters} className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity">Qo'llash</button>
            </div>
          </div>
        </div>
      )}

      {detailItem && isWc  && <WcDetailModal   wc={detailItem}   onClose={() => setDetailItem(null)} />}
      {detailItem && !isWc && <ShopDetailModal  shop={detailItem} onClose={() => setDetailItem(null)} />}
    </div>
  )
}
