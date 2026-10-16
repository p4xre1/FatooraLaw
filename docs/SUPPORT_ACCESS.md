# Support access: the account reference and the operator lookup

How a client with a problem reaches a human, without either side handling
anything worth stealing.

## The client's half

`Settings → Aide et assistance → Votre référence de compte` shows a code:

```
FT-7K4M-92QD
```

They send that code and a description of the problem — by WhatsApp, by email,
however they already talk to you. That is the whole handover. They are asked for
no email address, no password, no ICE or RC document, no screenshot of an
invoice, and no login link.

The card says so in all three languages, including the part that is easy to
forget: **never share your password — not even with us.** There is no support
flow in this repository that needs it.

`Générer une nouvelle référence` rotates the code. Rotating is self-service,
changes no access and needs no ticket: a reference that leaked into a public
thread stops resolving the moment it is rotated.

## Why a reference and not a user id

The Supabase user id is a 36-character UUID and the primary key of `profiles`.
It is not a secret, but it is also not something a shop owner in Tangier should
be asked to read out over the phone, and pasting it into a chat as "your
account" invites it being treated as a credential. `FT-XXXX-XXXX` is ten
characters from an alphabet with no `I`, `L`, `O` or `U` — the four characters
people mishear and mistype — so a reference that survives being dictated is also
a reference that cannot silently become a different one.

The lookup accepts what a human actually types: lowercase, spaces, missing or
extra dashes. A reference containing a character the generator never produces is
reported as malformed rather than guessed at.

## The operator's half

`/admin/support-requests` carries the lookup panel.

| Step | What happens | What it costs |
| --- | --- | --- |
| Resolve | `support_lookup_account(ref)` returns the **masked** view: `k•••••@atlasbtp.ma`, plan, status, seats, usage, backup devices, this account's own ticket history | One `admin_audit_events` row |
| Compare | When the lookup came from a ticket, the panel says whether the address in the ticket matches the address on the account | — |
| Reveal | `support_reveal_account_email(ref)` returns the full address | Platform admin **and** AAL2, plus a second audit row |
| Act | Anything that changes the account: plan, quota, deletion | A separate, already-existing gated path |

Both calls are restricted to `platform_admins`, rate limited to 30 resolutions a
minute per operator, and audited **before** the payload is returned — so a lookup
that produced data is never missing from the trail.

### The rule that matters most

**The reference proves nothing.** It is a search hint for a human. Anyone who
overhears it in a WhatsApp thread has a code that resolves to an account — which
is exactly why it grants nothing and why revealing an address is a separate,
MFA-gated, logged action.

Ownership is verified by replying to the address **on file**, never to the
address written in the ticket. If a ticket says `attacker@example.com` and the
account says `karim@atlasbtp.ma`, the panel shows a warning rather than a
verdict, and the correct next step is to answer the address on file. A guest
ticket — filed by someone with no account — says so plainly, because there is no
account to verify and nothing to change.

## What an operator never asks for

- the account password, or a "test" login;
- a reset link, a one-time code, or a screenshot of one;
- an ICE / RC / CIN scan, or a bank document;
- a full email address, when the reference already identifies the account.

If a support conversation needs any of these, the flow has gone wrong somewhere
upstream.

## Where this lives

| Object | File |
| --- | --- |
| Server objects | `supabase/migrations/20261020_support_account_lookup.sql`, folded into `supabase/schema.sql` |
| Server behaviour, tested | `tests/supportLookupSql.test.ts` |
| CMS client | `src/admin/site/accountLookup.ts` |
| CMS panel | `src/admin/site/AccountLookupPanel.tsx` |
| Client-facing card | `src/modules/Settings.tsx` |
| Refusal wording, tested | `tests/accountLookup.test.ts` |

Applying the migration to an existing installation is the only deployment step.
Until it runs, the panel reports which file is missing instead of failing
silently — see `SUPPORT_LOOKUP_MIGRATION` in the client module.
