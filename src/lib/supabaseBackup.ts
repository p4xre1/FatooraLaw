import { create } from "zustand"
import { isSupabaseConfigured, supabase } from "./supabase"
import { businessSnapshot, useMizan, type LocalData } from "../store/useMizan"
import { CLOUD_BUCKET, CLOUD_MAX_SNAPSHOT_BYTES, type CloudQuota } from "./cloudStorage"

const DEVICE_KEY_PREFIX = "fatorati.supabase-backup-device.v1."
type BackupStatus = "unavailable" | "disabled" | "syncing" | "synced" | "error"
type BackupSyncState = { status: BackupStatus; enabled: boolean; updatedAt: string | null; message: string | null; quota: CloudQuota | null }
const emptyState: BackupSyncState = { status: "disabled", enabled: false, updatedAt: null, message: null, quota: null }
export const useSupabaseBackup = create<BackupSyncState>(() => ({ ...emptyState, status: "unavailable" }))

// Serialize writes/deletions per account; an in-flight upload must finish BEFORE
// deletion, never recreate a file after the user deletes their cloud copies.
const queues = new Map<string, Promise<unknown>>()
const generations = new Map<string, number>()
const generation = (id: string) => generations.get(id) ?? 0
function invalidate(id: string) { generations.set(id, generation(id) + 1) }
function assertAccount(id: string, expected = generation(id)) {
  if (useMizan.getState().auth?.id !== id || generation(id) !== expected) throw new Error("Account or backup consent changed; cloud request cancelled.")
}
async function serialize<T>(id: string, work: () => Promise<T>): Promise<T> {
  const task = (queues.get(id) ?? Promise.resolve()).catch(() => undefined).then(work)
  queues.set(id, task)
  try { return await task } finally { if (queues.get(id) === task) queues.delete(id) }
}
function setForAccount(id: string, expected: number, patch: Partial<BackupSyncState>) {
  if (useMizan.getState().auth?.id === id && generation(id) === expected) useSupabaseBackup.setState(patch)
}
const messageFor = (error: unknown) => error instanceof Error ? error.message :
  typeof error === "object" && error && "message" in error ? String(error.message) : "Backup sync failed."

