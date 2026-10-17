import { Loader2 } from "lucide-react"

/**
 * Google's four-colour "G". lucide-react ships no brand marks, and the Google
 * identity guidelines require the official colours next to the button label.
 */
export function GoogleMark({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44A11.96 11.96 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.1C6.23 6.87 8.88 4.76 12 4.76Z"
      />
    </svg>
  )
}

/**
 * The "Continue with Google" action the auth screens share. It is a plain
 * button (not a form submit) because the OAuth flow is a full-page redirect
 * to Supabase/Google, not a request from this form.
 */
export function GoogleSignInButton({
  label,
  onClick,
  loading = false,
  disabled = false,
  className = "",
}: {
  label: string
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-[13.5px] font-semibold text-ink shadow-sm transition-all hover:border-muted hover:bg-canvas active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden="true" /> : <GoogleMark />}
      <span>{label}</span>
    </button>
  )
}
