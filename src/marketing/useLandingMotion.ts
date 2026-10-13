import { useEffect, useRef } from "react"

/** Progressive enhancement, scoped to the public page. Content is visible even
 * without JavaScript/IntersectionObserver; reduced motion never animates it.
 */
export default function useLandingMotion(page: string) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = root.current
    if (!container) return
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    let observer: IntersectionObserver | undefined
    const targets = Array.from(container.querySelectorAll<HTMLElement>("main > section, .landing-feature-card, .landing-resource-card"))

    function configure() {
      observer?.disconnect()
      observer = undefined
      container!.dataset.motion = media?.matches ? "reduced" : "full"
      if (media?.matches || typeof IntersectionObserver === "undefined") return
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const target = entry.target as HTMLElement
          target.classList.add("landing-revealed")
          observer?.unobserve(target)
        }
      }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" })
      targets.forEach((target, index) => {
        // One-time reveals only: no hidden/offscreen placeholder state.
        if (target.classList.contains("landing-revealed")) return
        target.style.setProperty("--landing-reveal-delay", `${(index % 3) * 60}ms`)
        observer!.observe(target)
      })
    }

    configure()
    media?.addEventListener?.("change", configure)
    return () => {
      observer?.disconnect()
      media?.removeEventListener?.("change", configure)
    }
  }, [page])

  return root
}
