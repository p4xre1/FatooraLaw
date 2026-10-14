/**
 * CLIENT-SIDE RATE LIMITER — defense against brute-force / replay
 * Tracks timestamps per action key in memory + sessionStorage.
 */
export class RateLimiter {
  private store = new Map<string, number[]>()

  constructor(private windowMs = 60_000, private maxRequests = 10) {}

  check(action: string): boolean {
    const now = Date.now()
    const history = this.store.get(action) ?? []
    const filtered = history.filter((t) => now - t < this.windowMs)
    if (filtered.length >= this.maxRequests) return false
    filtered.push(now)
    this.store.set(action, filtered)
    return true
  }

  persist(action: string): void {
    try {
      const key = `rate:${action}`
      const arr = JSON.parse(sessionStorage.getItem(key) ?? "[]") as number[]
      arr.push(Date.now())
      sessionStorage.setItem(key, JSON.stringify(arr.filter((t) => Date.now() - t < this.windowMs)))
    } catch (_) {}
  }

  isLimited(action: string): boolean {
    try {
      const key = `rate:${action}`
      const arr = JSON.parse(sessionStorage.getItem(key) ?? "[]") as number[]
      return arr.filter((t) => Date.now() - t < this.windowMs).length >= this.maxRequests
    } catch (_) { return false }
  }
}