function deviceIdFor(userId: string): string {
  const key = `${DEVICE_KEY_PREFIX}${encodeURIComponent(userId)}`
  let id = localStorage.getItem(key)
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id) }
  return id
}
function snapshotFor(userId: string): LocalData {
  assertAccount(userId)
  const snapshot = businessSnapshot(useMizan.getState())
  if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > CLOUD_MAX_SNAPSHOT_BYTES) {
    throw new Error("The backup exceeds the 4 MB per-device snapshot limit. Export locally and remove large attachments before syncing.")
  }
  return snapshot
}
export async function refreshCloudQuota(userId: string): Promise<CloudQuota> {
  const expected = generation(userId)
  assertAccount(userId, expected)
  const { data, error } = await supabase.rpc("cloud_storage_status")
  if (error) throw error
  if (!data || typeof data.allowed !== "boolean") throw new Error("Apply the paid cloud storage migration first.")
  assertAccount(userId, expected)
  const quota = data as CloudQuota
  setForAccount(userId, expected, { quota, ...(!quota.allowed ? { enabled: false } : {}) })
  return quota
}
async function persistSnapshot(userId: string, expected: number): Promise<void> {
  assertAccount(userId, expected)
  const quota = await refreshCloudQuota(userId)
  assertAccount(userId, expected)
  if (!quota.allowed) throw new Error("Cloud storage requires an active PRO or BOOST subscription.")
  const deviceId = deviceIdFor(userId)
  const snapshot = snapshotFor(userId)
  // Final per-account and shared quotas are checked by SQL on actual file size.
  const { error: uploadError } = await supabase.storage.from(CLOUD_BUCKET).upload(
    `${userId}/${deviceId}.json`, new Blob([JSON.stringify(snapshot)], { type: "application/json" }),
    { upsert: true, contentType: "application/json", cacheControl: "0" },
  )
  if (uploadError) throw uploadError
  assertAccount(userId, expected)
  // Metadata only: JSON payloads must never be written into the Free database.
  const { error } = await supabase.from("business_backup_mirrors").upsert({
    user_id: userId, device_id: deviceId, enabled: true, updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,device_id" })
  if (error) throw error
  await refreshCloudQuota(userId)
}
async function uploadBackup(userId: string): Promise<void> {
  const expected = generation(userId)
  assertAccount(userId, expected)
  setForAccount(userId, expected, { status: "syncing", message: null })
  try {
    await serialize(userId, () => persistSnapshot(userId, expected))
    setForAccount(userId, expected, { status: "synced", enabled: true, updatedAt: new Date().toISOString(), message: null })
  } catch (error) {
    setForAccount(userId, expected, { status: "error", message: messageFor(error) })
    throw error
  }
}
/** Explicit opt-in; server subscription and quota checks cannot be bypassed. */
export async function enableSupabaseBackup(userId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.")
  await uploadBackup(userId)
}
export async function syncSupabaseBackupNow(userId: string): Promise<void> {
  if (!useSupabaseBackup.getState().enabled) throw new Error("Enable the Supabase backup first.")
  await uploadBackup(userId)
}
export async function disableSupabaseBackup(userId: string): Promise<void> {
  assertAccount(userId)
  invalidate(userId)
  const expected = generation(userId)
  setForAccount(userId, expected, { status: "disabled", enabled: false, message: null })
  await serialize(userId, async () => {
    assertAccount(userId, expected)
    const { error } = await supabase.from("business_backup_mirrors")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId).eq("device_id", deviceIdFor(userId))
    if (error) throw error
  })
}
export async function deleteSupabaseBackup(userId: string): Promise<void> {
  assertAccount(userId)
  invalidate(userId)
  const expected = generation(userId)
  setForAccount(userId, expected, { status: "disabled", enabled: false, message: null })
  await serialize(userId, async () => {
    // Always delete page one: offsets would skip files after removing a page.
    while (true) {
      assertAccount(userId, expected)
      const { data, error } = await supabase.storage.from(CLOUD_BUCKET).list(userId, { limit: 100 })
      if (error) throw error
      if (!data?.length) break
      assertAccount(userId, expected)
      const { error: removeError } = await supabase.storage.from(CLOUD_BUCKET).remove(data.map((file) => `${userId}/${file.name}`))
      if (removeError) throw removeError
    }
    assertAccount(userId, expected)
    const { error } = await supabase.from("business_backup_mirrors").delete().eq("user_id", userId)
    if (error) throw error
    setForAccount(userId, expected, { status: "disabled", enabled: false, updatedAt: null, message: null })
    await refreshCloudQuota(userId)
  })
}
/** Per-device backup, not cross-device live sync. Local data stays canonical. */
export function startSupabaseBackupSync(userId: string): () => void {
  useSupabaseBackup.setState({ ...emptyState, status: !isSupabaseConfigured || userId === "local-dev" ? "unavailable" : "disabled" })
  if (!isSupabaseConfigured || userId === "local-dev") return () => undefined
  let active = true
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastState = useMizan.getState()
  const unsubscribe = useMizan.subscribe((state) => {
    const changed = state.settings !== lastState.settings || state.projects !== lastState.projects || state.contacts !== lastState.contacts ||
      state.expenses !== lastState.expenses || state.stock !== lastState.stock || state.orders !== lastState.orders ||
      state.campaigns !== lastState.campaigns || state.contracts !== lastState.contracts || state.team !== lastState.team ||
      state.tools !== lastState.tools || state.audit !== lastState.audit
    lastState = state
    if (!active || !useSupabaseBackup.getState().enabled || !changed || state.auth?.id !== userId || timer) return
    // Coalesce edits to reduce traffic. Always serialize the latest local state.
    timer = setTimeout(() => {
      timer = null
      if (active && useSupabaseBackup.getState().enabled) void syncSupabaseBackupNow(userId).catch(() => undefined)
    }, 60_000)
  })
  const expected = generation(userId)
  void (async () => {
    const quota = await refreshCloudQuota(userId)
    if (!active || !quota.allowed) return
    const { data, error } = await supabase.from("business_backup_mirrors").select("enabled,updated_at")
      .eq("user_id", userId).eq("device_id", deviceIdFor(userId)).maybeSingle()
    if (error) throw error
    if (!active) return
    const enabled = data?.enabled === true
    setForAccount(userId, expected, { status: enabled ? "synced" : "disabled", enabled, updatedAt: data?.updated_at ?? null, message: null })
    if (enabled && active) await syncSupabaseBackupNow(userId)
  })().catch((error: unknown) => {
    if (active) setForAccount(userId, expected, { status: "error", message: messageFor(error) })
  })
  return () => {
    active = false
    invalidate(userId)
    if (timer) clearTimeout(timer)
    unsubscribe()
    useSupabaseBackup.setState(emptyState)
  }
}
