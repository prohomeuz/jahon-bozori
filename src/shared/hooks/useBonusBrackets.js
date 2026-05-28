import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/shared/lib/auth'

export function useBonusBrackets() {
  return useQuery({
    queryKey: ['bonus-brackets'],
    queryFn: () => apiFetch('/api/bonus-brackets').then(r => r.json()),
    staleTime: 30_000,
    placeholderData: [],
  })
}
