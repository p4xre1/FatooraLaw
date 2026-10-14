/**
 * CSRF TOKEN — crypto-random + session-bound
 * Use before any CMS mutation (update/post/delete) to prevent replay/cross-site attacks.
 */
export function generateCsrfToken(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr))
}

export function storeCsrf(sessionKey = "csrf_token"): string {
  const token = generateCsrfToken()
  try { sessionStorage.setItem(sessionKey, token) } catch (_) {}
  return token
}

export function getCsrf(sessionKey = "csrf_token"): string | null {
  try { return sessionStorage.getItem(sessionKey) } catch (_) { return null }
}

export function verifyCsrf(token: string, sessionKey = "csrf_token"): boolean {
  return token === getCsrf(sessionKey)
}
