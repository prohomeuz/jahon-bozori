import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/shared/lib/auth'
import { showToast } from '@/shared/lib/toast'
import { Percent, Gift, Plus, Pencil, Trash2, Check, GripVertical, Upload, X, ChevronDown, ChevronUp } from 'lucide-react'
import {
  DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, arrayMove, rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-emerald-500' : 'bg-muted'}`}
    >
      <span className={`pointer-events-none inline-block h-7 w-7 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${checked ? 'translate-x-8' : 'translate-x-0'}`} />
    </button>
  )
}

function SortableCard({ s, onEdit, onDelete, isEditing, editName, setEditName, editError, onSaveEdit, onCancelEdit, editPending }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style}
      className={`group relative bg-card border rounded-2xl p-4 flex items-start gap-3 transition-shadow duration-150 select-none ${isDragging ? 'opacity-0' : 'border-border hover:border-slate-300 hover:shadow-sm'}`}>
      <button {...attributes} {...listeners} tabIndex={-1}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors mt-0.5 shrink-0 touch-none">
        <GripVertical size={16} />
      </button>
      {isEditing ? (
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <input autoFocus type="text" value={editName} onChange={e => setEditName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && editName.trim()) onSaveEdit(); if (e.key === 'Escape') onCancelEdit() }}
            className="w-full px-3 py-1.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          {editError && <p className="text-xs text-red-500">{editError}</p>}
          <div className="flex gap-1.5">
            <button onClick={onSaveEdit} disabled={!editName.trim() || editPending}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors disabled:opacity-40 text-xs font-semibold">
              <Check size={13} strokeWidth={2.5} /> Saqlash
            </button>
            <button onClick={onCancelEdit}
              className="flex-1 py-1.5 rounded-xl bg-muted text-muted-foreground hover:bg-muted/70 transition-colors text-xs font-semibold">
              Bekor
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <p className="text-sm font-semibold text-foreground leading-snug truncate">{s.name}</p>
          <div className="flex items-center justify-between">
            <button onClick={() => onEdit(s)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs">
              <Pencil size={11} /> Tahrirlash
            </button>
            <button onClick={() => onDelete(s.id)}
              className="flex items-center px-2 py-1 rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Discount Brackets Section ─────────────────────────────────────────────────

function DiscountBracketsSection() {
  const qc = useQueryClient()
  const { data: brackets = [], isLoading } = useQuery({
    queryKey: ['discount-brackets'],
    queryFn: () => apiFetch('/api/discount-brackets').then(r => r.json()),
  })

  const [addPct, setAddPct]   = useState('')
  const [addDisc, setAddDisc] = useState('')
  const [addErr, setAddErr]   = useState('')
  const [editId, setEditId]   = useState(null)
  const [editPct, setEditPct]   = useState('')
  const [editDisc, setEditDisc] = useState('')
  const [editErr, setEditErr]   = useState('')
  const [deleteId, setDeleteId] = useState(null)

  const set = (data) => qc.setQueryData(['discount-brackets'], data)

  const addMut = useMutation({
    mutationFn: () => apiFetch('/api/discount-brackets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ min_percent: parseInt(addPct), discount_usd: parseFloat(addDisc) }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d }),
    onSuccess: (data) => { set(data); setAddPct(''); setAddDisc(''); setAddErr('') },
    onError: (e) => setAddErr(e.message),
  })

  const editMut = useMutation({
    mutationFn: ({ id }) => apiFetch(`/api/discount-brackets/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ min_percent: parseInt(editPct), discount_usd: parseFloat(editDisc) }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d }),
    onSuccess: (data) => { set(data); setEditId(null); setEditErr('') },
    onError: (e) => setEditErr(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id) => apiFetch(`/api/discount-brackets/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: (data) => { set(data); setDeleteId(null) },
    onError: (e) => showToast(e.message, 'error'),
  })

  function startEdit(b) { setEditId(b.id); setEditPct(String(b.min_percent)); setEditDisc(String(b.discount_usd)); setEditErr('') }
  function cancelEdit() { setEditId(null); setEditErr('') }

  const canAdd = addPct && addDisc && !addMut.isPending
  const sorted = [...brackets].sort((a, b) => a.min_percent - b.min_percent)

  return (
    <div className="mt-10 border-t border-border pt-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold">Chegirma jadvali</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Boshlang'ich to'lov % ga qarab chegirma ($/m²)</p>
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">{brackets.length} ta qoida</span>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_auto] items-center px-4 py-2.5 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Min to'lov %</span>
          <span>Chegirma $/m²</span>
          <span className="w-16" />
        </div>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-10 rounded-xl bg-muted/40 animate-pulse" />)}
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">Chegirma qoidalari yo'q</div>
        ) : (
          <div className="divide-y divide-border/60">
            {sorted.map(b => (
              <div key={b.id} className="grid grid-cols-[1fr_1fr_auto] items-center px-4 py-3 hover:bg-muted/30 transition-colors">
                {editId === b.id ? (
                  <>
                    <input autoFocus type="number" min="1" max="100" value={editPct} onChange={e => { setEditPct(e.target.value); setEditErr('') }}
                      onKeyDown={e => { if (e.key === 'Enter' && editPct && editDisc) editMut.mutate({ id: b.id }); if (e.key === 'Escape') cancelEdit() }}
                      className="w-24 px-2 py-1 text-sm rounded-lg border border-amber-300 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    <input type="number" min="0" value={editDisc} onChange={e => { setEditDisc(e.target.value); setEditErr('') }}
                      onKeyDown={e => { if (e.key === 'Enter' && editPct && editDisc) editMut.mutate({ id: b.id }); if (e.key === 'Escape') cancelEdit() }}
                      className="w-24 px-2 py-1 text-sm rounded-lg border border-amber-300 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => editPct && editDisc && editMut.mutate({ id: b.id })} disabled={!editPct || !editDisc || editMut.isPending}
                        className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center justify-center disabled:opacity-40 transition-colors">
                        <Check size={14} strokeWidth={2.5} />
                      </button>
                      <button onClick={cancelEdit} className="w-8 h-8 rounded-lg bg-muted text-muted-foreground hover:bg-muted/70 flex items-center justify-center transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                    {editErr && <p className="col-span-3 text-xs text-red-500 px-1 pb-1">{editErr}</p>}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-bold">{b.min_percent}%</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">−{b.discount_usd} $/m²</span>
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => startEdit(b)}
                        className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteId(b.id)}
                        className="w-8 h-8 rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        {/* Add row */}
        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-4 py-3 border-t border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <input type="number" min="1" max="100" placeholder="% (1-100)" value={addPct}
              onChange={e => { setAddPct(e.target.value); setAddErr('') }}
              onKeyDown={e => e.key === 'Enter' && canAdd && addMut.mutate()}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min="0" placeholder="$ / m²" value={addDisc}
              onChange={e => { setAddDisc(e.target.value); setAddErr('') }}
              onKeyDown={e => e.key === 'Enter' && canAdd && addMut.mutate()}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button onClick={() => addMut.mutate()} disabled={!canAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity whitespace-nowrap">
            <Plus size={14} /> Qo'shish
          </button>
        </div>
        {addErr && <p className="text-xs text-red-500 px-4 pb-3">{addErr}</p>}
      </div>

      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold mb-2">Chegirma qoidasi o'chirilsinmi?</h3>
            <p className="text-sm text-muted-foreground mb-6">Bu qoida butunlay o'chiriladi.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Bekor</button>
              <button onClick={() => delMut.mutate(deleteId)} disabled={delMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">O'chirish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Bonus Brackets Section ────────────────────────────────────────────────────

function BonusItemImage({ imagePath, name, size = 'md' }) {
  const sizeClass = size === 'lg' ? 'w-16 h-16' : 'w-10 h-10'
  const textClass = size === 'lg' ? 'text-2xl' : 'text-base'
  const colors = ['bg-amber-100 text-amber-600', 'bg-purple-100 text-purple-600', 'bg-blue-100 text-blue-600', 'bg-emerald-100 text-emerald-600']
  const color = colors[(name?.charCodeAt(0) ?? 0) % colors.length]
  return (
    <div className={`${sizeClass} rounded-xl overflow-hidden border border-border shrink-0`}>
      {imagePath
        ? <img src={imagePath} alt={name} className="w-full h-full object-cover" loading="lazy" />
        : <div className={`w-full h-full flex items-center justify-center font-bold ${textClass} ${color}`}>{name?.charAt(0)?.toUpperCase() ?? '?'}</div>}
    </div>
  )
}

function BonusItemRow({ item, onUpdate, onDelete }) {
  const [editing, setEditing]   = useState(false)
  const [name, setName]         = useState(item.name)
  const [imgFile, setImgFile]   = useState(null)
  const [preview, setPreview]   = useState(null)
  const [err, setErr]           = useState('')
  const [saving, setSaving]     = useState(false)
  const fileRef = useRef()

  function pickFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setImgFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function save() {
    if (!name.trim()) { setErr('Nom kiritilishi shart'); return }
    setSaving(true)
    const fd = new FormData()
    fd.append('name', name.trim())
    if (imgFile) fd.append('image', imgFile)
    try {
      const r = await apiFetch(`/api/bonus-brackets/items/${item.id}`, { method: 'PUT', body: fd })
      const d = await r.json()
      if (!r.ok) { setErr(d.error ?? 'Xato'); return }
      onUpdate(d)
      setEditing(false); setImgFile(null); setPreview(null); setErr('')
    } catch { setErr('Xato yuz berdi') }
    finally { setSaving(false) }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-muted/40 group transition-colors">
        <BonusItemImage imagePath={item.image_path} name={item.name} />
        <span className="flex-1 text-sm font-medium text-foreground">{item.name}</span>
        <button onClick={() => { setEditing(true); setName(item.name); setPreview(item.image_path) }}
          className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-all">
          <Pencil size={12} />
        </button>
        <button onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all">
          <Trash2 size={12} />
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => fileRef.current?.click()}
          className="relative shrink-0 w-10 h-10 rounded-xl border-2 border-dashed border-amber-300 hover:border-amber-500 overflow-hidden transition-colors group">
          {preview
            ? <img src={preview} alt="" className="w-full h-full object-cover" />
            : <Upload size={14} className="absolute inset-0 m-auto text-amber-400 group-hover:text-amber-600 transition-colors" />}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
        </button>
        <input autoFocus type="text" value={name} onChange={e => { setName(e.target.value); setErr('') }}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="flex gap-1.5">
        <button onClick={save} disabled={saving || !name.trim()}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-40 text-xs font-semibold transition-colors">
          <Check size={12} strokeWidth={2.5} /> Saqlash
        </button>
        <button onClick={() => { setEditing(false); setImgFile(null); setPreview(null); setErr('') }}
          className="flex-1 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/70 text-xs font-semibold transition-colors">
          Bekor
        </button>
      </div>
    </div>
  )
}

function BonusBracketCard({ bracket, onUpdate, onDelete }) {
  const [expanded, setExpanded]   = useState(true)
  const [addName, setAddName]     = useState('')
  const [addImg, setAddImg]       = useState(null)
  const [addPreview, setAddPreview] = useState(null)
  const [addErr, setAddErr]       = useState('')
  const [adding, setAdding]       = useState(false)
  const [showAdd, setShowAdd]     = useState(false)
  const [deleteItemId, setDeleteItemId] = useState(null)
  const fileRef = useRef()

  function pickFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setAddImg(f)
    setAddPreview(URL.createObjectURL(f))
  }

  async function addItem() {
    if (!addName.trim()) { setAddErr('Nom kiritilishi shart'); return }
    setAdding(true)
    const fd = new FormData()
    fd.append('name', addName.trim())
    if (addImg) fd.append('image', addImg)
    try {
      const r = await apiFetch(`/api/bonus-brackets/${bracket.id}/items`, { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) { setAddErr(d.error ?? 'Xato'); return }
      onUpdate(d)
      setAddName(''); setAddImg(null); setAddPreview(null); setAddErr(''); setShowAdd(false)
    } catch { setAddErr('Xato yuz berdi') }
    finally { setAdding(false) }
  }

  async function deleteItem(itemId) {
    const r = await apiFetch(`/api/bonus-brackets/items/${itemId}`, { method: 'DELETE' })
    const d = await r.json()
    onUpdate(d)
    setDeleteItemId(null)
  }

  const items = bracket.items ?? []
  const canAddMore = items.length < 5

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-bold">{bracket.min_percent}%</span>
        <span className="text-xs text-muted-foreground flex-1">{items.length} ta texnika</span>
        <button onClick={() => setExpanded(v => !v)} className="w-7 h-7 rounded-lg text-muted-foreground hover:bg-muted flex items-center justify-center transition-colors">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button onClick={() => onDelete(bracket.id)} className="w-7 h-7 rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors">
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <div className="px-3 py-2">
          {items.length === 0 && !showAdd && (
            <p className="text-xs text-muted-foreground py-3 text-center">Texnika qo'shilmagan</p>
          )}
          {items.map(item => (
            <BonusItemRow key={item.id} item={item}
              onUpdate={onUpdate}
              onDelete={(id) => setDeleteItemId(id)} />
          ))}

          {showAdd && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 flex flex-col gap-2 mt-1">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="relative shrink-0 w-10 h-10 rounded-xl border-2 border-dashed border-purple-300 hover:border-purple-500 overflow-hidden transition-colors group">
                  {addPreview
                    ? <img src={addPreview} alt="" className="w-full h-full object-cover" />
                    : <Upload size={14} className="absolute inset-0 m-auto text-purple-400 group-hover:text-purple-600 transition-colors" />}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
                </button>
                <input autoFocus type="text" placeholder="Texnika nomi" value={addName}
                  onChange={e => { setAddName(e.target.value); setAddErr('') }}
                  onKeyDown={e => { if (e.key === 'Enter') addItem(); if (e.key === 'Escape') setShowAdd(false) }}
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-purple-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
              {addErr && <p className="text-xs text-red-500">{addErr}</p>}
              <div className="flex gap-1.5">
                <button onClick={addItem} disabled={adding || !addName.trim()}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-40 text-xs font-semibold transition-colors">
                  <Check size={12} strokeWidth={2.5} /> Qo'shish
                </button>
                <button onClick={() => { setShowAdd(false); setAddName(''); setAddImg(null); setAddPreview(null); setAddErr('') }}
                  className="flex-1 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/70 text-xs font-semibold transition-colors">
                  Bekor
                </button>
              </div>
            </div>
          )}

          {canAddMore && !showAdd && (
            <button onClick={() => setShowAdd(true)}
              className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-dashed border-border hover:border-solid">
              <Plus size={13} /> Texnika qo'shish
            </button>
          )}
          {!canAddMore && (
            <p className="text-xs text-muted-foreground/60 text-center py-2">Maksimal 5 ta</p>
          )}
        </div>
      )}

      {deleteItemId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={e => e.target === e.currentTarget && setDeleteItemId(null)}>
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold mb-2">Texnika o'chirilsinmi?</h3>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setDeleteItemId(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Bekor</button>
              <button onClick={() => deleteItem(deleteItemId)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors">O'chirish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BonusBracketsSection() {
  const qc = useQueryClient()
  const { data: brackets = [], isLoading } = useQuery({
    queryKey: ['bonus-brackets'],
    queryFn: () => apiFetch('/api/bonus-brackets').then(r => r.json()),
  })

  const [addPct, setAddPct] = useState('')
  const [addErr, setAddErr] = useState('')
  const [deleteId, setDeleteId] = useState(null)

  const set = (data) => qc.setQueryData(['bonus-brackets'], data)

  const addMut = useMutation({
    mutationFn: () => apiFetch('/api/bonus-brackets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ min_percent: parseInt(addPct) }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d }),
    onSuccess: (data) => { set(data); setAddPct(''); setAddErr('') },
    onError: (e) => setAddErr(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id) => apiFetch(`/api/bonus-brackets/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: (data) => { set(data); setDeleteId(null) },
    onError: (e) => showToast(e.message, 'error'),
  })

  const sorted = [...brackets].sort((a, b) => a.min_percent - b.min_percent)

  return (
    <div className="mt-10 border-t border-border pt-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold">Bonus texnikalar</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Har bir boshlang'ich to'lov % uchun beriladigan texnikalar (max 5 ta)</p>
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">{brackets.length} ta bracket</span>
      </div>

      {/* Add bracket */}
      <div className="bg-card border border-border rounded-2xl p-4 flex gap-2 mb-5">
        <input type="number" min="1" max="100" placeholder="Min to'lov % (1-100)" value={addPct}
          onChange={e => { setAddPct(e.target.value); setAddErr('') }}
          onKeyDown={e => e.key === 'Enter' && addPct && addMut.mutate()}
          className="flex-1 px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        <button onClick={() => addPct && addMut.mutate()} disabled={!addPct || addMut.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity shrink-0">
          <Plus size={14} /> Bracket qo'shish
        </button>
        {addErr && <p className="text-xs text-red-500 self-center">{addErr}</p>}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-2xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
          Hali bracket qo'shilmagan
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map(b => (
            <BonusBracketCard key={b.id} bracket={b}
              onUpdate={set}
              onDelete={(id) => setDeleteId(id)} />
          ))}
        </div>
      )}

      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold mb-2">Bracket o'chirilsinmi?</h3>
            <p className="text-sm text-muted-foreground mb-6">Bu bracketdagi barcha texnikalar ham o'chiriladi.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Bekor</button>
              <button onClick={() => delMut.mutate(deleteId)} disabled={delMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">O'chirish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch('/api/settings').then(r => r.json()),
  })
  const { mutate, isPending } = useMutation({
    mutationFn: (body) => apiFetch('/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(r => r.json()),
    onSuccess: (updated) => qc.setQueryData(['settings'], updated),
  })
  const chegirmaEnabled = data?.chegirma_enabled ?? true
  const bonusEnabled    = data?.bonus_enabled ?? true

  const { data: sources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: () => apiFetch('/api/sources').then(r => r.json()),
  })

  const [newName, setNewName]     = useState('')
  const [editId, setEditId]       = useState(null)
  const [editName, setEditName]   = useState('')
  const [editError, setEditError] = useState('')
  const [addError, setAddError]   = useState('')
  const [deleteId, setDeleteId]   = useState(null)
  const [activeId, setActiveId]   = useState(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sources'] })

  const addMutation = useMutation({
    mutationFn: (name) => apiFetch('/api/sources', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d }),
    onSuccess: () => { setNewName(''); setAddError(''); invalidate() },
    onError: (e) => setAddError(e.message),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, name }) => apiFetch(`/api/sources/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d }),
    onSuccess: () => { setEditId(null); setEditName(''); setEditError(''); invalidate() },
    onError: (e) => setEditError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => apiFetch(`/api/sources/${id}`, { method: 'DELETE' }).then(async r => {
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "O'chirishda xatolik"); return d
    }),
    onSuccess: () => { setDeleteId(null); invalidate() },
    onError: (e) => showToast(e.message, 'error'),
  })

  const reorderMutation = useMutation({
    mutationFn: (ids) => apiFetch('/api/sources/reorder', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? 'Xatolik'); return d }),
    onError: (e) => showToast(e.message, 'error'),
  })

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  )

  function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIdx = sources.findIndex(s => s.id === active.id)
    const newIdx = sources.findIndex(s => s.id === over.id)
    const reordered = arrayMove(sources, oldIdx, newIdx)
    qc.setQueryData(['sources'], reordered)
    reorderMutation.mutate(reordered.map(s => s.id))
  }

  const activeSource = sources.find(s => s.id === activeId)

  return (
    <div className="relative p-8 h-full flex flex-col overflow-hidden">
      {/* Tez kunda overlay */}
      <div className="absolute inset-0 z-40 flex flex-col items-center justify-center backdrop-blur-sm bg-background/60 pointer-events-auto select-none">
        <div className="flex flex-col items-center gap-5 px-8 py-10 rounded-3xl bg-background/90 border border-border shadow-2xl max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
            <span className="text-3xl">🔧</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">Tez kunda</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Bu sahifa hozirda ishlanmoqda.<br />Yaqin orada tayyor bo'ladi.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Ishlanmoqda
          </span>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-1">Sozlamalar</h1>
      <p className="text-sm text-muted-foreground mb-8">Chegirma va bonus tizimini boshqarish</p>

      <div className="grid grid-cols-2 gap-5 flex-none max-h-72" style={{ maxHeight: '18rem' }}>
        {/* Chegirma toggle card */}
        <div className={`rounded-3xl border-2 bg-background px-8 py-7 flex flex-col justify-between transition-colors ${chegirmaEnabled ? 'border-amber-200' : 'border-border'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${chegirmaEnabled ? 'bg-amber-100' : 'bg-muted'}`}>
              <Percent size={26} className={chegirmaEnabled ? 'text-amber-600' : 'text-muted-foreground'} />
            </div>
            <ToggleSwitch checked={chegirmaEnabled} disabled={isLoading || isPending} onChange={(val) => mutate({ chegirma_enabled: val })} />
          </div>
          <div className="mt-6">
            <p className="text-base font-bold text-foreground">Chegirma tizimi</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {chegirmaEnabled ? 'Faol — kalkulatorda chegirma hisoblanadi' : "O'chirilgan — yangi bronlarda chegirma yo'q"}
            </p>
            <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${chegirmaEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
              {chegirmaEnabled ? 'Yoqilgan' : "O'chirilgan"}
            </div>
          </div>
        </div>

        {/* Bonus toggle card */}
        <div className={`rounded-3xl border-2 bg-background px-8 py-7 flex flex-col justify-between transition-colors ${bonusEnabled ? 'border-purple-200' : 'border-border'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${bonusEnabled ? 'bg-purple-100' : 'bg-muted'}`}>
              <Gift size={26} className={bonusEnabled ? 'text-purple-600' : 'text-muted-foreground'} />
            </div>
            <ToggleSwitch checked={bonusEnabled} disabled={isLoading || isPending} onChange={(val) => mutate({ bonus_enabled: val })} />
          </div>
          <div className="mt-6">
            <p className="text-base font-bold text-foreground">Bonus texnikalar</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {bonusEnabled ? "Faol — konditsioner, TV, muzlatgich ko'rinadi" : "O'chirilgan — bonus texnikalar ko'rsatilmaydi"}
            </p>
            <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${bonusEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
              {bonusEnabled ? 'Yoqilgan' : "O'chirilgan"}
            </div>
          </div>
        </div>
      </div>

      {!chegirmaEnabled && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
          Chegirma o'chirilgan: yangi bron va sotuvlarda chegirma hisoblanmaydi. Avvalgi bronlar o'zgarmaydi.
        </div>
      )}

      <DiscountBracketsSection />
      <BonusBracketsSection />

      {/* ── Manbaalar ── */}
      <div className="mt-10 border-t border-border pt-8 pb-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Manbaalar</h2>
            <span className="text-sm text-muted-foreground tabular-nums">{sources.length} ta</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 flex gap-2 mb-5">
          <input type="text" placeholder="Masalan: Instagram" value={newName}
            onChange={e => { setNewName(e.target.value); setAddError('') }}
            onKeyDown={e => e.key === 'Enter' && newName.trim() && addMutation.mutate(newName.trim())}
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          <button onClick={() => newName.trim() && addMutation.mutate(newName.trim())}
            disabled={!newName.trim() || addMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity shrink-0">
            <Plus size={14} /> Qo'shish
          </button>
          {addError && <p className="text-xs text-red-500 self-center">{addError}</p>}
        </div>

        {sourcesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />)}
          </div>
        ) : sources.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Hali manbaa qo'shilmagan</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter}
            onDragStart={({ active }) => setActiveId(active.id)}
            onDragEnd={handleDragEnd}>
            <SortableContext items={sources.map(s => s.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {sources.map(s => (
                  <SortableCard key={s.id} s={s}
                    onEdit={(src) => { setEditId(src.id); setEditName(src.name); setEditError('') }}
                    onDelete={setDeleteId}
                    isEditing={editId === s.id}
                    editName={editName}
                    setEditName={(v) => { setEditName(v); setEditError('') }}
                    editError={editError}
                    onSaveEdit={() => editMutation.mutate({ id: editId, name: editName.trim() })}
                    onCancelEdit={() => { setEditId(null); setEditName(''); setEditError('') }}
                    editPending={editMutation.isPending}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
              {activeSource ? (
                <div className="bg-card border border-slate-300 rounded-2xl p-4 flex items-start gap-3 shadow-2xl ring-2 ring-blue-400/30 cursor-grabbing select-none">
                  <div className="text-muted-foreground/50 mt-0.5 shrink-0"><GripVertical size={16} /></div>
                  <p className="text-sm font-semibold text-foreground">{activeSource.name}</p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold mb-2">Manbaa o'chirilsinmi?</h3>
            <p className="text-sm text-muted-foreground mb-6">Bu manbaa bilan bog'liq bitimlar saqlanib qoladi, lekin manbaa ma'lumoti o'chadi.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Bekor</button>
              <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">O'chirish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
