import type { ReactNode } from "react"
import { AlertCircle, CheckCircle2 } from "lucide-react"

export function FormAlert({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  const styles =
    kind === "error" ? "border-serious/20 bg-serious-50 text-serious" : "border-good/20 bg-good-50 text-emerald-700"
  const Icon = kind === "error" ? AlertCircle : CheckCircle2

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[12.5px] leading-relaxed ${styles}`}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}
