import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/shared/lib/auth'
import { showToast } from '@/shared/lib/toast'
import { Percent, Plus, Pencil, Trash2, Check, X, GripVertical } from 'lucide-react'
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

// Slider foiz tanlash — mavjud foizlar red tick bilan ko'rsatiladi
function PercentSlider({ value, onChange, allBrackets = [], excludeId = null }) {
  const pct = parseInt(value) || 1
  const takenPcts = allBrackets.filter(b => b.id !== excludeId).map(b => b.min_percent)
  const isConflict = takenPcts.includes(pct)

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">Min boshlang'ich to'lov</span>
        <span className={`text-2xl font-bold tabular-nums transition-colors ${isConflict ? 'text-red-500' : 'text-amber-600'}`}>
          {pct}%
        </span>
      </div>
      <input
        type="range" min="1" max="100" value={pct}
        onChange={e => onChange(e.target.value)}
        className="w-full cursor-pointer h-1.5 rounded-full appearance-none bg-muted"
        style={{ accentColor: isConflict ? '#ef4444' : '#f59e0b' }}
      />
      {/* Mavjud foizlar — qizil chiziqlari */}
      {takenPcts.length > 0 && (
        <div className="relative h-2 pointer-events-none">
          {takenPcts.map(p => (
            <div
              key={p}
              className="absolute top-0 bottom-0 w-0.5 bg-red-400/60 rounded-full"
              style={{ left: `${(p - 1) / 99 * 100}%` }}
              title={`${p}% band`}
            />
          ))}
        </div>
      )}
      {isConflict && (
        <p className="text-xs text-red-500 mt-1 font-medium">Bu foiz allaqachon band — boshqa qiymat tanlang</p>
      )}
    </div>
  )
}

// ── Chegirma darajalari (toggle ichida) ──────────────────────────────────────

