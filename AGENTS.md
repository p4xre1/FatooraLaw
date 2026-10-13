# figma-make-app

React + Vite + Tailwind CSS project running inside Figma Make.

## Development Server

A Vite development server is **already running** on `$PORT` (default 8443). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` plus the self-hosted fonts and mounts the app into the `#root` element
- `src/App.tsx` - Primary application component; renders the screen that matches the current URL (public page, auth screen, dashboard module or not-found)
- `src/lib/routes.ts` - **the** URL contract (public pages, auth paths, module paths, locale-aware path helpers). Add a page here first; the sitemap, `llms.txt`, `_redirects` and the prerendered documents are generated from it
- `src/lib/locales.ts` - **the** language contract (language + region pairs, URL prefix, direction, `hreflang`/OG codes). Add a language here first; routes, head tags, the sitemap, `_redirects` and `_headers` are derived from it
- `src/lib/localeContext.tsx` - `LocaleProvider` / `useLocaleHref()`, so a component renders internal links in the language of the page it is on
- `src/lib/router.ts` - small history router (`useRoutePath`, `navigate`, `onInternalLinkClick`)
- `src/lib/seo.ts` - per-route titles/descriptions, sitemap/`llms.txt` builders, `<head>` application
- `src/lib/contact.ts` - public contact details, read from `.figma/make/site.json` (single source; placeholders refused)
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import (no external font/CDN import — fonts are bundled)
- `index.html` / `admin.html` - Vite HTML shells: public (prerendered per route) and private (`noindex`, empty `#root`)
- `scripts/prerender.mjs` - post-build step that writes one real document per public route
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration with React, Tailwind CSS v4, Figma Make plugins, the Supabase/Turnstile build guards, the generated SEO artifacts and the `@` alias for `src`
- `.mise.toml` - Toolchain versions for Node.js and pnpm

## URLs and routing rules

- **Never add a `#fragment` link.** Every screen has a real path; sections are
  pages (`/features`, not `/#features`). In-page scroll targets travel in
  `history.state` (`navigate(path, { state: { focus: id } })`).
- Keep `src/lib/routes.ts` as the only place that knows a path: components,
  the deploy config and the tests all read from it.
- **Every public page exists once per language** (`/pricing`, `/ar/pricing`,
  `/en/pricing`). The default locale (French) is unprefixed; the URL decides the
  language — never component state — because `hreflang` requires one URL per
  language. Build internal links with `useLocaleHref()` and switch language with
  `navigate(localizedLandingPath(page, next))`. Adding a language = one entry in
  `src/lib/locales.ts` + its copy in `PAGE_COPY` (`src/lib/seo.ts`) + its
  dictionary in `src/marketing/Landing.tsx`. Auth screens and the signed-in app
  stay French-only and unprefixed; `/ar/login` must remain an unknown path.
- Private screens must stay `noindex`: the build writes them a `noindex`
  document, `public/_headers` sends `X-Robots-Tag`, and `App.tsx` applies
  `applyNoIndexHead`. Add any new private path to `privatePaths()` too.
- Every localized document must keep the same `hreflang` set in every direction
  (all languages + `x-default`, itself included): the prerenderer fails the
  build when a language tree links out of itself, and `tests/i18n.test.tsx`
  verifies the cluster. See `docs/SEO_GEO_AIO_SXO.md` §6 for the full contract.
- Environment variables: `VITE_*` values are inlined **at build time**. Never
  assume a runtime variable reaches the browser. See `docs/ENVIRONMENT.md`.

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/index.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/index.css`. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.
