// Post-build step: writes one real, static HTML document per public route.
//
// Why this exists (and why it is no longer optional): a client-rendered SPA
// serves the *same* shell to every URL, which means `https://fatorati.tech/features`
// and `https://fatorati.tech/` used to be byte-identical documents carrying
// `canonical: https://fatorati.tech/`. Crawlers therefore saw fourteen URLs
// claiming to be the homepage, and crawlers that do not execute JavaScript
// (most AI and social bots) saw an empty <div id="root">.
//
// This script renders each public page with the real component tree
// (`src/entry-server.tsx`), replaces the `figma:route-head-*` block with that
// page's own title/description/canonical/Open Graph/JSON-LD, and injects the
// markup between the `figma:prerender-*` markers inside #root. The client then
// hydrates over it, so visitors get instant content and crawlers get a real
// document.
//
// Run automatically as part of `pnpm build` — see package.json:
//   vite build && vite build --ssr src/entry-server.tsx --outDir dist-ssr && node scripts/prerender.mjs
//
// Safe to fail: if anything goes wrong, the client-rendered SPA still works
// exactly as before, so a prerender failure never breaks the deployed site.

import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import { pathToFileURL } from "node:url"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const clientDir = path.join(root, "dist")
const ssrDir = path.join(root, "dist-ssr")
const ssrEntry = path.join(ssrDir, "entry-server.js")
const indexPath = path.join(clientDir, "index.html")
const routesFile = path.join(clientDir, "seo-routes.json")
const HEAD_PATTERN = /<!-- figma:route-head-start -->[\s\S]*?<!-- figma:route-head-end -->/
const PRERENDER_SLOT = "<!-- figma:prerender-start -->"

function writeRouteDocument(filePath, html) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, html, "utf-8")
}

async function main() {
  if (!existsSync(ssrEntry)) {
    console.warn(`[prerender] SSR bundle not found at ${ssrEntry} — skipping, shipping client-only render.`)
    return
  }
  if (!existsSync(indexPath)) {
    console.warn(`[prerender] ${indexPath} not found — skipping.`)
    return
  }
  if (!existsSync(routesFile)) {
    console.warn(`[prerender] ${routesFile} not found — skipping (the Vite build emits it).`)
    return
  }

  const { origin, socialImage, routes } = JSON.parse(readFileSync(routesFile, "utf-8"))
  const { renderRoute } = await import(pathToFileURL(ssrEntry).href)
  const shell = readFileSync(indexPath, "utf-8")

  if (!shell.includes(PRERENDER_SLOT) || !HEAD_PATTERN.test(shell)) {
    console.warn("[prerender] index.html is missing the figma:route-head/figma:prerender markers — skipping.")
    return
  }

  let written = 0
  for (const route of routes) {
    let html
    let head
    try {
      const rendered = renderRoute(route, origin, socialImage ?? undefined)
      html = rendered.html
      head = rendered.head
    } catch (error) {
      console.error(`[prerender] ${route} failed to render — leaving the client-rendered document in place.`, error)
      continue
    }

    const document = shell
      .replace(HEAD_PATTERN, `<!-- figma:route-head-start -->\n    ${head}\n    <!-- figma:route-head-end -->`)
      .replace(PRERENDER_SLOT, `${PRERENDER_SLOT}${html}`)

    if (route === "/") {
      writeFileSync(indexPath, document, "utf-8")
    } else {
      // Both shapes: hosts differ on whether `/features` resolves to
      // `features.html` or `features/index.html`, and the generated
      // `_redirects` pins the canonical one either way.
      writeRouteDocument(path.join(clientDir, route.slice(1), "index.html"), document)
      writeRouteDocument(path.join(clientDir, `${route.slice(1)}.html`), document)
    }
    written += 1
    console.log(`[prerender] ${route} → ${document.length.toLocaleString()} chars`)
  }

  console.log(`[prerender] Prerendered ${written}/${routes.length} public route(s).`)
}

main()
  .catch((err) => {
    console.error("[prerender] Failed — shipping client-only render instead.", err)
  })
  .finally(() => {
    // Build-time tools only: never part of the deployed site.
    rmSync(ssrDir, { recursive: true, force: true })
    rmSync(routesFile, { force: true })
  })
