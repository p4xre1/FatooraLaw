/**
 * CMS SECURITY CORE CONTROL & MONITORING
 * Tracks admin actions, IP/session info, access attempts, and anomalies.
 * Stores in sessionStorage + exports to encrypted JSON for audit trail.
 */
import { encryptString, cryptoAvailable } from "./encryption"

export type AuditEvent = {
  time: string
  action: "create" | "update" | "delete" | "login" | "logout" | "permission_denied" | "anomaly"
  target: string
  user: string
  ip?: string
  sessionId?: string
  details?: string
}

const AUDIT_KEY = "cms_audit_log"

export function logEvent(event: AuditEvent): void {
  try {
    const existing: AuditEvent[] = JSON.parse(sessionStorage.getItem(AUDIT_KEY) ?? "[]")
    existing.push(event)
    // Cap at 500 events to prevent storage blowout
    const trimmed = existing.slice(-500)
    sessionStorage.setItem(AUDIT_KEY, JSON.stringify(trimmed))
  } catch (_) {}
}

export function getAuditLog(): AuditEvent[] {
  try { return JSON.parse(sessionStorage.getItem(AUDIT_KEY) ?? "[]") } catch (_) { return [] }
}

export function exportEncryptedAudit(password: string): Promise<string> {
  const log = getAuditLog()
  const payload = JSON.stringify(log)
  if (!cryptoAvailable()) return Promise.resolve(btoa(payload)) // fallback
  return encryptString(payload, password)
}

export function clearAudit(): void {
  try { sessionStorage.removeItem(AUDIT_KEY) } catch (_) {}
}

/** Monitor: detect rapid mutations on same target = possible brute-force / bot */
export function detectAnomaly(action: string, target: string): boolean {
  const log = getAuditLog()
  const recent = log.filter((e) => e.action === action && e.target === target && Date.now() - new Date(e.time).getTime() < 60_000)
  return recent.length > 5 // 5+ same-action/same-target in 60s = anomaly
}
