import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const isSupabaseConfigured = Boolean(url?.trim() && anonKey?.trim())

// Keep the app renderable in local development until .env is configured.
const clientUrl = url?.trim() || "https://missing-supabase-config.supabase.co"
const clientKey = anonKey?.trim() || "missing-supabase-anon-key"

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    "Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file " +
      "(see .env.example) — sign up / sign in / password reset will not work without them.",
  )
}

export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