function DiscountBrackets() {
  const qc = useQueryClient()
  const { data: brackets = [], isLoading } = useQuery({
    queryKey: ['discount-brackets'],
    queryFn: () => apiFetch('/api/discount-brackets').then(r => r.json()),
    staleTime: 30_000,
  })

  const [addPct, setAddPct]     = useState('10')
  const [addDisc, setAddDisc]   = useState('')
  const [addErr, setAddErr]     = useState('')
  const [editId, setEditId]     = useState(null)
  const [editPct, setEditPct]   = useState('')
  const [editDisc, setEditDisc] = useState('')
  const [editErr, setEditErr]   = useState('')
  const [deleteId, setDeleteId] = useState(null)

  const set = (data) => qc.setQueryData(['discount-brackets'], data)
  const sorted = [...brackets].sort((a, b) => a.min_percent - b.min_percent)

  // Brackets yuklanganida yoki o'zgarganda, addPct band bo'lsa birinchi bo'shga ko'chir
  useEffect(() => {
    if (brackets.length === 0) return
    const taken = brackets.map(b => b.min_percent)
    if (!taken.includes(parseInt(addPct))) return
    for (let p = 10; p <= 100; p += 10) { if (!taken.includes(p)) { setAddPct(String(p)); return } }
    for (let p = 1; p <= 100; p++)      { if (!taken.includes(p)) { setAddPct(String(p)); return } }
  }, [brackets]) // eslint-disable-line react-hooks/exhaustive-deps

  const addConflict  = brackets.map(b => b.min_percent).includes(parseInt(addPct))
  const editConflict = editId != null
    ? brackets.filter(b => b.id !== editId).map(b => b.min_percent).includes(parseInt(editPct))
    : false
  const addMut = useMutation({
    mutationFn: () => apiFetch('/api/discount-brackets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ min_percent: parseInt(addPct), discount_usd: parseFloat(addDisc) }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d }),
    onSuccess: (data) => { set(data); setAddDisc(''); setAddErr('') },
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

  function startEdit(b) {
    setEditId(b.id); setEditPct(String(b.min_percent)); setEditDisc(String(b.discount_usd)); setEditErr('')
  }
  function cancelEdit() { setEditId(null); setEditErr('') }

  const _canAdd = addDisc && !addMut.isPending && !addConflict

  return (
    <div className="border-t border-amber-100 px-6 pb-6 pt-5">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
        To'lov foiziga qarab chegirma darajalari
      </p>

      {isLoading ? (
        <div className="space-y-2 mb-4">
          {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-200 py-5 text-center text-sm text-muted-foreground mb-4">
          Hali daraja qo'shilmagan
        </div>
      ) : (
        <div className="rounded-xl border border-amber-100 divide-y divide-amber-100/60 overflow-hidden mb-5">
          {sorted.map(b => (
            <div key={b.id} className="hover:bg-amber-50/30 transition-colors">
              {editId === b.id ? (
                <div className="px-4 py-4 flex flex-col gap-3">
                  <PercentSlider
                    value={editPct}
                    onChange={v => { setEditPct(v); setEditErr('') }}
                    allBrackets={brackets}
                    excludeId={b.id}
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center rounded-xl border border-amber-300 bg-amber-50/50 focus-within:ring-2 focus-within:ring-amber-300 overflow-hidden">
                      <input
                        autoFocus type="number" min="0" value={editDisc}
                        onChange={e => { setEditDisc(e.target.value); setEditErr('') }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && editDisc && !editConflict) editMut.mutate({ id: b.id })
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        placeholder="0"
                        className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none"
                      />
                      <span className="px-3 py-2 text-sm font-medium text-amber-700 border-l border-amber-200 bg-amber-100/50 shrink-0">$/m²</span>
                    </div>
                    <button
                      onClick={() => editDisc && !editConflict && editMut.mutate({ id: b.id })}
                      disabled={!editDisc || editConflict || editMut.isPending}
                      className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center justify-center disabled:opacity-40 transition-colors shrink-0">
                      <Check size={15} strokeWidth={2.5} />
                    </button>
                    <button onClick={cancelEdit}
                      className="w-9 h-9 rounded-xl bg-muted text-muted-foreground hover:bg-muted/70 flex items-center justify-center transition-colors shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                  {editErr && <p className="text-xs text-red-500">{editErr}</p>}
                </div>
              ) : (
                <div className="px-4 py-3 flex items-center gap-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-bold shrink-0">{b.min_percent}%</span>
                  <span className="text-xs text-muted-foreground/40 shrink-0">→</span>
                  <span className="text-sm font-semibold text-foreground flex-1">−{b.discount_usd} $/m²</span>
                  <button onClick={() => startEdit(b)}
                    className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-colors">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => setDeleteId(b.id)}
                    className="w-7 h-7 rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Yangi daraja qo'shish */}
      <div className="rounded-xl border border-border bg-background px-4 py-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-muted-foreground">Yangi daraja</p>
        <PercentSlider
          value={addPct}
          onChange={v => { setAddPct(v); setAddErr('') }}
          allBrackets={brackets}
        />
        <div className="flex gap-2">
          <div className="flex-1 flex items-center rounded-xl border border-border bg-muted/30 focus-within:bg-background focus-within:ring-2 focus-within:ring-ring overflow-hidden">
            <input
              type="number" min="0" placeholder="0" value={addDisc}
              onChange={e => { setAddDisc(e.target.value); setAddErr('') }}
              onKeyDown={e => e.key === 'Enter' && _canAdd && addMut.mutate()}
              className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none"
            />
            <span className="px-3 py-2 text-sm font-medium text-muted-foreground border-l border-border bg-muted/50 shrink-0">$/m²</span>
          </div>
          <button onClick={() => addMut.mutate()} disabled={!_canAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-amber-600 transition-colors whitespace-nowrap shrink-0">
            <Plus size={14} /> Qo'shish
          </button>
        </div>
        {addErr && <p className="text-xs text-red-500">{addErr}</p>}
      </div>

      {deleteId !== null && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60"
          onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold mb-2">Chegirma darajasi o'chirilsinmi?</h3>
            <p className="text-sm text-muted-foreground mb-6">Bu daraja butunlay o'chiriladi.</p>
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

// ── Manbaalar sortable card ───────────────────────────────────────────────────

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
  const chegirmaEnabled = data?.chegirma_enabled ?? false

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
    <div className="relative p-8 h-full flex flex-col overflow-y-auto">
      <h1 className="text-2xl font-bold mb-1">Sozlamalar</h1>
      <p className="text-sm text-muted-foreground mb-8">Tizim sozlamalari</p>

      {/* ── Chegirma tizimi kard ── */}
      <div className="mb-10">
        <div className={`rounded-3xl border-2 bg-background overflow-hidden transition-colors ${chegirmaEnabled ? 'border-amber-200' : 'border-border'}`}>
          {/* Toggle header */}
          <div className="px-7 py-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${chegirmaEnabled ? 'bg-amber-100' : 'bg-muted'}`}>
                <Percent size={22} className={chegirmaEnabled ? 'text-amber-600' : 'text-muted-foreground'} />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-foreground">Chegirma tizimi</p>
                <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
                  {chegirmaEnabled
                    ? "Yoqilgan — boshlang'ich to'lovga qarab chegirma"
                    : "O'chirilgan — yangi bronlarda chegirma yo'q"}
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={chegirmaEnabled}
              disabled={isLoading || isPending}
              onChange={(val) => mutate({ chegirma_enabled: val })}
            />
          </div>

          {/* Brackets — faqat yoqilganda ko'rinadi */}
          {chegirmaEnabled && <DiscountBrackets />}
        </div>
      </div>

      {/* ── Manbaalar ── */}
      <div className="border-t border-border pt-8 pb-10">
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
