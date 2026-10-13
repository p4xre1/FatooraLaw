import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import siteConfiguration from './.figma/make/site.json' with { type: 'json' }
import { NOT_FOUND_PATH, LANDING_PAGES, landingPath } from './src/lib/routes.ts'
import { readSupabaseConfig } from './src/lib/supabaseConfig.ts'
import {
  buildLlmsTxt,
  buildSitemapXml,
  isoDate,
  privatePaths,
  privateTitleFor,
  renderHeadTags,
  renderNoIndexHeadTags,
} from './src/lib/seo.ts'

// Vite config — https://vitejs.dev/config/
export default defineConfig(({ mode, isSsrBuild }) => {
  // .figma/make/deploy-preview passes `--mode development` for cached-preview builds.
  const emitSourcemaps = mode === 'development'

  return {
    base: process.env.FIGMA_PUBLIC_URL ? `${process.env.FIGMA_PUBLIC_URL}/` : '/',
    // Provenance for the setup screen: when the deployed site reports a
    // configuration problem, the operator needs to know *which* build is
    // looking at them and how old it is (see components/SupabaseSetupNotice).
    define: {
      'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
    },
    build: {
      sourcemap: emitSourcemaps ? 'inline' : false,
      minify: !emitSourcemaps,
      // The SSR build (`vite build --ssr src/entry-server.tsx`) has its own
      // single entry and must not inherit the two HTML documents.
      ...(isSsrBuild
        ? {}
        : {
            rollupOptions: {
              // Two documents: the public site (`index.html`, prerendered per
              // route by scripts/prerender.mjs) and the private shell
              // (`admin.html`: empty #root + noindex head, reused for the CMS,
              // the auth screens, the dashboard and 404.html).
              input: {
                index: path.resolve(import.meta.dirname, 'index.html'),
                admin: path.resolve(import.meta.dirname, 'admin.html'),
              },
            },
          }),
    },
    plugins: [
      react(),
      tailwindcss(),
      figmaSiteConfiguration(siteConfiguration),
      figmaSupabaseEnvPlugin(mode, mode === 'development'),
      figmaTurnstileGuard(),
      figmaSeoRoutes({
        siteUrl: siteConfiguration.siteUrl ?? '',
        socialImage: siteConfiguration.openGraph?.image ?? '',
      }),
      figmaErrorOverlayReplay(),
      figmaReactRefreshBoundaryFallback(),
      figmaMakeKitPlugin({ storiesGlob: '/src/**/*.stories.{ts,tsx,js,jsx}' }),
    ],

    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      host: process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0',
      allowedHosts: ['.e2b.app'],
      port: parseInt(process.env.PORT || '5173'), // <-- Changed default to 5173
      strictPort: false, // <-- Changed to false so Vite won't crash if port is taken
      watch: { ignored: ['**/.figma/**'] },
    },
    preview: {
      host: process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0',
      allowedHosts: ['.e2b.app'],
      port: parseInt(process.env.PORT || '5173'), // <-- Changed default to 5173
    },
  }
})

type FigmaSiteConfiguration = {
  title?: string
  description?: string
  language?: string
  /** Canonical origin (no trailing slash), e.g. "https://fatorati.tech". Used to emit <link rel="canonical"> and JSON-LD @id/url fields. */
  siteUrl?: string
  /** Comma-separated meta keywords. Set to "N/A" (or omit) to skip the tag. */
  keywords?: string
  robots?: {
    index?: boolean
  }
  icons?: {
    icon?: string
  }
  openGraph?: {
    image?: string
  }
  /** Drives the site-wide Organization + WebSite JSON-LD (Entity Schema). */
  organization?: {
    name?: string
    /** Full legal/registered name, if different from the display name. */
    legalName?: string
    email?: string
    telephone?: string
    addressLocality?: string
    addressCountry?: string
    /** ISO date (YYYY-MM-DD) the entity/site was established. */
    foundingDate?: string
    /**
     * Other official profile URLs for this entity (LinkedIn, X, Facebook, GitHub…).
     * Only put REAL, owned profile URLs here — fabricated/guessed sameAs links
     * actively mislead search engines about entity identity, so this is left
     * empty (and the tag simply omitted) rather than invented.
     */
    sameAs?: string[]
  }
  analytics?: {
    googleAnalyticsId?: string
  }
  customScripts?: {
    headStart?: string
    headEnd?: string
    bodyStart?: string
    bodyEnd?: string
  }
  accessibility?: {
    addBypassLinks?: boolean
  }
}

