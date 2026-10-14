/**
 * CMS Content Improvement (تحسين المحتوى)
 * SEO + Viral scoring + recommendations for blog / pages
 */
import { useState, useMemo } from "react"
import { Sparkles, CheckCircle, AlertCircle, Lightbulb } from "lucide-react"
import { scoreBlog } from "../blogs/viralStandards"

export default function ContentImprovement() {
  const [post, setPost] = useState({ title: "", slug: "", content: "", excerpt: "", seo_title: "", seo_description: "", keywords: [""], image_url: "", image_alt: "" })
  const result = useMemo(() => scoreBlog({ ...post, image_url: post.image_url || undefined, image_alt: post.image_alt || undefined }), [post])

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl" style={{ textAlign: "right" }}>
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2 justify-end"><Sparkles /> تحسين المحتوى / Content Improvement</h1>
      <p className="text-xs text-gray-500 mb-4">Score 0-100 · Weight checks · Viral tips · SEO meta optimization</p>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="font-bold text-sm mb-2">Input</h3>
          <input value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} placeholder="Title (40-70 chars best)" className="w-full px-2 py-1 border rounded text-sm mb-2" />
          <input value={post.slug} onChange={(e) => setPost({ ...post, slug: e.target.value })} placeholder="Slug" className="w-full px-2 py-1 border rounded text-sm mb-2" />
          <textarea value={post.content} onChange={(e) => setPost({ ...post, content: e.target.value })} rows={4} placeholder="Content (min 1000 chars for score)" className="w-full px-2 py-1 border rounded text-sm resize-none" />
          <input value={post.excerpt} onChange={(e) => setPost({ ...post, excerpt: e.target.value })} placeholder="Excerpt (120-160 chars)" className="w-full px-2 py-1 border rounded text-sm mb-2" />
          <input value={post.seo_title} onChange={(e) => setPost({ ...post, seo_title: e.target.value })} placeholder="SEO Title (40-60 chars)" className="w-full px-2 py-1 border rounded text-sm mb-2" />
          <input value={post.seo_description} onChange={(e) => setPost({ ...post, seo_description: e.target.value })} placeholder="SEO Description (120-155 chars)" className="w-full px-2 py-1 border rounded text-sm mb-2" />
          <input value={post.keywords.join(", ")} onChange={(e) => setPost({ ...post, keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Keywords (3-7)" className="w-full px-2 py-1 border rounded text-sm mb-2" />
          <input value={post.image_url} onChange={(e) => setPost({ ...post, image_url: e.target.value })} placeholder="Image URL (optional)" className="w-full px-2 py-1 border rounded text-sm" />
          <input value={post.image_alt} onChange={(e) => setPost({ ...post, image_alt: e.target.value })} placeholder="Image Alt (5+ chars)" className="w-full px-2 py-1 border rounded text-sm" />
        </div>

        <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-amber-100 p-4 shadow-sm">
          <h3 className="font-bold text-lg mb-2">Score: <span className={result.score >= 80 ? "text-emerald-600" : result.score >= 50 ? "text-amber-600" : "text-red-500"}>{result.score}/100</span></h3>
          <div className="space-y-1 mb-3">
            {result.checks.map((c, i) => (
              <div key={i} className={`flex items-center gap-2 text-sm ${c.pass ? "text-emerald-700" : "text-red-600"}`}>
                {c.pass ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
                <span className="font-medium">{c.label}</span>
                <span className="ml-auto text-xs text-gray-500">w={c.weight}</span>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-lg p-3 text-xs leading-relaxed border">
            <strong>Viral Tips (المحتوى الفيروسي):</strong><br/>
            • Use numbers in title (7 Secrets...)<br/>
            • Bold first 90 chars<br/>
            • H2/H3 every 300-400 words<br/>
            • Image between paras 2-3<br/>
            • Authoritative external link<br/>
            • CTA at end (subscribe / share)<br/>
            • Share-card 1200×630 with text overlay<br/>
            • Post Thu-Fri 9-11am
          </div>
        </div>
      </div>
    </div>
  )
}
