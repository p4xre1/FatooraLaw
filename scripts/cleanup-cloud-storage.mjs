/** Run from a trusted scheduler before the existing account-purge job.
 * Dry run by default. Never expose SUPABASE_SERVICE_ROLE_KEY to a Vite build.
 */
import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the trusted scheduler environment.")
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const apply = process.argv.includes("--apply")
const { data: accounts, error } = await client.rpc("cloud_cleanup_candidates")
if (error) throw new Error(`Could not list cleanup candidates: ${error.message}`)
console.log(`${apply ? "Applying" : "Dry run:"} cloud cleanup for ${accounts?.length ?? 0} accounts past their 30-day deletion period.`)
for (const { user_id: id } of accounts ?? []) {
  if (!apply) continue
  while (true) {
    const { data: files, error: listError } = await client.storage.from("business-backups").list(id, { limit: 100 })
    if (listError) throw new Error(`Cloud cleanup listing failed: ${listError.message}`)
    if (!files?.length) break
    const { error: removeError } = await client.storage.from("business-backups").remove(files.map((file) => `${id}/${file.name}`))
    if (removeError) throw new Error(`Cloud cleanup removal failed: ${removeError.message}`)
  }
}
console.log(apply ? "Cloud cleanup complete. The existing SQL account-purge job can now delete these accounts." : "No files deleted. Run again with --apply after review.")
