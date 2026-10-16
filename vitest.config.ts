import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  // `envDir: false` — do not read `.env` / `.env.local` during tests.
  //
  // Without this, the suite's result depends on whether the person running it
  // happens to have a local `.env`: `VITE_SUPABASE_*` gets inlined, the app
  // takes its *configured* code path, and tests written against the
  // unconfigured build (the plan strip, the activation ledger, the local
  // workspace notice) start failing — on a developer's machine only, which is
  // the worst place for a red suite to be reproducible. The repo's own docs
  // tell you to create `.env` to run the app, so this fired for anybody who
  // followed them.
  //
  // A test that needs the configured path is expected to say so explicitly by
  // mocking `src/lib/supabase` (see tests/activationCodeIssuance.test.tsx),
  // which is precise about which functions are stubbed. Reading a real `.env`
  // was never that: it configured tests by accident.
  envDir: false,
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
})
