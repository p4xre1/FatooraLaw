/// <reference types="vite/client" />

/**
 * Build provenance injected by vite.config.ts (`define`). Optional: the test
 * runner uses vitest.config.ts, so it stays undefined there.
 */
interface ImportMetaEnv {
  readonly VITE_BUILD_TIME?: string
}
