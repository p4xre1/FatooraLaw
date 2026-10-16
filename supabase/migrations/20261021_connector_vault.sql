-- Connector vault: where a customer's Shopify / YouCan / Meta / Google / WhatsApp
-- credentials live, and the structure that keeps them away from everybody else.
--
-- Every connector needs the same two things from the database, and they are the
-- two things that are dangerous to get wrong:
--
--   1. A **public half** — which store is connected, under which scopes, when it
--      last synced, and why it stopped. The customer sees this in Settings; a
--      support operator can see it too. It contains no secret **by
--      construction**: the access token is not a column of this table, so the
--      day somebody adds a field to `mcp_connections` they cannot accidentally
--      add a credential to it.
--
--   2. A **secret half** — `mcp_connection_secrets`, which RLS is enabled on
--      with **zero policies**. Nobody reaches it: not the customer, not a
--      platform operator, not another tenant. Only the Worker, which holds the
--      service role, reads a token, and only inside the request that needs it.
--
-- A third table holds OAuth `state` values, stored **hashed** and consumed
-- exactly once, so an intercepted callback cannot be replayed into a second
-- connection. It mirrors the key_hash design in 20261017.
--
-- Nothing here stores a Shopify/Meta/Google secret belonging to Fatorati. Those
-- are Worker secrets. This migration is only about what customers own.

-- ------------------------------------------------------------- public half --

create table if not exists public.mcp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('shopify', 'youcan', 'meta_ads', 'google_ads', 'whatsapp')),
  -- The provider's own identifier: a Shopify shop domain, a YouCan store id, a
  -- Meta ad account id, a WhatsApp phone number id.
  external_account_id text not null check (char_length(external_account_id) between 1 and 200),
  external_account_name text not null default '' check (char_length(external_account_name) <= 200),
  scopes text[] not null default '{}',
  -- `needs_reauth` is a state a human must see and clear, not a retry loop.
  status text not null default 'active' check (status in ('active', 'needs_reauth', 'revoked', 'error')),
  -- Derived, never asserted by a caller: the trigger on the secrets table below
  -- keeps this in step with whether a token actually exists. It is what the
  -- customer's Settings screen reads, because "connected" and "the credential
  -- is gone" are different states and only one of them can be acted on.
  has_credentials boolean not null default false,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  last_error text not null default '' check (char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One live connection per store per customer. Reconnecting the same store
  -- updates the row instead of accumulating duplicates.
  unique (user_id, provider, external_account_id)
);
create index if not exists mcp_connections_user_provider_idx on public.mcp_connections(user_id, provider);

alter table public.mcp_connections enable row level security;

drop policy if exists mcp_connections_select_own on public.mcp_connections;
create policy mcp_connections_select_own on public.mcp_connections
  for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());

-- Deliberately no insert, update or delete policy: connections are written by
-- the Worker after the provider has confirmed consent, and are never edited
-- from the browser. A customer disconnects through the RPC below, which leaves
-- the row behind as the record that the connection existed.

grant select on public.mcp_connections to authenticated;
grant select, insert, update, delete on public.mcp_connections to service_role;

-- ------------------------------------------------------------- secret half --

