import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import Router from '@/app/router'
import { networkErrorToast, showToast } from '@/shared/lib/toast'

function isNetworkError(err) {
  return err instanceof TypeError && err.message === 'Failed to fetch'
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err) => {
      if (isNetworkError(err)) networkErrorToast()
    },
  }),
  mutationCache: new MutationCache({
    onError: (err) => {
      if (isNetworkError(err)) {
        networkErrorToast()
      } else if (err?.message) {
        showToast(err.message, 'error')
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  )
}