/** Applies /.figma/make/site.json to the generated document shell. */
function figmaSiteConfiguration(config: FigmaSiteConfiguration): Plugin {
  function sanitizeHtmlValue(value: string | undefined): string {
    return value?.replace(/[^a-zA-Z0-9_-]/g, '') || ''
  }
  function escapeHtmlText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  function replaceHtmlCommentSlot(html: string, slotName: string, content: string): string {
    return html.replace(`<!-- ${slotName} -->`, content)
  }

  const title = config.title ?? "Figma Make App"
  const description = config.description ?? ''
  const favicon = config.icons?.icon ?? ''
  const socialImage = config.openGraph?.image ?? ''
  const siteUrl = config.siteUrl?.replace(/\/+$/, '') ?? ''
  const keywords = config.keywords?.trim() ?? ''
  const hasKeywords = keywords && keywords.toUpperCase() !== 'N/A'
  const org = config.organization
  const buildDate = new Date().toISOString().slice(0, 10)
  const language = sanitizeHtmlValue(config.language) || 'en'
  const headStart = config.customScripts?.headStart ?? ''
  const headEnd = config.customScripts?.headEnd ?? ''
  const bodyStart = config.customScripts?.bodyStart ?? ''
  const bodyEnd = config.customScripts?.bodyEnd ?? ''
  const robotsTxt = config.robots?.index === false ? 'User-agent: *\nDisallow: /\n' : ''

  return {
    name: 'figma-site-configuration',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!robotsTxt || req.url?.split('?')[0] !== '/robots.txt') return next()

        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(robotsTxt)
      })
    },
    generateBundle() {
      if (!robotsTxt) return

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: robotsTxt,
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const isPrivateShell = ctx.path.split('?')[0].endsWith('admin.html')
        let result = html
        result = replaceHtmlCommentSlot(result, 'figma:lang', language)
        result = replaceHtmlCommentSlot(result, 'figma:head-start', headStart)
        result = replaceHtmlCommentSlot(result, 'figma:head-end', headEnd)
        result = replaceHtmlCommentSlot(result, 'figma:body-start', bodyStart)
        result = replaceHtmlCommentSlot(result, 'figma:body-end', bodyEnd)

        // The route-dependent head (title, description, canonical, Open Graph,
        // per-page JSON-LD) lives between the `figma:route-head-*` markers so
        // scripts/prerender.mjs can rewrite it once per public route. What is
        // injected here is the *fallback* document: the home head for
        // index.html, a noindex head for the private shell (admin.html).
        const routeHead = isPrivateShell
          ? renderNoIndexHeadTags(escapeHtmlText(title))
          : renderHeadTags({
              page: 'home',
              siteUrl,
              socialImage: socialImage || undefined,
              lastmod: buildDate,
            })
        if (result.includes('<!-- figma:route-head-start -->')) {
          result = result.replace(
            /<!-- figma:route-head-start -->[\s\S]*?<!-- figma:route-head-end -->/,
            `<!-- figma:route-head-start -->\n    ${routeHead}\n    <!-- figma:route-head-end -->`,
          )
        }

        const tags: HtmlTagDescriptor[] = []
        if (hasKeywords) {
          tags.push({ tag: 'meta', attrs: { name: 'keywords', content: keywords }, injectTo: 'head' })
        }
        if (org && siteUrl) {
          const orgId = `${siteUrl}/#organization`
          const siteId = `${siteUrl}/#website`
          const organizationNode: Record<string, unknown> = {
            '@type': 'Organization',
            '@id': orgId,
            name: org.name ?? title,
            url: `${siteUrl}/`,
            foundingDate: org.foundingDate,
            email: org.email,
            telephone: org.telephone,
          }
          if (org.legalName) organizationNode.legalName = org.legalName
          if (favicon) organizationNode.logo = { '@type': 'ImageObject', url: `${siteUrl}${favicon}` }
          if (org.addressLocality || org.addressCountry) {
            organizationNode.address = {
              '@type': 'PostalAddress',
              addressLocality: org.addressLocality,
              addressCountry: org.addressCountry,
            }
          }
          if (org.sameAs && org.sameAs.length > 0) organizationNode.sameAs = org.sameAs
          // Strip undefined *and empty* keys: an empty `telephone: ""` in the
          // entity graph is published to every search engine, so an unset
          // contact detail must be absent rather than blank.
          for (const key of Object.keys(organizationNode)) {
            const value = organizationNode[key]
            if (value === undefined || value === null || value === "") delete organizationNode[key]
          }

          const graph = [
            organizationNode,
            {
              '@type': 'WebSite',
              '@id': siteId,
              name: org.name ?? title,
              url: `${siteUrl}/`,
              description: description || undefined,
              inLanguage: language,
              publisher: { '@id': orgId },
              dateModified: buildDate,
            },
          ]
          tags.push({
            tag: 'script',
            attrs: { type: 'application/ld+json' },
            children: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }),
            injectTo: 'head',
          })
        }
        if (config.robots?.index === false) {
          tags.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' }, injectTo: 'head' })
        }
        if (favicon) {
          tags.push({ tag: 'link', attrs: { rel: 'icon', href: favicon }, injectTo: 'head' })
        }
        // Open Graph tags (og:title/og:description/og:url/og:image) are
        // per-route and emitted by renderHeadTags into the route-head block
        // above — never inject a second, relative copy here: two og:image tags
        // (one absolute, one relative) is exactly the kind of duplicate that
        // makes a social preview unreliable.

        // Google Analytics is loaded by src/lib/cookieConsent.ts only after
        // explicit consent. Never emit tracking scripts into the HTML shell.

        if (config.accessibility?.addBypassLinks) {
          tags.push(
            {
              tag: 'style',
              children: `
  .figma-bypass-link {
    position: fixed;
    top: 8px;
    left: 8px;
    z-index: 2147483647;
    transform: translateY(-150%);
    border-radius: 6px;
    background: #111827;
    color: #fff;
    padding: 8px 12px;
    font: 600 14px/1.2 system-ui, sans-serif;
    text-decoration: none;
  }
  .figma-bypass-link:focus {
    transform: translateY(0);
  }
`,
              injectTo: 'head',
            },
            {
              tag: 'a',
              attrs: { class: 'figma-bypass-link', href: '#root' },
              children: 'Skip to content',
              injectTo: 'body-prepend',
            },
          )
        }

        return {
          html: result,
          tags,
        }
      },
    },
  }
}

