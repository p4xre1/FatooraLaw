import { createClient } from "@supabase/supabase-js"
import { readSupabaseConfig } from "./supabaseConfig"

export const supabaseConfig = readSupabaseConfig({
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
})

/** False when the pair is missing *or* unusable (invalid URL, secret key…). */
export const isSupabaseConfigured = supabaseConfig.configured
/** Why it is unusable, or null. Rendered verbatim by the auth screens. */
export const supabaseConfigProblem = supabaseConfig.problem
/** Non-blocking inconsistency on a usable configuration (e.g. mismatched project). */
export const supabaseConfigWarning = supabaseConfig.warning

// Keep the app renderable in local development until .env is configured. A
// refused value (secret key) is deliberately replaced too: nothing signed with
// it should ever leave the browser.
const clientUrl = isSupabaseConfigured && supabaseConfig.url ? supabaseConfig.url : "https://missing-supabase-config.supabase.co"
const clientKey = isSupabaseConfigured && supabaseConfig.anonKey ? supabaseConfig.anonKey : "missing-supabase-anon-key"

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    `${supabaseConfigProblem?.message ?? `Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in ${".env"} (see .env.example).`} ` +
      "Sign up / sign in / password reset will not work until this is fixed.",
  )
} else if (supabaseConfigWarning) {
  // eslint-disable-next-line no-console
  console.warn(supabaseConfigWarning)
}

export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
