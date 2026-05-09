import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Router } from './Router'
import { SocketProvider, NotificationProvider, ThemeProvider } from './contexts'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <SocketProvider>
            <NotificationProvider>
              <Router />
              <Toaster position="top-right" richColors />
            </NotificationProvider>
          </SocketProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