/**
 * Public Supabase configuration, checked where it is actually consumed.
 *
 * `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are *inlined into the browser
 * bundle at build time*, which is why "the .env looks right" and "the deployed
 * site still says Supabase is not configured" can both be true: the deployed
 * bundle was built somewhere else (a CI runner, Cloudflare Pages, another
 * machine) where the variables were absent. Nothing used to say so — the build
 * succeeded, the site deployed, and only the login screen complained.
 *
 * This plugin closes that gap:
 *   - it validates the pair with the same rules the app uses
 *     (src/lib/supabaseConfig.ts) and prints the verdict on `pnpm dev` and
 *     `pnpm build`, naming the exact variable and the fix;
 *   - it **fails a Cloudflare Pages / opt-in build** that has no usable pair
 *     instead of shipping an authentication-less deployment —
 *     set `ALLOW_UNCONFIGURED_SUPABASE=1` to build anyway (e.g. to preview the
 *     marketing pages), or `REQUIRE_SUPABASE_ENV=1` to demand it in any CI;
 *   - it writes `dist/build-report.json`, so anyone can check a *live*
 *     deployment with one request instead of guessing.
 *
 * See docs/ENVIRONMENT.md for every supported source of these variables.
 */
function figmaSupabaseEnvPlugin(mode: string, isDev: boolean): Plugin {
  let report: ReturnType<typeof readSupabaseConfig> | null = null
  let reportEnv: { url?: string; anonKey?: string } = {}
  let isSsr = false

  function readEnv(): void {
    if (report) return
    // `loadEnv` merges .env / .env.local / .env.[mode] / .env.[mode].local and
    // process.env with exactly the precedence Vite uses to inline VITE_*.
    const env = loadEnv(mode, import.meta.dirname, 'VITE_')
    reportEnv = { url: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY }
    report = readSupabaseConfig(reportEnv)
  }

  /** The project ref (`https://<ref>.supabase.co`), safe to print and to publish. */
  function projectRef(): string | null {
    const url = report?.url
    const match = url ? /^([a-z0-9-]+)\.supabase\.(co|in)$/i.exec(new URL(url).hostname) : null
    return match ? match[1] : null
  }

  function source(): string {
    if (process.env.CF_PAGES === '1') return 'the Cloudflare Pages build environment'
    if (process.env.GITHUB_ACTIONS === 'true') return 'the GitHub Actions build environment'
    if (process.env.CI) return 'a CI build environment'
    return `the ${mode} mode environment (.env / .env.local / process.env)`
  }

  function printReport(): void {
    readEnv()
    const prefix = isDev ? '[supabase:dev]' : '[supabase:build]'
    if (report?.configured) {
      const ref = projectRef()
      // eslint-disable-next-line no-console
      console.log(
        `${prefix} configured from ${source()}: ${report.url}${ref ? ` (project ${ref})` : ''}` +
          (report.warning ? `\n${prefix} warning: ${report.warning}` : ''),
      )
      return
    }
    // eslint-disable-next-line no-console
    console.warn(
      [
        `${prefix} no usable Supabase configuration in ${source()}.`,
        `  The login screen will show "Configuration Supabase requise" and Supabase is disabled.`,
        `  Cause: ${report?.problem?.message ?? 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing.'}`,
        '  Fix, depending on where this build runs:',
        '    • local          → create .env (see .env.example) and restart the dev server;',
        '    • GitHub Actions → Repository → Settings → Secrets and variables → Actions;',
        '    • Cloudflare     → Pages project → Settings → Variables and secrets, then redeploy',
        '                       (set it for BOTH Production and Preview).',
        '  Full list of cases + verification: docs/ENVIRONMENT.md',
      ].join('\n'),
    )
  }

  return {
    name: 'figma-supabase-env',
    configResolved(config) {
      isSsr = Boolean(config.build.ssr)
      // The SSR build shares this configuration but must not duplicate the
      // report (and its output directory is temporary).
      if (isSsr) return
      readEnv()
      printReport()
    },
    buildStart() {
      if (isSsr) return
      readEnv()
      if (report?.configured) return
      if (process.env.ALLOW_UNCONFIGURED_SUPABASE === '1') return

      // A deployment that replaces production must not be built without the
      // variables (that is how the live site ended up unable to sign anyone
      // in). Preview deployments only warn: they cannot authenticate, but
      // failing them would put a red check on every unrelated pull request.
      const onCloudflare = process.env.CF_PAGES === '1'
      const branch = process.env.CF_PAGES_BRANCH ?? ''
      const productionBranch = process.env.CF_PAGES_PRODUCTION_BRANCH ?? 'main'
      const isProductionDeployment = onCloudflare && (branch === '' || branch === productionBranch)
      const strict = isProductionDeployment || process.env.REQUIRE_SUPABASE_ENV === '1'
      const hint =
        'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to this build environment (docs/ENVIRONMENT.md), ' +
        'or pass ALLOW_UNCONFIGURED_SUPABASE=1 to build the marketing pages anyway.'
      if (!strict) {
        if (onCloudflare) {
          // eslint-disable-next-line no-console
          console.warn(
            `[supabase:build] preview deployment of "${branch || 'unknown branch'}" has no usable Supabase configuration: ` +
              'sign-in will not work on this preview. ' +
              hint,
          )
        }
        return
      }
      this.error(
        `Refusing to build a deployable bundle without Supabase: ${report?.problem?.message ?? 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing'} ` +
          `(Cloudflare Pages build of "${branch || productionBranch}" — set the variables for Production and Preview in the Pages project, then redeploy.) ` +
          hint,
      )
    },
    writeBundle(options) {
      if (isSsr) return
      readEnv()
      const outDir = options.dir ?? path.resolve(import.meta.dirname, 'dist')
      const payload = {
        builtAt: new Date().toISOString(),
        mode,
        source: source(),
        commit: process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null,
        supabase: {
          configured: Boolean(report?.configured),
          problemCode: report?.problem?.code ?? null,
          projectRef: projectRef(),
        },
      }
      try {
        writeFileSync(path.join(outDir, 'build-report.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
      } catch {
        // Reporting must never break a build.
      }
    },
  }
}

/**
 * Turns the documented Turnstile/CSP coupling into a build-time warning.
 *
 * `VITE_TURNSTILE_SITE_KEY` loads a script and an iframe from
 * `https://challenges.cloudflare.com`. The production Content-Security Policy
 * in `public/_headers` ships without that origin (deliberately, so the CSP stays
 * tight), so enabling the key without editing `_headers` produces a *silent*
 * production failure: the script is blocked, the token stays empty, and the
 * admin login answers "captcha failed" with nothing in the UI explaining why.
 * Warning at build time is cheap; debugging that from a user report is not.
 */
function figmaTurnstileGuard(): Plugin {
  return {
    name: 'figma-turnstile-guard',
    apply: 'build',
    configResolved(config) {
      if (!process.env.VITE_TURNSTILE_SITE_KEY) return
      let policy = ''
      try {
        // Only real directives count — the Turnstile paragraph in the comment
        // block above them mentions the same origin.
        policy = readFileSync(path.resolve(import.meta.dirname, 'public/_headers'), 'utf-8')
          .split('\n')
          .filter((line) => !line.trimStart().startsWith('#'))
          .join('\n')
      } catch {
        return
      }
      if (policy.includes('challenges.cloudflare.com')) return
      // eslint-disable-next-line no-console
      console.warn(
        '[turnstile] VITE_TURNSTILE_SITE_KEY is set, but public/_headers does not allow https://challenges.cloudflare.com.\n' +
          '  In production the script and iframe will be blocked by the CSP and the admin login will fail silently.\n' +
          '  Add " https://challenges.cloudflare.com" to script-src and a "frame-src https://challenges.cloudflare.com;" directive\n' +
          '  in public/_headers (see SECURITY.md), then rebuild.',
      )
    },
  }
}

/**
 * Routing + SEO artifacts, generated from `src/lib/routes.ts` so the deploy
 * configuration can never drift from the application's real URLs:
 *
 *   - `sitemap.xml`  — every indexable public page (the hand-written version
 *     shipped a single `/` entry, so 11 real pages were invisible to crawlers);
 *   - `llms.txt`     — the same page list rewritten for AI assistants;
 *   - `_redirects`   — explicit `200` rewrites per route (host-independent:
 *     works whether or not the host prefers an extensionless file, a
 *     `.html` file or a directory index), plus the 301s that stop the
 *     generated `.html` mirrors from competing with the clean URLs. There is
 *     deliberately **no** `/*` catch-all any more: it turned every typo into
 *     a `200 OK` copy of the homepage (a soft 404). Unknown paths now fall
 *     through to `404.html`, which Cloudflare Pages serves with a real 404
 *     status while still booting the SPA.
 *   - `404.html` + one document per private route (`/login`, `/dashboard`, …)
 *     — the shell with a `noindex` head and an empty `#root`, so a crawler
 *     (or a curious visitor) never sees the signed-in screens, and the client
 *     never hydrates the public page over a different screen.
 */
function figmaSeoRoutes({ siteUrl, socialImage }: { siteUrl: string; socialImage: string }): Plugin {
  const origin = siteUrl.replace(/\/+$/, '')
  const shellPath = (route: string) => `${route === '/' ? '' : route}/index.html`
  const mirrorPath = (route: string) => `${route === '/' ? 'index' : route.slice(1)}.html`

  // The rendered shells are captured at the end of the HTML transform (hashed
  // asset links included) and written in `writeBundle`, because the HTML
  // documents are not part of `bundle` at `generateBundle` time.
  const shells: { index?: string; admin?: string } = {}
  let isSsrBuild = false

  return {
    name: 'figma-seo-routes',
    apply: 'build',
    configResolved(config) {
      isSsrBuild = Boolean(config.build.ssr)
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const file = ctx.path.split('?')[0]
        if (file.endsWith('admin.html')) shells.admin = html
        else if (file.endsWith('index.html')) shells.index = html
        return html
      },
    },
    writeBundle(options) {
      if (isSsrBuild || !shells.admin) return
      const outDir = options.dir ?? path.resolve(import.meta.dirname, 'dist')
      const headPattern = /<!-- figma:route-head-start -->[\s\S]*?<!-- figma:route-head-end -->/

      const write = (fileName: string, source: string) => {
        const target = path.join(outDir, fileName)
        mkdirSync(path.dirname(target), { recursive: true })
        writeFileSync(target, source, 'utf-8')
      }

      /** The private shell with its own noindex head. */
      const documentFor = (path: string) =>
        shells.admin!.includes('<!-- figma:route-head-start -->')
          ? shells.admin!.replace(
              headPattern,
              `<!-- figma:route-head-start -->\n    ${renderNoIndexHeadTags(privateTitleFor(path))}\n    <!-- figma:route-head-end -->`,
            )
          : shells.admin!

      // 1. One document per private route + 404.html, so no crawler (and no
      //    visitor) can ever reach a signed-in screen through a public URL.
      for (const path of [NOT_FOUND_PATH, ...privatePaths()]) {
        const html = documentFor(path)
        write(shellPath(path), html)
        write(mirrorPath(path), html)
      }

      // 2. Sitemap + llms.txt, generated from the same page list as the app.
      const lastmod = isoDate()
      write('sitemap.xml', buildSitemapXml(origin, lastmod))
      write('llms.txt', buildLlmsTxt(origin))

      // 3. Host-independent routing rules (see the doc comment above).
      const publicRoutes = LANDING_PAGES.map(landingPath)
      const rules = [
        '# Generated by vite.config.ts (figma-seo-routes) from src/lib/routes.ts.',
        '# Do not hand-edit: add a page to src/lib/routes.ts and rebuild instead.',
        '',
        '# Every public page is a real, prerendered document; rewrite it explicitly',
        '# so the same URL resolves identically on any static host.',
        ...publicRoutes.filter((route) => route !== '/').map((route) => `${route}  ${shellPath(route)}  200`),
        '',
        '# Private screens keep their own document (empty #root + noindex head).',
        ...privatePaths().map((route) => `${route}  ${shellPath(route)}  200`),
        '# The CMS is client-routed under /admin: it only ever needs the shell.',
        '/admin/*  /admin.html  200',
        '',
        '# Same document, one canonical URL: keep the .html mirrors out of results.',
        ...[...privatePaths(), ...publicRoutes].map((route) => `${mirrorPath(route)}  ${route}  301`),
        '',
        '# Unknown paths are intentionally NOT caught here: the host serves',
        '# 404.html with a real 404 status, and that document boots the SPA so the',
        '# in-app not-found screen still renders (no more soft 404s).',
        '',
      ]
      write('_redirects', rules.join('\n'))

      // 4. The route list for scripts/prerender.mjs (removed again by it).
      write(
        'seo-routes.json',
        JSON.stringify({ origin, socialImage: socialImage || null, routes: publicRoutes }, null, 2),
      )
    },
  }
}

/**
 * Replay the most recent build error to clients that connect after
 * it was first broadcast. Vite buffers an error payload only while
 * no clients are connected and clears the buffer on the first
 * reconnect (see `bufferedMessage` in `createWebSocketServer`), so
 * if the preview iframe reloads after Vite already delivered an
 * error to a live socket, the new socket misses the payload and
 * the overlay stays hidden even though the build is still broken.
 * We intercept `ws.send` to remember the latest error and replay
 * it on every new connection; the cache clears on a successful
 * `update` or `full-reload` so a stale overlay can't survive a
 * fixed build.
 */
function figmaErrorOverlayReplay(): Plugin {
  return {
    name: 'figma-error-overlay-replay',
    apply: 'serve',
    configureServer(server) {
      let lastError: object | null = null

      const origSend = server.ws.send.bind(server.ws) as (...args: any[]) => void
      server.ws.send = ((...args: any[]) => {
        const payload = args[0]
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const type = (payload as { type?: string }).type
          if (type === 'error') {
            lastError = payload as object
          } else if (type === 'update' || type === 'full-reload') {
            lastError = null
          }
        }
        return origSend(...args)
      }) as typeof server.ws.send

      server.ws.on('connection', (socket) => {
        if (lastError !== null) {
          socket.send(JSON.stringify(lastError))
        }
      })
    },
  }
}

