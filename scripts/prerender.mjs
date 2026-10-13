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
// page's own title/description/canonical/hreflang/Open Graph/JSON-LD, sets the
// document language (`<html lang dir>`) and injects the markup between the
// `figma:prerender-*` markers inside #root. The client then hydrates over it,
// so visitors get instant content and crawlers get a real document.
//
// One document per page **per locale** (`/pricing`, `/ar/pricing`,
// `/en/pricing`): `hreflang` only works when each language has its own URL, so
// the localized pages are real files rather than a client-side swap.
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
/** The opening `<html …>` tag, rewritten per document (lang + dir). */
const HTML_TAG_PATTERN = /^<html\b[^>]*>/m
const PRERENDER_SLOT = "<!-- figma:prerender-start -->"

function writeRouteDocument(filePath, html) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, html, "utf-8")
}

/**
 * Break the React markup onto short lines. Some GEO crawlers and browser
 * extensions truncate a single multi-dozen-kilobyte line and then report the
 * page as "83 words, H1 missing" even though the bytes are in the file.
 * Breaking only on tag boundaries keeps the HTML and the JSON-LD strings valid.
 */
function breakHtmlLines(html) {
  // Tag boundaries only. Do not wrap mid-line: a newline inside a JSON-LD
  // string would make the schema invalid. Pretty-print JSON-LD first.
  return html.replace(/></g, ">\n<")
}

function prettyJsonLd(html) {
  return html.replace(
    /<script\b([^>]*\btype="application\/ld\+json"[^>]*)>([\s\S]*?)<\/script>/gi,
    (full, attrs, body) => {
      try {
        const pretty = JSON.stringify(JSON.parse(body.trim()), null, 2)
        return `<script${attrs}>\n${pretty}\n</script>`
      } catch {
        return full
      }
    },
  )
}

function visibleWords(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
  return text.split(/\s+/).filter(Boolean).length
}

function assertCrawlable(route, html, prefix = "") {
  const problems = []
  const h1s = html.match(/<h1\b/g) ?? []
  if (h1s.length !== 1) problems.push(`expected 1 <h1>, found ${h1s.length}`)
  if (!html.includes("<blockquote")) problems.push("missing <blockquote>")
  // The links must stay inside the language tree being rendered: an Arabic
  // document that sends readers to the French /about is a broken hreflang
  // graph even though every tag is present.
  if (!html.includes(`href="${prefix}/about"`)) problems.push(`missing ${prefix}/about link`)
  if (!html.includes(`href="${prefix}/contact"`)) problems.push(`missing ${prefix}/contact link`)
  if (!/"(FAQPage|HowTo|Product|Article)"/.test(html) && !html.includes("FAQPage")) problems.push("missing content schema")
  if (!html.includes("sameAs")) problems.push("missing sameAs")
  const words = visibleWords(html)
  if (words < 450) problems.push(`only ${words} server-rendered words`)
  const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]))
  let previous = 0
  for (const level of levels) {
    if (previous && level > previous + 1) {
      problems.push(`h${level} skips a level after h${previous}`)
      break
    }
    previous = level
  }
  const longest = html.split("\n").reduce((max, line) => Math.max(max, line.length), 0)
  if (longest > 2000) problems.push(`a line is ${longest} characters; a truncating crawler will miss the rest of it`)
  if (problems.length) throw new Error(`${route} is not GEO-ready: ${problems.join("; ")}`)
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
  for (const entry of routes) {
    // Older builds wrote plain path strings; accept both so a stale manifest
    // can never crash the build.
    const route = typeof entry === "string" ? entry : entry.path
    const htmlLang = typeof entry === "string" ? "fr" : entry.htmlLang
    const dir = typeof entry === "string" ? "ltr" : entry.dir
    // Which language tree this document belongs to ("" for the unprefixed French pages).
    const prefix = typeof entry === "string" || !entry.locale || entry.locale === "fr" ? "" : `/${entry.locale}`

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

    const document = breakHtmlLines(prettyJsonLd(shell
      // The shell ships one language (`<html lang="fr">`); every localized
      // document has to declare its own, plus its direction.
      .replace(HTML_TAG_PATTERN, `<html lang="${htmlLang}" dir="${dir}">`)
      .replace(HEAD_PATTERN, `<!-- figma:route-head-start -->\n    ${head}\n    <!-- figma:route-head-end -->`)
      .replace(PRERENDER_SLOT, `${PRERENDER_SLOT}${html}`)))
    assertCrawlable(route, document, prefix)

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
    console.log(`[prerender] ${route} [${htmlLang}] → ${document.length.toLocaleString()} chars`)
  }

  console.log(`[prerender] Prerendered ${written}/${routes.length} public route(s).`)
}

main()
  .catch((err) => {
    console.error("[prerender] Failed — refusing to ship a client-only shell.", err)
    process.exitCode = 1
  })
  .finally(() => {
    // Build-time tools only: never part of the deployed site.
    rmSync(ssrDir, { recursive: true, force: true })
    rmSync(routesFile, { force: true })
  })
