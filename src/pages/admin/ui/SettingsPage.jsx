import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/shared/lib/auth'
import { Percent, Gift } from 'lucide-react'

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed
        ${checked ? 'bg-emerald-500' : 'bg-muted'}`}
    >
      <span className={`pointer-events-none inline-block h-7 w-7 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200
        ${checked ? 'translate-x-8' : 'translate-x-0'}`}
      />
    </button>
  )
}

export default function SettingsPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch('/api/settings').then(r => r.json()),
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (body) => apiFetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),
    onSuccess: (updated) => qc.setQueryData(['settings'], updated),
  })

  const chegirmaEnabled = data?.chegirma_enabled ?? true
  const bonusEnabled    = data?.bonus_enabled ?? true

  return (
    <div className="p-8 h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-1">Sozlamalar</h1>
      <p className="text-sm text-muted-foreground mb-8">Chegirma va bonus tizimini boshqarish</p>

      <div className="grid grid-cols-2 gap-5 flex-1 max-h-72">
        {/* Chegirma card */}
        <div className={`rounded-3xl border-2 bg-background px-8 py-7 flex flex-col justify-between transition-colors ${chegirmaEnabled ? 'border-amber-200' : 'border-border'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${chegirmaEnabled ? 'bg-amber-100' : 'bg-muted'}`}>
              <Percent size={26} className={chegirmaEnabled ? 'text-amber-600' : 'text-muted-foreground'} />
            </div>
            <ToggleSwitch
              checked={chegirmaEnabled}
              disabled={isLoading || isPending}
              onChange={(val) => mutate({ chegirma_enabled: val })}
            />
          </div>
          <div className="mt-6">
            <p className="text-base font-bold text-foreground">Chegirma tizimi</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {chegirmaEnabled
                ? 'Faol — kalkulatorda chegirma hisoblanadi'
                : "O'chirilgan — yangi bronlarda chegirma yo'q"}
            </p>
            <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${chegirmaEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
              {chegirmaEnabled ? 'Yoqilgan' : "O'chirilgan"}
            </div>
          </div>
        </div>

        {/* Bonus card */}
        <div className={`rounded-3xl border-2 bg-background px-8 py-7 flex flex-col justify-between transition-colors ${bonusEnabled ? 'border-purple-200' : 'border-border'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${bonusEnabled ? 'bg-purple-100' : 'bg-muted'}`}>
              <Gift size={26} className={bonusEnabled ? 'text-purple-600' : 'text-muted-foreground'} />
            </div>
            <ToggleSwitch
              checked={bonusEnabled}
              disabled={isLoading || isPending}
              onChange={(val) => mutate({ bonus_enabled: val })}
            />
          </div>
          <div className="mt-6">
            <p className="text-base font-bold text-foreground">Bonus texnikalar</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {bonusEnabled
                ? "Faol — konditsioner, TV, muzlatgich ko'rinadi"
                : "O'chirilgan — bonus texnikalar ko'rsatilmaydi"}
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
    </div>
  )
}