/**
 * Reload when a module that previously defined a React Refresh boundary stops
 * defining one. This happens when an agent moves a component into a new file
 * and replaces the old module with a re-export:
 *
 *   export { default } from './app/App'
 *
 * Vite otherwise accepts the update using the previous module's HMR boundary,
 * but the re-export-only transform no longer registers a replacement for the
 * mounted component family. React reports a successful refresh while leaving
 * the old tree mounted until the page is reloaded.
 */
function figmaReactRefreshBoundaryFallback(): Plugin {
  const hadRefreshBoundary = new Map<string, boolean>()
  let sendFullReload: (() => void) | null = null

  return {
    name: 'figma-react-refresh-boundary-fallback',
    apply: 'serve',
    enforce: 'post',
    configureServer(server) {
      sendFullReload = () => server.ws.send({ type: 'full-reload', path: '*' })
    },
    transform(code, id) {
      if (!/\.[jt]sx?(?:\?|$)/.test(id) || id.includes('/node_modules/')) return null

      const moduleId = id.split('?')[0] ?? id
      const hasRefreshBoundary = code.includes('registerExportsForReactRefresh')
      const previousHadRefreshBoundary = hadRefreshBoundary.get(moduleId)
      hadRefreshBoundary.set(moduleId, hasRefreshBoundary)

      if (previousHadRefreshBoundary && !hasRefreshBoundary) {
        queueMicrotask(() => sendFullReload?.())
      }

      return null
    },
  }
}

