import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/shared/lib/auth'

export function useSettings() {
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch('/api/settings').then(r => r.json()),
    staleTime: 0,
    refetchInterval: 10_000,
  })
  return {
    chegirmaEnabled: data?.chegirma_enabled ?? true,
    bonusEnabled: data?.bonus_enabled ?? true,
  }
}
