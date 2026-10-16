import { create } from "zustand"
import { isSupabaseConfigured, supabase } from "./supabase"
import { businessSnapshot, useMizan } from "../store/useMizan"
import type { LocalData } from "../store/useMizan"

const DEVICE_KEY_PREFIX = "fatorati.supabase-backup-device.v1."
const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024

type BackupStatus = "unavailable" | "disabled" | "syncing" | "synced" | "error"
type BackupSyncState = { status: BackupStatus; enabled: boolean; updatedAt: string | null; message: string | null }

export const useSupabaseBackup = create<BackupSyncState>(() => ({
  status: "unavailable", enabled: false, updatedAt: null, message: null,
}))

function deviceIdFor(userId: string): string {
  const key = `${DEVICE_KEY_PREFIX}${encodeURIComponent(userId)}`
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

function snapshotFor(userId: string): LocalData {
  const current = useMizan.getState()
  if (current.auth?.id !== userId) throw new Error("The signed-in account changed; backup cancelled.")
  const snapshot = businessSnapshot(current)
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot)).byteLength
  if (bytes > MAX_SNAPSHOT_BYTES) throw new Error("The backup exceeds the 4 MB limit. Export locally and remove large attachments before syncing.")
  return snapshot
}

async function persistSnapshot(userId: string, deviceId: string, enabled = true): Promise<void> {
  const snapshot = snapshotFor(userId)
  const { error } = await supabase.from("business_backup_mirrors").upsert({
    user_id: userId,
    device_id: deviceId,
    snapshot,
    schema_version: 1,
    enabled,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,device_id" })
  if (error) throw error
}

/** Opt-in: preserve this device's current local workspace as its server mirror. */
export async function enableSupabaseBackup(userId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.")
  const deviceId = deviceIdFor(userId)
  useSupabaseBackup.setState({ status: "syncing", enabled: false, updatedAt: null, message: null })
  try {
    await persistSnapshot(userId, deviceId, true)
    useSupabaseBackup.setState({ status: "synced", enabled: true, updatedAt: new Date().toISOString(), message: null })
  } catch (error) {
    useSupabaseBackup.setState({ status: "error", enabled: false, updatedAt: null, message: error instanceof Error ? error.message : "Backup sync failed." })
    throw error
  }
}

export async function disableSupabaseBackup(userId: string): Promise<void> {
  const deviceId = deviceIdFor(userId)
  const { error } = await supabase.from("business_backup_mirrors")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("device_id", deviceId)
  if (error) throw error
  useSupabaseBackup.setState({ status: "disabled", enabled: false, updatedAt: null, message: null })
}

export async function deleteSupabaseBackup(userId: string): Promise<void> {
  const { error } = await supabase.from("business_backup_mirrors").delete().eq("user_id", userId)
  if (error) throw error
  useSupabaseBackup.setState({ status: "disabled", enabled: false, updatedAt: null, message: null })
}

export async function syncSupabaseBackupNow(userId: string): Promise<void> {
  if (!useSupabaseBackup.getState().enabled) throw new Error("Enable the Supabase backup first.")
  const deviceId = deviceIdFor(userId)
  useSupabaseBackup.setState((state) => ({ ...state, status: "syncing", message: null }))
  try {
    await persistSnapshot(userId, deviceId)
    useSupabaseBackup.setState({ status: "synced", enabled: true, updatedAt: new Date().toISOString(), message: null })
  } catch (error) {
    useSupabaseBackup.setState((state) => ({ ...state, status: "error", message: error instanceof Error ? error.message : "Backup sync failed." }))
    throw error
  }
}

/**
 * Mirror changes only after explicit opt-in and only for the authenticated user.
 * Each browser/device has its own row to avoid overwriting another device's
 * local-only workspace. This is a backup copy, not cross-device live sync.
 */
export function startSupabaseBackupSync(userId: string): () => void {
  if (!isSupabaseConfigured || userId === "local-dev") {
    useSupabaseBackup.setState({ status: "unavailable", enabled: false, updatedAt: null, message: null })
    return () => undefined
  }

  let active = true
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastState = useMizan.getState()
  let deviceId: string
  try { deviceId = deviceIdFor(userId) }
  catch (error) {
    useSupabaseBackup.setState({ status: "error", enabled: false, updatedAt: null, message: error instanceof Error ? error.message : "Browser storage unavailable." })
    return () => undefined
  }

  const unsubscribe = useMizan.subscribe((state) => {
    const changed = state.settings !== lastState.settings || state.projects !== lastState.projects || state.contacts !== lastState.contacts ||
      state.expenses !== lastState.expenses || state.stock !== lastState.stock || state.orders !== lastState.orders ||
      state.campaigns !== lastState.campaigns || state.contracts !== lastState.contracts || state.team !== lastState.team ||
      state.tools !== lastState.tools || state.audit !== lastState.audit
    lastState = state
    if (!active || !useSupabaseBackup.getState().enabled || !changed || state.auth?.id !== userId) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      useSupabaseBackup.setState((current) => ({ ...current, status: "syncing", message: null }))
      void persistSnapshot(userId, deviceId).then(() => {
        if (active) useSupabaseBackup.setState({ status: "synced", enabled: true, updatedAt: new Date().toISOString(), message: null })
      }).catch((error: unknown) => {
        if (active) useSupabaseBackup.setState((current) => ({ ...current, status: "error", message: error instanceof Error ? error.message : "Backup sync failed." }))
      })
    }, 1200)
  })

  try {
    const lookup = supabase.from("business_backup_mirrors").select("enabled,updated_at")
      .eq("user_id", userId).eq("device_id", deviceId).maybeSingle()
    void Promise.resolve(lookup).then(({ data, error }) => {
        if (!active) return
        if (error) {
          useSupabaseBackup.setState({ status: "error", enabled: false, updatedAt: null, message: "Apply the Supabase backup migration, then retry." })
          return
        }
        const enabled = data?.enabled === true
        useSupabaseBackup.setState({
          status: enabled ? "synced" : "disabled",
          enabled,
          updatedAt: typeof data?.updated_at === "string" ? data.updated_at : null,
          message: null,
        })
        // The local store is canonical for now. Refresh this device's mirror on
        // entry, but never read/replace local records from the mirror implicitly.
        if (enabled) void syncSupabaseBackupNow(userId).catch(() => undefined)
      })
      .catch((error: unknown) => {
        if (active) useSupabaseBackup.setState({ status: "error", enabled: false, updatedAt: null, message: error instanceof Error ? error.message : "Backup status lookup failed." })
      })
  } catch (error) {
    useSupabaseBackup.setState({ status: "error", enabled: false, updatedAt: null, message: error instanceof Error ? error.message : "Backup status lookup failed." })
  }

  return () => {
    active = false
    if (timer) clearTimeout(timer)
    unsubscribe()
    useSupabaseBackup.setState({ status: "disabled", enabled: false, updatedAt: null, message: null })
  }
}
