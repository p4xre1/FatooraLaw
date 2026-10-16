# Backup automation: implementation status and production requirements

## Available now

Settings supports multi-select CSV export of local datasets and a passphrase-encrypted full JSON backup. CSV omits inline logo/receipt image payloads; the encrypted JSON snapshot preserves the complete stored business state. The encrypted file is created locally with AES-256-GCM and a random IV/salt; PBKDF2-HMAC-SHA-256 uses 600,000 iterations for new exports. The passphrase is never stored or sent to Fatorati. Keep it separately: losing it means the encrypted backup cannot be opened. Do not email the passphrase with the backup.

The app also now offers an explicit opt-in Supabase mirror. After applying `supabase/migrations/20261016_business_backup_mirror.sql`, an owner can enable it in Settings. The current browser workspace is copied on enable, then changes are mirrored after a short debounce and on the next session. A separate RLS-protected row per account/device avoids one browser overwriting another browser's backup. Owners can pause syncing or delete all their mirror rows. The copy is readable by the user's authenticated Supabase session and trusted project operators; RLS is tenant isolation, not end-to-end encryption. It is not cross-device restore/live sync. Local browser data remains primary, and this mirror is capped at 4 MB per device snapshot.

The encrypted file protects an exported copy, not browser `localStorage`. Supabase mirroring still does not provide automatic monthly CSV jobs, restore tooling or email delivery.

## Why monthly email cannot safely run yet

Business records are in account-partitioned browser `localStorage`; the Supabase project is presently used for identity/CMS, not as the business-record database. A browser-only app cannot run a scheduled task while the user's device/browser is closed, and a server has no safe copy of those local records to export. There is no configured email delivery service or backup recipient preference. Sending a Gmail from frontend code would expose credentials and is not appropriate.

## Recommended implementation order

1. Move business records to tenant-scoped server tables with enforced Supabase RLS and server-side validation. Migrate data carefully from local storage and establish a tested restore process.
2. Add per-account backup preferences: monthly schedule/time zone, recipient address (verified), CSV sections, retention, and opt-in/opt-out. Use the verified account email as the default rather than collecting a second address unnecessarily.
3. Add a scheduled server function/cron that takes a consistent tenant snapshot, creates a versioned CSV or archive, and records success/failure idempotently. Protect against cross-tenant access and duplicate monthly jobs.
4. Store downloadable artifacts encrypted at rest in private storage. Email a short-lived authenticated download link, not the CSV/backup attachment. Require the account session and optionally a user-held passphrase for client-side encryption; never email/store that passphrase. Delete expired artifacts under a published retention policy.
5. Add audit events, retry/failure notifications, account deletion handling, and restore drills before enabling the feature broadly.

Gmail is the recipient mailbox, not the sending mechanism. Use an approved transactional email provider or controlled SMTP service from the server; keep its credentials in server secrets, never in `VITE_*` or browser code. A Gmail API sender would require an appropriately authorized server-side OAuth setup and is not necessary just to notify Gmail recipients.
