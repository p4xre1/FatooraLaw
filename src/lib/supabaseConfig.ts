/**
 * Public Supabase configuration: read it, validate it, explain it.
 *
 * `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are inlined into the browser
 * bundle, so everything here must stay public (project URL + anon/publishable
 * key). A `service_role` (or `sb_secret_`) key in a `VITE_*` variable is a full
 * database compromise: it is detected and refused rather than handed to
 * `createClient`. See SECURITY.md and SUPABASE_OPERATIONS.md.
 *
 * Why this module exists at all: a single boolean can only say "not
 * configured", which leaves the operator guessing between an unset variable,
 * a swapped pair, a dashboard link pasted as the API URL, or a secret key in
 * the browser slot. The auth screens render `problem.message` verbatim so the
 * exact variable to fix is named before anyone tries to sign in.
 */

export const SUPABASE_URL_VARIABLE = "VITE_SUPABASE_URL"
export const SUPABASE_ANON_KEY_VARIABLE = "VITE_SUPABASE_ANON_KEY"

const ENV_FILE = ".env"
const EXAMPLE_FILE = ".env.example"

export type SupabaseConfigProblemCode =
  | "missing-both"
  | "missing-url"
  | "missing-key"
  | "swapped-values"
  | "invalid-url"
  | "dashboard-url"
  | "secret-key"

export type SupabaseConfigProblem = {
  code: SupabaseConfigProblemCode
  /** French, actionable, user-facing message. Never contains a key value. */
  message: string
  /** Variables the operator has to fix. Used to build short UI hints. */
  variables: string[]
}

export type SupabaseConfig = {
  /** Trimmed values; empty strings when absent. */
  url: string
  anonKey: string
  configured: boolean
  problem: SupabaseConfigProblem | null
  /** Non-blocking: usable, but something looks inconsistent. */
  warning: string | null
}

/** Raw values, usually straight from `import.meta.env`. */
export type SupabaseEnvSource = {
  url?: unknown
  anonKey?: unknown
}

const trimmed = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

function setupProblem(
  code: SupabaseConfigProblemCode,
  variables: string[],
  cause = "",
): SupabaseConfigProblem {
  return {
    code,
    variables,
    message:
      `Supabase n'est pas configuré : ${cause}` +
      `Ajoutez ${variables.join(" et ")} dans le fichier ${ENV_FILE} (modèle : ${EXAMPLE_FILE}), puis redémarrez Vite.`,
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === "https:" || protocol === "http:"
  } catch {
    return false
  }
}

/** Legacy Supabase keys are JWTs (`eyJ…`); newer publishable/secret keys are prefixed. */
function isJwt(value: string): boolean {
  return /^eyJ[\w-]*\.[\w-]+\.[\w-]+$/.test(value)
}

