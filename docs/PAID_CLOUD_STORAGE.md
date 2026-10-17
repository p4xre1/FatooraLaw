# Paid cloud storage: Supabase Free first

## Product rules

- FREE: local business workspace only; no new cloud backup uploads.
- Active PRO and BOOST: **100 MB total saved cloud backup storage per account**,
  shared across devices. This does **not** reset monthly and is not a monthly
  upload/egress allowance. Decimal units: MB = 1,000,000 bytes, GB = 1,000,000,000.
- Extra storage: **USD 2 per GB per month**; 10 GB costs USD 20 per month.
  The Settings link requests availability through the existing WhatsApp sales
  channel. It is not an automatic checkout. Confirm capacity before collecting
  payment; only trusted operators can provision add-ons, with an explicit expiry.
- Only server `account_subscriptions` rows with `pro`/`boost`, `active`, and a
  future `current_period_end` enable uploads. Local plan edits cannot grant cloud
  access. Legacy `business` subscriptions are not automatically entitled.
- Cancellation/expiry prevents uploads but preserves existing copies for recovery
  and deletion. Account deletion requests also prevent reading cloud files.

## Deploy

1. Back up the database. Apply migrations through
   `supabase/migrations/20261022_paid_cloud_storage.sql`, in order, using a trusted
   SQL connection / Supabase SQL Editor. Fresh projects can use `schema.sql`.
   This migration must run **after** the activation and account-deletion migrations.
2. Deploy the updated browser bundle at the same time. Old clients that try to
   write snapshot JSON into Postgres will fail safely; refresh those clients.
3. Verify the private `business-backups` bucket. Do not make it public or add
   broader `storage.objects` policies. Never expose a service-role key in Vite.
4. Smoke-test through the actual Supabase Storage API: free upload rejected,
   PRO/BOOST upload succeeds, object overwrite counts once, different account
   cannot list/download, quota rejection preserves local data, pause/delete works.
   SQL tests emulate Storage tables but cannot validate your hosted API version.
5. Configure the trusted cloud cleanup scheduler described below **before launch**.

The new payload lives in **File Storage**, not in the Free plan's 500 MB Postgres
allocation. `business_backup_mirrors` keeps only consent/device metadata for new
copies. Its snapshot column remains for **pre-existing legacy backups**: the
migration does not erase them. Owners can still read/delete them; re-uploading from
an existing browser creates a file copy. Export/verify old copies before manually
retiring legacy rows. Do not bulk-delete old snapshots without a verified backup.

## Free project capacity

`cloud_storage_config` initially has a **900,000,000 byte** backup budget and
`addons_enabled = false`. That leaves 100 MB of the quoted 1 GB Free storage
allowance as headroom for CMS/blog media and transient uploads. The quota is a
shared live budget, not a reservation: nine accounts can fill it at 100 MB each.
When exhausted, uploads fail without replacing local workspace data. Do not sell
more guaranteed capacity than your project can actually deliver.

The 900 MB cap is for **this backup bucket only**. Inspect other bucket usage in
Supabase and **lower this cap if necessary**. CMS uploads, other projects, database
size, cached/uncached egress, Auth usage and temporary/replaced S3 objects are not
metered by this quota. Monitor the Supabase dashboard; this feature is not a
provider-wide billing or bandwidth firewall. Free projects can still pause after
inactivity. Unlimited API requests do not imply unlimited storage or egress.

Each per-device JSON workspace snapshot remains capped at 4 MiB, as before. Edits
are coalesced for 60 seconds; manual sync is available. This is a **backup mirror**,
not automatic cross-device sync, attachment hosting, or a general file drive;
invoice drafts/templates remain local as documented in the existing product.
Small-file counts are also bounded (100 files/account at the included allowance,
900 files/project initially), scaling with provisioned capacity to bound metadata
in the Free database. Storage's rolled-back RLS probes do not consume quota.

Usage comes from server-measured Storage object metadata and transactional SQL
counters. A locked shared counter enforces account/project limits across concurrent
inserts, overwrites and deletions. Clients cannot edit counters, add-ons, expiry or
capacity. Use Storage APIs for all object removal: deleting `storage.objects` rows
in SQL does **not** delete underlying files. Moving/renaming backup objects is
blocked; upload a correctly named copy and delete the old object through the API.

## After upgrading Supabase

Confirm the provider's current limits and pricing; the user's quoted Pro package
includes 100 GB files, but do not assume the full allowance is free for this bucket.
For example, reserve 10 GB for other media and use 90 GB for backups:

```sql
update public.cloud_storage_config
set capacity_bytes = 90000000000, addons_enabled = true
where id = true;
```

After verifying the account, capacity and payment, provision the add-on from a
trusted connection. `$1` is the verified auth user UUID, `$2` the positive integer
GB quantity, `$3` the exact paid-through timestamp; use real parameter binding:

```sql
insert into public.cloud_storage_accounts(user_id, extra_gb, extra_expires_at)
values ($1::uuid, $2::integer, $3::timestamptz)
on conflict (user_id) do update
set extra_gb = excluded.extra_gb, extra_expires_at = excluded.extra_expires_at;
```

`extra_gb` is the **total current add-on**, not an increment; renewing sets a new
paid-through date. Add-ons do not grant a subscription by themselves. Expired
add-ons stop counting toward capacity immediately, without destroying existing
backups; deletion/shrinking remain possible if an account is over quota. They
never bypass the shared project cap. No recurring payment collection is implemented.

The provider's quoted $0.0213/GB is storage overage, **not your complete cost**:
include the base Supabase plan, database, transfer, taxes/payment fees and support
when evaluating your $2/GB retail price.

## Account erasure and scheduled purge

Settings removes Storage files through the API **before** requesting immediate
workspace erasure. The server rejects irreversible erasure or auth-user hard
purge while files remain, preventing silently orphaned cloud copies.

For the 30-day deletion path, run this from a trusted scheduler at least every
15 minutes (before, or alongside, the existing SQL account-purge cron):

```sh
# Supply SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY via scheduler secrets.
node scripts/cleanup-cloud-storage.mjs          # dry run; counts only
node scripts/cleanup-cloud-storage.mjs --apply  # removes files for due accounts
```

The service-only `cloud_cleanup_candidates()` RPC returns accounts past their
30-day deletion period. The script removes files using Storage APIs, updating the
quota counters; the existing `purge_deleted_accounts()` job subsequently purges
account records. Configure alerts for failures. Without this scheduler, hard
purge is intentionally blocked until files are removed. Do not manually bypass
cleanup triggers to force deletion, and do not log service credentials.

## Verification

- `tests/cloudStorageSql.test.ts`: real PostgreSQL/PGlite, private-bucket policies,
  entitlements, account/global limits, rollback/overwrites, isolation, add-on
  expiry, metadata-only writes and deletion safeguards.
- `tests/supabaseBackup.test.ts`: Storage rather than DB payload writes, free
  denial, quota errors, account switching and Storage-first deletion.
