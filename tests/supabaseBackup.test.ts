import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  state: { auth: { id: "account-a" } as { id: string } | null },
  quota: { allowed: true, used_bytes: 0, limit_bytes: 100_000_000, capacity_bytes: 900_000_000, project_used_bytes: 0, addons_enabled: false },
  rpc: vi.fn(), upload: vi.fn(), list: vi.fn(), remove: vi.fn(), upsert: vi.fn(), from: vi.fn(), deleteEq: vi.fn(),
}))
vi.mock("../src/lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
    storage: { from: () => ({ upload: mocks.upload, list: mocks.list, remove: mocks.remove }) },
  },
}))
vi.mock("../src/store/useMizan", () => ({
  useMizan: { getState: () => mocks.state, subscribe: () => () => undefined },
  businessSnapshot: () => ({ contacts: [{ name: "Private customer" }] }),
}))
import { deleteSupabaseBackup, enableSupabaseBackup, refreshCloudQuota, useSupabaseBackup } from "../src/lib/supabaseBackup"
import { CLOUD_INCLUDED_BYTES, storagePurchaseLink } from "../src/lib/cloudStorage"
beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.auth = { id: "account-a" }
  mocks.quota.allowed = true
  mocks.rpc.mockResolvedValue({ data: mocks.quota, error: null })
  mocks.upload.mockResolvedValue({ error: null })
  mocks.list.mockResolvedValue({ data: [], error: null })
  mocks.remove.mockResolvedValue({ error: null })
  mocks.upsert.mockResolvedValue({ error: null })
  mocks.deleteEq.mockResolvedValue({ error: null })
  mocks.from.mockReturnValue({ upsert: mocks.upsert, delete: () => ({ eq: mocks.deleteEq }) })
  useSupabaseBackup.setState({ status: "disabled", enabled: false, updatedAt: null, message: null, quota: null })
})
describe("paid file storage backups", () => {
  it("does not upload for Free accounts even when called directly", async () => {
    mocks.quota.allowed = false
    await expect(enableSupabaseBackup("account-a")).rejects.toThrow("active PRO or BOOST")
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.upsert).not.toHaveBeenCalled()
    expect(useSupabaseBackup.getState().enabled).toBe(false)
  })
  it("uploads a private JSON file and only sends metadata to Postgres", async () => {
    await enableSupabaseBackup("account-a")
    expect(mocks.upload).toHaveBeenCalledWith(expect.stringMatching(/^account-a\/.+\.json$/), expect.any(Blob), expect.objectContaining({ upsert: true, cacheControl: "0" }))
    const metadata = mocks.upsert.mock.calls[0][0]
    expect(metadata).not.toHaveProperty("snapshot")
    expect(metadata.user_id).toBe("account-a")
    expect(useSupabaseBackup.getState()).toMatchObject({ status: "synced", enabled: true })
  })
  it("reports server quota errors without recording a successful backup", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "cloud_account_storage_full" } })
    await expect(enableSupabaseBackup("account-a")).rejects.toMatchObject({ message: "cloud_account_storage_full" })
    expect(mocks.upsert).not.toHaveBeenCalled()
    expect(useSupabaseBackup.getState()).toMatchObject({ status: "error", enabled: false, message: "cloud_account_storage_full" })
    expect(mocks.state.auth?.id).toBe("account-a")
  })
  it("removes Storage files before deleting legacy database backups", async () => {
    mocks.list.mockResolvedValueOnce({ data: [{ name: "device.json" }], error: null }).mockResolvedValueOnce({ data: [], error: null })
    await deleteSupabaseBackup("account-a")
    expect(mocks.remove).toHaveBeenCalledWith(["account-a/device.json"])
    expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteEq.mock.invocationCallOrder[0])
  })
  it("does not leak an old account's quota or upload completion into a new session", async () => {
    let finish!: (value: unknown) => void
    mocks.rpc.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const work = refreshCloudQuota("account-a")
    mocks.state.auth = { id: "account-b" }
    finish({ data: mocks.quota, error: null })
    await expect(work).rejects.toThrow("changed")
    expect(useSupabaseBackup.getState().quota).toBe(null)
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it("publishes 100 MB and quotes 10 GB as $20 monthly, not provider cost", () => {
    expect(CLOUD_INCLUDED_BYTES).toBe(100_000_000)
    expect(decodeURIComponent(storagePurchaseLink(10))).toContain("20 USD/mois")
    expect(() => storagePurchaseLink(-1)).toThrow()
  })
})
