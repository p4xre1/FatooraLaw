/**
 * Blog Image Input — supports R2 / Supabase / URL with alt
 * Use inside CMS editor form.
 */
export default function BlogImageFields({ value, onChange }: { value: { image_url?: string; image_alt?: string; image_source?: string }; onChange: (v: typeof value) => void }) {
  return (
    <div className="rounded-lg border bg-surface p-4 space-y-3">
      <h3 className="font-bold text-sm">Image / Cover</h3>
      <div className="flex gap-2">
        {(["none", "url", "supabase", "r2"] as const).map((src) => (
          <button key={src} onClick={() => onChange({ ...value, image_source: src })} className={`px-2 py-1 text-xs rounded border ${value.image_source === src ? "bg-blue-600 text-white" : "bg-canvas"}`}>
            {src}
          </button>
        ))}
      </div>
      <input placeholder="Image URL (https://...)" value={value.image_url || ""} onChange={(e) => onChange({ ...value, image_url: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />
      <input placeholder="Alt text (describe image for SEO + accessibility)" value={value.image_alt || ""} onChange={(e) => onChange({ ...value, image_alt: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />
    </div>
  )
}
