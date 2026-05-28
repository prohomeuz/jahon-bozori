import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/shared/lib/auth'

export function useDiscountBrackets() {
  return useQuery({
    queryKey: ['discount-brackets'],
    queryFn: () => apiFetch('/api/discount-brackets').then(r => r.json()),
    staleTime: 30_000,
    placeholderData: [],
  })
}
