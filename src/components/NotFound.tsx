import { useEffect } from "react"
import { ArrowLeft, Compass } from "lucide-react"
import { applyNoIndexHead } from "../lib/seo"
import { navigate, onInternalLinkClick, useRoutePath } from "../lib/router"
import { Logo } from "./nav"

/**
 * Shown for any path that is not a page: `/404` (served by the host with a
 * real 404 status — see public/_headers and the generated `_redirects`), a
 * typo, or a link that has been retired.
 *
 * Why it matters for SEO: before this existed, an unknown path silently
 * rendered the homepage while the URL stayed wrong — a "soft 404" that search
 * engines and AI crawlers index as duplicate content. This screen restores a
 * clear signal (noindex head, a real `<h1>`, links back to the real pages) and
 * gives the visitor a way out.
 */
export default function NotFound({ onHome }: { onHome?: () => void }) {
  const path = useRoutePath()
  useEffect(() => {
    applyNoIndexHead("Page introuvable (404) | Fatorati")
  }, [path])

  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-6">
      <div className="w-full max-w-lg space-y-5 text-center">
        <div className="flex justify-center"><Logo size={34} /></div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700">
          <Compass className="h-3.5 w-3.5" /> Erreur 404
        </span>
        <h1 className="text-[26px] font-extrabold tracking-tight text-ink">Cette page n'existe pas</h1>
        <p className="text-sm leading-relaxed text-muted">
          Le lien est peut-être incomplet ou la page a été déplacée. Voici les pages les plus utiles :
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {["features", "assistant", "pricing", "faq", "contact", "blog"].map((section) => (
            <a
              key={section}
              href={`/${section}`}
              onClick={onInternalLinkClick}
              className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
            >
              {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
            </a>
          ))}
        </div>
        <button
          type="button"
          onClick={() => (onHome ? onHome() : navigate("/"))}
          className="mx-auto inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
        </button>
      </div>
    </div>
  )
}

const SECTION_LABELS = {
  features: "Fonctionnalités",
  assistant: "Assistant",
  pricing: "Tarifs",
  faq: "FAQ",
  contact: "Contact",
  blog: "Ressources",
} as const
