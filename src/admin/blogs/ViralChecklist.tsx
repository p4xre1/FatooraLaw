import { useState, useMemo } from "react"
import { Zap, CheckCircle, AlertCircle } from "lucide-react"
import { scoreBlog } from "./viralStandards"

export default function ViralChecklist({ post }: { post: { title: string; slug: string; content: string; excerpt: string; seo_title: string; seo_description: string; keywords: string[]; image_url?: string; image_alt?: string } }) {
  const result = useMemo(() => scoreBlog(post), [post])
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left flex items-center justify-between font-bold text-amber-800">
        <span className="flex items-center gap-2"><Zap size={20}/> Viral / SEO Score: <span className={`text-2xl ${result.score >= 80 ? "text-emerald-600" : result.score >= 50 ? "text-amber-600" : "text-red-500"}`}>{result.score}/100</span></span>
        {expanded ? "▲" : "▼"}
      </button>
      {expanded && (
        <div className="mt-4 space-y-2">
          {result.checks.map((c, i) => (
            <div key={i} className={`flex items-center gap-2 text-sm ${c.pass ? "text-emerald-700" : "text-red-600"}`}>
              {c.pass ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
              <span className="font-medium">{c.label}</span>
              <span className="ml-auto text-xs text-gray-500">w={c.weight}</span>
            </div>
          ))}
          <div className="pt-3 border-t text-xs text-amber-800">
            <strong>Viral tips:</strong> Use numbers in title, bold first 90 chars, image at paras 2-3, authoritative external link, share-card 1200×630.
          </div>
        </div>
      )}
    </div>
  )
}
