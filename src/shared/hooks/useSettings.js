import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/shared/lib/auth'

export function useSettings() {
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch('/api/settings').then(r => r.json()),
    staleTime: 30_000,
  })
  return {
    chegirmaEnabled: data?.chegirma_enabled ?? false,
  }
}
