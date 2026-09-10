import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import AdminApp from './admin/AdminApp'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

// Only the new /admin/* subtree is URL-routed (see src/admin/AdminApp.tsx).
// <App/> itself has no idea a router exists — it never reads the URL, it
// manages its own screen with local state — so mounting it at "/*" here
// preserves 100% of its existing behavior at every non-/admin path,
// including the prerendered landing page hydration below (BrowserRouter/
// Routes/Route render no DOM of their own, so the hydrated markup is
// identical to before this change).
const app = (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </BrowserRouter>
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
