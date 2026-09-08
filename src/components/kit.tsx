import type { ReactNode } from "react"
import { useEffect } from "react"
import { Check, X } from "lucide-react"

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      {children}
    </div>
  )
}

export function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function Btn({
  children, variant = "primary", size = "md", className = "", ...rest
}: {
  variant?: "primary" | "emerald" | "ghost" | "outline" | "danger" | "dark"
  size?: "sm" | "md"
  children: ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles: Record<string, string> = {
    primary: "bg-brand text-white hover:bg-brand-700 shadow-sm",
    emerald: "bg-emerald-brand text-white hover:bg-emerald-700 shadow-sm",
    dark: "bg-navy text-white hover:bg-ink shadow-sm",
    ghost: "text-ink hover:bg-ink/[0.05]",
    outline: "border border-line-strong bg-surface text-ink hover:border-muted",
    danger: "bg-serious text-white hover:brightness-95 shadow-sm",
  }
  const sizes = { sm: "px-2.5 py-1.5 text-[12px]", md: "px-3.5 py-2 text-[13px]" }
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${styles[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

export function IconBtn({ children, className = "", ...rest }: { children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink ${className}`}>
      {children}
    </button>
  )
}

const tone: Record<string, string> = {
  neutral: "bg-canvas text-muted ring-line-strong",
  brand: "bg-brand-50 text-brand-700 ring-brand/20",
  good: "bg-good-50 text-emerald-700 ring-good/20",
  warn: "bg-warn-50 text-warn ring-warn/20",
  serious: "bg-serious-50 text-serious ring-serious/20",
}

export function Badge({ children, tone: tn = "neutral", dot = false }: { children: ReactNode; tone?: keyof typeof tone; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone[tn]}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  )
}

const inputBase =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13.5px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15"

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} resize-none leading-relaxed ${props.className ?? ""}`} />
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${inputBase} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%223%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_0.7rem_center] bg-no-repeat pr-8 ${props.className ?? ""}`}
    />
  )
}

export function Progress({ value, tone: tn = "brand" }: { value: number; tone?: "brand" | "good" | "warn" }) {
  const colors = { brand: "bg-brand", good: "bg-emerald-brand", warn: "bg-warn" }
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas">
      <div className={`h-full rounded-full ${colors[tn]} transition-all`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-brand" : "bg-line-strong"}`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  )
}

export function Checkbox({
  checked, onChange, children, id,
}: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; id?: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 select-none">
      <span className="relative mt-0.5 shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className="grid h-[18px] w-[18px] place-items-center rounded-[5px] border border-line-strong bg-surface transition-colors peer-checked:border-brand peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30"
        >
          <Check className="h-3 w-3 text-white transition-opacity" style={{ opacity: checked ? 1 : 0 }} />
        </span>
      </span>
      <span className="text-[12.5px] leading-relaxed text-muted">{children}</span>
    </label>
  )
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/40 p-4 backdrop-blur-sm" style={{ animation: "mz-fade .15s ease-out" }} onClick={onClose}>
      <div
        className={`flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl ${wide ? "max-w-3xl" : "max-w-md"}`}
        style={{ animation: "mz-pop .18s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
          <IconBtn onClick={onClose}><X className="h-4 w-4" /></IconBtn>
        </header>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

export function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-14 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-canvas text-faint">{icon}</span>
      <p className="text-[13px] text-muted">{text}</p>
    </div>
  )
}

/** Dense data table wrapper */
export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line text-start text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
            {head}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  )
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-4 py-2.5 text-start font-semibold ${className}`}>{children}</th>
}
export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-4 py-3 align-middle ${className}`}>{children}</td>
}
