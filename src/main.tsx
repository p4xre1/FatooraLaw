import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

const app = (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)

const container = document.getElementById('root')!

// Production builds prerender the signed-out landing page into this element
// (see scripts/prerender.mjs) — hydrate over it instead of re-rendering from
// scratch, so visitors and crawlers see instant content with no flash.
// In dev (or if prerendering was skipped), the container starts empty and we
// fall back to a normal client render.
if (container.hasChildNodes()) {
  ReactDOM.hydrateRoot(container, app)
} else {
  ReactDOM.createRoot(container).render(app)
}