/** Decodes a JWT payload without verifying it — enough to spot the key's `role`/`ref`. */
function jwtPayload(value: string): Record<string, unknown> | null {
  if (!isJwt(value)) return null
  try {
    const segment = value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = segment.padEnd(segment.length + ((4 - (segment.length % 4)) % 4), "=")
    const payload: unknown = JSON.parse(atob(padded))
    return payload !== null && typeof payload === "object" ? (payload as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** True for a service-role JWT or a new-style secret key — never allowed client-side. */
function isSecretKey(value: string): boolean {
  if (value.startsWith("sb_secret_")) return true
  return jwtPayload(value)?.role === "service_role"
}

/** `https://<ref>.supabase.co` → `<ref>`; null for anything else (custom domains included). */
function projectRefFromUrl(url: string): string | null {
  try {
    const match = /^([a-z0-9-]+)\.supabase\.(co|in)$/i.exec(new URL(url).hostname)
    return match ? match[1] : null
  } catch {
    return null
  }
}

function projectRefFromKey(key: string): string | null {
  const ref = jwtPayload(key)?.ref
  return typeof ref === "string" ? ref : null
}

/** `https://supabase.com/dashboard/...` is the most common wrong value for the URL variable. */
function isDashboardUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return hostname === "supabase.com" || hostname.endsWith(".supabase.com")
  } catch {
    return false
  }
}

/**
 * Classifies the two public variables. `configured` stays false whenever the
 * pair cannot be trusted, so no caller ever reaches the network with a bad or
 * privileged key. Pure and synchronous: safe to unit test and to call on every
 * render.
 */
export function readSupabaseConfig(source: SupabaseEnvSource = {}): SupabaseConfig {
  // Trailing slashes are common in copied URLs and harmless to supabase-js,
  // but normalizing here keeps `supabaseConfig.url` comparable to the docs.
  const url = trimmed(source.url).replace(/\/+$/, "")
  const anonKey = trimmed(source.anonKey)
  const base = { url, anonKey }

  if (!url && !anonKey) {
    return { ...base, configured: false, problem: setupProblem("missing-both", [SUPABASE_URL_VARIABLE, SUPABASE_ANON_KEY_VARIABLE]), warning: null }
  }
  if (!url) {
    return {
      ...base,
      configured: false,
      problem: setupProblem("missing-url", [SUPABASE_URL_VARIABLE], `${SUPABASE_URL_VARIABLE} est absente. `),
      warning: null,
    }
  }
  if (!anonKey) {
    return {
      ...base,
      configured: false,
      problem: setupProblem("missing-key", [SUPABASE_ANON_KEY_VARIABLE], `${SUPABASE_ANON_KEY_VARIABLE} est absente. `),
      warning: null,
    }
  }
  // A URL in the key slot (or a key in the URL slot) is a copy/paste inversion,
  // not a missing variable — say so instead of "invalid URL".
  if ((isJwt(url) || url.startsWith("sb_publishable_") || url.startsWith("sb_secret_")) || isHttpUrl(anonKey)) {
    return {
      ...base,
      configured: false,
      problem: setupProblem(
        "swapped-values",
        [SUPABASE_URL_VARIABLE, SUPABASE_ANON_KEY_VARIABLE],
        "les deux variables semblent inversées (une clé a été détectée dans l'URL, ou une URL dans la clé). ",
      ),
      warning: null,
    }
  }
  if (isDashboardUrl(url)) {
    return {
      ...base,
      configured: false,
      problem: setupProblem(
        "dashboard-url",
        [SUPABASE_URL_VARIABLE],
        `${SUPABASE_URL_VARIABLE} contient l'adresse du tableau de bord Supabase, pas celle de l'API. ` +
          "Utilisez l'URL de l'API du projet, par exemple https://<référence>.supabase.co. ",
      ),
      warning: null,
    }
  }
  if (!isHttpUrl(url)) {
    return {
      ...base,
      configured: false,
      problem: setupProblem(
        "invalid-url",
        [SUPABASE_URL_VARIABLE],
        `${SUPABASE_URL_VARIABLE} doit contenir l'URL de l'API du projet, par exemple https://<référence>.supabase.co. `,
      ),
      warning: null,
    }
  }
  if (isSecretKey(anonKey)) {
    return {
      ...base,
      configured: false,
      problem: {
        code: "secret-key",
        variables: [SUPABASE_ANON_KEY_VARIABLE],
        message:
          `Sécurité : ${SUPABASE_ANON_KEY_VARIABLE} contient une clé secrète (service_role ou sb_secret_). ` +
          "Remplacez-la par la clé anon/publishable publique, puis redémarrez Vite. " +
          "Une clé secrète dans le navigateur donne un accès administrateur complet à votre base : " +
          "elle ne doit jamais être exposée par une variable VITE_*. L'authentification reste désactivée tant que cette clé est présente.",
      },
      warning: null,
    }
  }

  const urlRef = projectRefFromUrl(url)
  const keyRef = projectRefFromKey(anonKey)
  const warning =
    urlRef && keyRef && urlRef !== keyRef
      ? `La clé ${SUPABASE_ANON_KEY_VARIABLE} appartient au projet « ${keyRef} » alors que ${SUPABASE_URL_VARIABLE} pointe vers « ${urlRef} » : vérifiez qu'elles viennent du même projet Supabase.`
      : null

  return { ...base, configured: true, problem: null, warning }
}
