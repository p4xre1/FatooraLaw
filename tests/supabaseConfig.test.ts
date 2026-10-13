import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { expect, it, vi } from "vitest"
import { readSupabaseConfig } from "../src/lib/supabaseConfig"

/** base64url-encoded fake JWT: enough structure for the config checks. */
function jwt(payload: Record<string, unknown>): string {
  const segment = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${segment}.signature`
}

const ANON_KEY = jwt({ iss: "supabase", ref: "abcdefghijklmnop", role: "anon" })
const URL = "https://abcdefghijklmnop.supabase.co"

it("reports both variables missing without inventing values", () => {
  const config = readSupabaseConfig()
  expect(config.configured).toBe(false)
  expect(config.problem?.code).toBe("missing-both")
  expect(config.problem?.variables).toEqual(["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"])
  expect(config.problem?.message).toContain("VITE_SUPABASE_URL")
  expect(config.problem?.message).toContain(".env")
  expect(config.problem?.message).toContain("redémarrez Vite")
})

it("treats blank/whitespace values as missing, not as configured", () => {
  const config = readSupabaseConfig({ url: "   ", anonKey: "\n" })
  expect(config.configured).toBe(false)
  expect(config.problem?.code).toBe("missing-both")
})

it("names the single missing variable", () => {
  const noKey = readSupabaseConfig({ url: URL })
  expect(noKey.problem?.code).toBe("missing-key")
  expect(noKey.problem?.variables).toEqual(["VITE_SUPABASE_ANON_KEY"])

  const noUrl = readSupabaseConfig({ anonKey: ANON_KEY })
  expect(noUrl.problem?.code).toBe("missing-url")
  expect(noUrl.problem?.variables).toEqual(["VITE_SUPABASE_URL"])
})

it("detects the two variables being swapped", () => {
  const config = readSupabaseConfig({ url: ANON_KEY, anonKey: URL })
  expect(config.configured).toBe(false)
  expect(config.problem?.code).toBe("swapped-values")
  expect(config.problem?.message).toContain("inversées")
})

it("rejects the dashboard link pasted as the API URL", () => {
  const config = readSupabaseConfig({ url: "https://supabase.com/dashboard/project/abcdefghijklmnop", anonKey: ANON_KEY })
  expect(config.configured).toBe(false)
  expect(config.problem?.code).toBe("dashboard-url")
  expect(config.problem?.message).toContain("https://<référence>.supabase.co")
})

it("rejects values that are not URLs at all, without echoing them", () => {
  const config = readSupabaseConfig({ url: "fatorati.tech", anonKey: ANON_KEY })
  expect(config.configured).toBe(false)
  expect(config.problem?.code).toBe("invalid-url")
  expect(config.problem?.message).not.toContain("fatorati.tech")
})

it("refuses a service_role key and keeps it out of the message", () => {
  const secret = jwt({ iss: "supabase", ref: "abcdefghijklmnop", role: "service_role" })
  const config = readSupabaseConfig({ url: URL, anonKey: secret })
  expect(config.configured).toBe(false)
  expect(config.problem?.code).toBe("secret-key")
  expect(config.problem?.variables).toEqual(["VITE_SUPABASE_ANON_KEY"])
  expect(config.problem?.message).toContain("service_role")
  expect(config.problem?.message).not.toContain(secret)
})

it("refuses a new-style sb_secret_ key", () => {
  const config = readSupabaseConfig({ url: URL, anonKey: "sb_secret_0123456789" })
  expect(config.configured).toBe(false)
  expect(config.problem?.code).toBe("secret-key")
})

it("accepts a matching URL/anon-key pair", () => {
  const config = readSupabaseConfig({ url: `${URL}/`, anonKey: ` ${ANON_KEY} ` })
  expect(config.configured).toBe(true)
  expect(config.problem).toBeNull()
  expect(config.warning).toBeNull()
  expect(config.url).toBe(URL)
  expect(config.anonKey).toBe(ANON_KEY)
})

it("accepts a publishable key, then warns when URL and key are from different projects", () => {
  const publishable = readSupabaseConfig({ url: URL, anonKey: "sb_publishable_abc123" })
  expect(publishable.configured).toBe(true)
  expect(publishable.warning).toBeNull()

  const otherKey = jwt({ iss: "supabase", ref: "zyxwvutsrqponmlk", role: "anon" })
  const mismatched = readSupabaseConfig({ url: URL, anonKey: otherKey })
  expect(mismatched.configured).toBe(true)
  expect(mismatched.warning).toContain("abcdefghijklmnop")
  expect(mismatched.warning).toContain("zyxwvutsrqponmlk")
})

it("does not emit a console.error on module load when Supabase env vars are unset", async () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  try {
    vi.resetModules()
    await import("../src/lib/supabase")
    expect(errorSpy).not.toHaveBeenCalled()
  } finally {
    errorSpy.mockRestore()
  }
})

it("permits Cloudflare Web Analytics in public/_headers CSP", () => {
  const headers = readFileSync(resolve(process.cwd(), "public/_headers"), "utf8")
  const cspLine = headers.split("\n").find((line) => line.trim().startsWith("Content-Security-Policy:")) ?? ""
  expect(cspLine).toMatch(/script-src[^;]*https:\/\/static\.cloudflareinsights\.com/)
  expect(cspLine).toMatch(/connect-src[^;]*https:\/\/cloudflareinsights\.com/)
})