create table if not exists public.mcp_connection_secrets (
  connection_id uuid primary key references public.mcp_connections(id) on delete cascade,
  access_token text not null default '',
  refresh_token text not null default '',
  -- Provider extras that are also secrets or that only the Worker needs:
  -- a Shopify app-installation id, a WABA id, a Google customer id.
  metadata jsonb not null default '{}'::jsonb,
  rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mcp_connection_secrets enable row level security;
-- RLS on with no policy denies every non-owner by itself. The revoke is the
-- second lock on the same door, so a later `create policy ... using (true)` on
-- this table is not the only thing standing between a token and a browser.
revoke all on public.mcp_connection_secrets from public, anon, authenticated;
grant select, insert, update, delete on public.mcp_connection_secrets to service_role;

-- `mcp_connections.has_credentials` is not maintained by hand. A caller that
-- had to remember to set it would eventually forget, and the Settings screen
-- would claim a connection was ready when its token had already been destroyed.
-- Deriving it from the row that actually holds the secret makes the two
-- impossible to disagree.
create or replace function public.sync_mcp_connection_credentials()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.mcp_connections set has_credentials = true, updated_at = now() where id = new.connection_id;
    return new;
  end if;
  update public.mcp_connections set has_credentials = false, updated_at = now() where id = old.connection_id;
  return old;
end;
$$;
drop trigger if exists mcp_connection_secrets_sync on public.mcp_connection_secrets;
create trigger mcp_connection_secrets_sync
  after insert or delete on public.mcp_connection_secrets
  for each row execute function public.sync_mcp_connection_credentials();
revoke all on function public.sync_mcp_connection_credentials() from public, anon, authenticated;

-- ------------------------------------------------------------ oauth state --

create table if not exists public.mcp_oauth_states (
  -- The SHA-256 of the state value, never the value. A reader of this table
  -- cannot complete somebody's half-finished authorization.
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('shopify', 'youcan', 'meta_ads', 'google_ads', 'whatsapp')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  consumed_at timestamptz
);
create index if not exists mcp_oauth_states_expiry_idx on public.mcp_oauth_states(expires_at);

alter table public.mcp_oauth_states enable row level security;
revoke all on public.mcp_oauth_states from public, anon, authenticated;
grant select, insert, update, delete on public.mcp_oauth_states to service_role;

-- Single use, enforced by the WHERE clause of the UPDATE rather than by a read
-- followed by a write: two concurrent callbacks with the same state cannot both
-- match `consumed_at is null`, so exactly one of them connects a store.
create or replace function public.mcp_consume_oauth_state(p_state_hash text)
returns table (user_id uuid, provider text, payload jsonb)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.mcp_oauth_states s
     set consumed_at = now()
   where s.state_hash = p_state_hash
     and s.consumed_at is null
     and s.expires_at > now()
  returning s.user_id, s.provider, s.payload;
end;
$$;
revoke all on function public.mcp_consume_oauth_state(text) from public, anon, authenticated;
grant execute on function public.mcp_consume_oauth_state(text) to service_role;

-- Abandoned authorizations are debris, not data. The Worker's cron calls this;
-- nothing else may.
create or replace function public.mcp_purge_expired_oauth_states()
returns integer language plpgsql security definer set search_path = public as $$
declare purged integer;
begin
  delete from public.mcp_oauth_states where expires_at < now() - interval '1 hour';
  get diagnostics purged = row_count;
  return purged;
end;
$$;
revoke all on function public.mcp_purge_expired_oauth_states() from public, anon, authenticated;
grant execute on function public.mcp_purge_expired_oauth_states() to service_role;

-- -------------------------------------------------------------- event log --

create table if not exists public.mcp_connection_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.mcp_connections(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  -- A background sync has no signed-in user behind it, so events cannot reuse
  -- `admin_audit_events`, whose actor is required to be a real account.
  actor_kind text not null check (actor_kind in ('user', 'worker', 'webhook', 'system')),
  actor_id uuid,
  event text not null check (char_length(event) between 1 and 80),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- A connector log is exactly where a token gets written "just for debugging".
  -- This refuses the obvious names at the database, so the mistake fails in a
  -- test run instead of quietly persisting a credential in an auditable table.
  constraint mcp_connection_events_no_secret_keys check (
    not (details ?| array['access_token', 'refresh_token', 'token', 'secret', 'client_secret', 'password', 'authorization'])
  )
);
create index if not exists mcp_connection_events_connection_idx on public.mcp_connection_events(connection_id, created_at desc);
create index if not exists mcp_connection_events_user_idx on public.mcp_connection_events(user_id, created_at desc);

alter table public.mcp_connection_events enable row level security;

drop policy if exists mcp_connection_events_select_own on public.mcp_connection_events;
create policy mcp_connection_events_select_own on public.mcp_connection_events
  for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());

grant select on public.mcp_connection_events to authenticated;
grant select, insert, update, delete on public.mcp_connection_events to service_role;

-- ------------------------------------------------------------- disconnect --

-- The customer's own action, and the only one the browser may take on a
-- connection. It destroys the token immediately: a row marked `revoked` that
-- still holds a usable credential is revoked in name only.
create or replace function public.disconnect_mcp_connection(p_connection_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_provider text;
  v_account text;
begin
  if v_user is null then raise exception 'authentication_required' using errcode = '28000'; end if;

  select provider, external_account_id into v_provider, v_account
    from public.mcp_connections
   where id = p_connection_id and user_id = v_user;
  if not found then
    raise exception 'connector_connection_not_found' using errcode = 'P0002';
  end if;

  update public.mcp_connections
     set status = 'revoked', last_error = '', updated_at = now()
   where id = p_connection_id and user_id = v_user;

  delete from public.mcp_connection_secrets where connection_id = p_connection_id;

  insert into public.mcp_connection_events (connection_id, user_id, actor_kind, actor_id, event, details)
  values (
    p_connection_id, v_user, 'user', v_user, 'disconnect',
    jsonb_build_object('provider', v_provider, 'account', v_account)
  );

  return true;
end;
$$;
revoke all on function public.disconnect_mcp_connection(uuid) from public, anon;
grant execute on function public.disconnect_mcp_connection(uuid) to authenticated;

-- What the Settings screen reads: one table, no join.
--
-- `security_invoker = true` means the RLS policy on `mcp_connections` — not the
-- view — is what decides who sees which row, which is the property worth
-- keeping. That is also why `has_credentials` is a derived column above rather
-- than a join: a security-invoker view that reached into the secrets table
-- would need its reader to hold a grant on that table, which is precisely the
-- grant this migration exists to withhold.
create or replace view public.mcp_connection_status
with (security_invoker = true) as
select
  id, user_id, provider, external_account_id, external_account_name,
  scopes, status, has_credentials, token_expires_at, last_synced_at, last_error,
  created_at, updated_at
from public.mcp_connections;

grant select on public.mcp_connection_status to authenticated;
grant select on public.mcp_connection_status to service_role;
