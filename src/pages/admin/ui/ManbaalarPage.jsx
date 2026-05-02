import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/shared/lib/auth'
import { Plus, Pencil, Trash2, Check, GripVertical } from 'lucide-react'

import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function fetchSources() {
  return apiFetch('/api/sources').then(r => r.json())
}

function SourceCard({ s, onEdit, onDelete, isEditing, editName, setEditName, editError, onSaveEdit, onCancelEdit, editPending }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: s.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-card border rounded-2xl p-4 flex items-start gap-3 transition-shadow duration-150 select-none ${
        isDragging
          ? 'opacity-0'
          : 'border-border hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      {/* Grip handle */}
      <button
        {...attributes}
        {...listeners}
        tabIndex={-1}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors mt-0.5 shrink-0 touch-none"
      >
        <GripVertical size={16} />
      </button>

      {isEditing ? (
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <input
            autoFocus
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && editName.trim()) onSaveEdit()
              if (e.key === 'Escape') onCancelEdit()
            }}
            className="w-full px-3 py-1.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {editError && <p className="text-xs text-red-500">{editError}</p>}
          <div className="flex gap-1.5">
            <button
              onClick={onSaveEdit}
              disabled={!editName.trim() || editPending}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors disabled:opacity-40 text-xs font-semibold"
            >
              <Check size={13} strokeWidth={2.5} />
              Saqlash
            </button>
            <button
              onClick={onCancelEdit}
              className="flex-1 py-1.5 rounded-xl bg-muted text-muted-foreground hover:bg-muted/70 transition-colors text-xs font-semibold"
            >
              Bekor
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <p className="text-sm font-semibold text-foreground leading-snug truncate">{s.name}</p>
          <div className="flex items-center justify-between">
            <button
              onClick={() => onEdit(s)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs"
            >
              <Pencil size={11} />
              Tahrirlash
            </button>
            <button
              onClick={() => onDelete(s.id)}
              className="flex items-center px-2 py-1 rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DragOverlayCard({ s }) {
  return (
    <div className="bg-card border border-slate-300 rounded-2xl p-4 flex items-start gap-3 shadow-2xl ring-2 ring-blue-400/30 cursor-grabbing select-none">
      <div className="text-muted-foreground/50 mt-0.5 shrink-0">
        <GripVertical size={16} />
      </div>
      <p className="text-sm font-semibold text-foreground">{s.name}</p>
    </div>
  )
}

export default function ManbaalarPage() {
  const qc = useQueryClient()
  const { data: sources = [], isLoading } = useQuery({ queryKey: ['sources'], queryFn: fetchSources })

  const [newName, setNewName]   = useState('')
  const [editId, setEditId]     = useState(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState('')
  const [addError, setAddError] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [activeId, setActiveId] = useState(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sources'] })

  const addMutation = useMutation({
    mutationFn: (name) =>
      apiFetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d }),
    onSuccess: () => { setNewName(''); setAddError(''); invalidate() },
    onError: (e) => setAddError(e.message),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, name }) =>
      apiFetch(`/api/sources/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d }),
    onSuccess: () => { setEditId(null); setEditName(''); setEditError(''); invalidate() },
    onError: (e) => setEditError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => apiFetch(`/api/sources/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => { setDeleteId(null); invalidate() },
  })

  const reorderMutation = useMutation({
    mutationFn: (ids) =>
      apiFetch('/api/sources/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }).then(r => r.json()),
  })

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  )

  function handleDragStart({ active }) {
    setActiveId(active.id)
  }

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
    <div className="h-full flex flex-col p-4 md:p-6 gap-5 overflow-hidden">

      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold">Manbaalar</h1>
        <span className="text-sm text-muted-foreground tabular-nums">{sources.length} ta</span>
      </div>

      {/* Yangi qo'shish */}
      <div className="bg-card border border-border rounded-2xl p-4 flex gap-2 shrink-0">
        <input
          type="text"
          placeholder="Masalan: Instagram"
          value={newName}
          onChange={e => { setNewName(e.target.value); setAddError('') }}
          onKeyDown={e => e.key === 'Enter' && newName.trim() && addMutation.mutate(newName.trim())}
          className="flex-1 px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={() => newName.trim() && addMutation.mutate(newName.trim())}
          disabled={!newName.trim() || addMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity shrink-0"
        >
          <Plus size={14} />
          Qo'shish
        </button>
        {addError && <p className="text-xs text-red-500 self-center">{addError}</p>}
      </div>

      {/* Kartalar */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            Hali manbaa qo'shilmagan
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sources.map(s => s.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {sources.map(s => (
                  <SourceCard
                    key={s.id}
                    s={s}
                    onEdit={(src) => { setEditId(src.id); setEditName(src.name); setEditError('') }}
                    onDelete={setDeleteId}
                    isEditing={editId === s.id}
                    editName={editName}
                    setEditName={(v) => { setEditName(v); setEditError('') }}
                    editError={editError}
                    onSaveEdit={() => editMutation.mutate({ id: s.id, name: editName.trim() })}
                    onCancelEdit={() => { setEditId(null); setEditName(''); setEditError('') }}
                    editPending={editMutation.isPending}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay dropAnimation={{
              duration: 180,
              easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
            }}>
              {activeSource ? <DragOverlayCard s={activeSource} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* O'chirish tasdiqlash */}
      {deleteId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={e => e.target === e.currentTarget && setDeleteId(null)}
        >
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold mb-2">Manbaa o'chirilsinmi?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Bu manbaa bilan bog'liq bitimlar saqlanib qoladi, lekin manbaa ma'lumoti o'chadi.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Bekor
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                O'chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