/**
 * Serves a blank render-target page at /.figma/make/kit.html that
 * the Figma preview script drives directly. The page exposes a
 * registry of every file matching `storiesGlob` on
 * window.__FIGMA__.stories so the design surface can dynamically
 * import + mount each entry into its own grid view.
 *
 * Dev-only: `apply: 'serve'` gates the plugin to `vite dev`. Prod
 * builds (`vite build`) skip it entirely so the route doesn't leak
 * into shipped bundles.
 */
function figmaMakeKitPlugin(options: { storiesGlob: string | string[] }): Plugin {
  const storiesGlob = Array.isArray(options.storiesGlob) ? options.storiesGlob : [options.storiesGlob]
  const ROUTE = '/.figma/make/kit.html'
  const VIRTUAL_ID = 'virtual:figma-stories'
  const RESOLVED_ID = '\0' + VIRTUAL_ID
  const STORIES_MODULE = `export const stories = import.meta.glob(${JSON.stringify(storiesGlob)})`
  const HTML_BOOTSTRAP = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
<div id="figma-make-kit-root"></div>
<script type="module">
  import { stories } from 'virtual:figma-stories'
  window.__FIGMA__ = Object.assign(window.__FIGMA__ ?? {}, { stories })
  window.dispatchEvent(new CustomEvent('figma.ready'))
</script>
</body>
</html>`

  return {
    name: 'figma-make-kit',
    apply: 'serve',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
      return null
    },
    load(id) {
      if (id !== RESOLVED_ID) return null
      return STORIES_MODULE
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (url.split('?')[0] !== ROUTE) return next()

        try {
          res.setHeader('Content-Type', 'text/html')
          res.end(await server.transformIndexHtml(url, HTML_BOOTSTRAP))
        } catch (err) {
          next(err as Error)
        }
      })
    },
  }
}
