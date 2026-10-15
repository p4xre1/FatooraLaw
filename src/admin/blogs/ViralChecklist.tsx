import { useMemo, useState } from "react"
import { AlertCircle, CheckCircle, ChevronDown, ChevronUp, Monitor, Smartphone, Zap } from "lucide-react"
import { auditBlog, AUDIT_BAND_CLASS, AUDIT_BAND_LABEL, type AuditInput } from "./viralStandards"

/**
 * The in-editor SEO audit: a /100 score, every standard as a pass/fail line
 * with its fix, and a Google result preview (desktop + mobile) fed by the same
 * fields the writer is editing — so what they tune is what searchers see.
 * Arabic-first, matching the CMS UI.
 */
export default function ViralChecklist({ post }: { post: AuditInput }) {
  const result = useMemo(() => auditBlog(post), [post])
  const [expanded, setExpanded] = useState(true)
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")
  const failing = result.checks.filter((check) => !check.pass).length

  const previewTitle = (post.seo_title.trim() || post.title || "عنوان المقال سيظهر هنا بشكل محاكي...").slice(0, 70)
  const previewDescription = (post.seo_description.trim() || "وصف الميتا الخاص بالمقال سيظهر هنا في محرك البحث ليصف محتوى الصفحة...").slice(0, 170)
  const host = (post.siteHost ?? "fatorati.tech").replace(/^https?:\/\//, "")
  const breadcrumb = `${host} › blog › ${post.slug || "article-title"}`

  return (
    <div className="rounded-xl border border-line bg-canvas/60 p-4 sm:p-5">
      <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="flex w-full items-center justify-between gap-3 text-start">
        <span className="flex items-center gap-2 text-[13px] font-bold text-ink">
          <Zap className="h-4 w-4 text-amber-500" aria-hidden="true" />
          تدقيق السيو الشامل (SEO Audit)
          <span className="text-[11px] font-medium text-muted">فحص التوافق مع معايير محركات البحث ومعاينة Google</span>
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Score */}
          <div className="flex flex-wrap items-center gap-3">
            <div className={`text-3xl font-bold ${AUDIT_BAND_CLASS[result.band]}`}>
              {result.score} / 100
              <span className="ms-2 text-sm font-semibold">{AUDIT_BAND_LABEL[result.band]}</span>
            </div>
            <div className="flex gap-2 text-[11px] font-semibold">
              <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-red-600">تنبيهات ({failing})</span>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-700">ناجح ({result.checks.length - failing})</span>
              <span className="rounded-full bg-canvas px-2.5 py-1 text-muted">الكلمات: {result.counts.words} · عناوين: {result.counts.headings} · أسئلة: {result.counts.questionHeadings} · مصادر: {result.counts.externalSources} · اقتباسات: {result.counts.quotes}</span>
            </div>
          </div>

          {/* Google preview */}
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[12px] font-bold text-ink">معاينة النتيجة في Google</p>
              <div className="flex gap-1" role="tablist" aria-label="جهاز المعاينة">
                <button type="button" role="tab" aria-selected={device === "desktop"} onClick={() => setDevice("desktop")} className={`rounded-md border px-2 py-1 ${device === "desktop" ? "border-brand bg-brand-50 text-brand-700" : "border-line text-muted"}`}><Monitor className="h-3.5 w-3.5" aria-hidden="true" /></button>
                <button type="button" role="tab" aria-selected={device === "mobile"} onClick={() => setDevice("mobile")} className={`rounded-md border px-2 py-1 ${device === "mobile" ? "border-brand bg-brand-50 text-brand-700" : "border-line text-muted"}`}><Smartphone className="h-3.5 w-3.5" aria-hidden="true" /></button>
              </div>
            </div>
            <div dir="ltr" className={`mx-auto rounded-lg border border-line/60 bg-surface p-3 ${device === "mobile" ? "max-w-[360px]" : ""}`} style={{ fontFamily: "Arial, sans-serif" }}>
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-[11px] font-bold text-white">F</span>
                <div className="text-[12px] leading-tight text-[#202124]">
                  <p className="font-medium">{host}</p>
                  <p className="text-[#4d5156]">{breadcrumb}</p>
                </div>
              </div>
              <p className="mt-1.5 text-[18px] leading-snug text-[#1a0dab]">{previewTitle}</p>
              <p className="mt-1 text-[13px] leading-snug text-[#4d5156]">{device === "mobile" ? previewDescription.slice(0, 120) : previewDescription}</p>
            </div>
          </div>

          {/* Checks */}
          <div>
            <p className="mb-2 text-[12px] font-bold text-ink">تصفية النتائج: الكل ({result.checks.length}) · تنبيهات ({failing}) · ناجح ({result.checks.length - failing})</p>
            <ul className="space-y-2">
              {result.checks.map((check) => (
                <li key={check.id} className={`rounded-lg border px-3 py-2.5 ${check.pass ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/30 bg-warn-500/5"}`}>
                  <div className="flex items-start gap-2 text-[13px]">
                    {check.pass ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />}
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold ${check.pass ? "text-emerald-800" : "text-ink"}`}>{check.label}</p>
                      {!check.pass && <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{check.advice}</p>}
                    </div>
                    <span className="shrink-0 text-[10px] text-faint">{check.weight}pts</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
