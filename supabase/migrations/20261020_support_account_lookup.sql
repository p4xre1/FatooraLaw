-- Support access: a shareable account reference, and an audited lookup for the CMS.
--
-- A client who needs help should not have to send an email address, a password,
-- a document scan or a screenshot of their invoice in a WhatsApp thread. They
-- read out `FT-7K4M-92QD` — an account reference that authorises nothing — and
-- an operator resolves it from the CMS.
--
-- Three separate things, deliberately not one:
--
--   1. `profiles.account_ref` is an *identifier*, never an authenticator. Its
--      owner can read it; nobody can write it (migration 20261012 grants
--      `update (name)` only, and the grant below is repeated explicitly). It can
--      be rotated by its owner at any time, and rotating it changes no access.
--   2. `support_lookup_account()` returns a *masked* view — first letter of the
--      local part, real domain — plus plan, status, usage and the account's own
--      support history. Restricted to `platform_admins`, rate limited, and it
--      writes an `admin_audit_events` row before returning.
--   3. `support_reveal_account_email()` is the only path to a full address and
--      additionally requires MFA (AAL2) in the current session, exactly like
--      issuing an activation key (see 20261018).
--
-- A reference proves nothing: it is a search hint for a human. Ownership is
-- verified by replying to the address *on file*, never to the address written
-- in a ticket.

-- ----------------------------------------------------------- the reference --

-- Same alphabet as the activation codes: no I, L, O or U, so a reference read
-- aloud or copied from a screenshot cannot become a different reference.
create or replace function public.account_ref_alphabet()
returns text language sql immutable set search_path = public
as $$ select '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; $$;

-- 8 characters from a 32-symbol alphabet = 40 bits. This is not a secret and
-- does not need to be, but it must not be enumerable by a curious client, and
-- at 40 bits guessing one is not a realistic path to anything.
--
-- Only core PostgreSQL is used (`md5`, `gen_random_uuid`, `random`,
-- `clock_timestamp`), so the same function runs under the PGlite schema tests
-- where pgcrypto is unavailable.
create or replace function public.generate_account_ref()
returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  seed text;
  body text := '';
  i integer;
  octet integer;
begin
  seed := md5(gen_random_uuid()::text || clock_timestamp()::text || random()::text);
  for i in 1..8 loop
    octet := ('x' || substr(seed, (i * 2) - 1, 2))::bit(8)::int;
    body := body || substr(alphabet, (octet % 32) + 1, 1);
  end loop;
  return 'FT-' || substr(body, 1, 4) || '-' || substr(body, 5, 4);
end;
$$;

alter table public.profiles add column if not exists account_ref text;

-- Existing installations: every account gets one before the column becomes
-- NOT NULL.
update public.profiles set account_ref = public.generate_account_ref()
 where account_ref is null or account_ref = '';

alter table public.profiles alter column account_ref set default public.generate_account_ref();
alter table public.profiles alter column account_ref set not null;

alter table public.profiles drop constraint if exists profiles_account_ref_format;
alter table public.profiles add constraint profiles_account_ref_format
  check (account_ref ~ '^FT-[0-9A-HJ-KM-NP-TV-Z]{4}-[0-9A-HJ-KM-NP-TV-Z]{4}$');

create unique index if not exists profiles_account_ref_key on public.profiles(account_ref);

-- The reference is read-only for its owner. `grant update (name)` from
-- 20261012 already excludes it; saying so here means a later grant of
-- `update on public.profiles` cannot silently make it writable.
revoke update (account_ref) on public.profiles from public, anon, authenticated;

-- Accepts what a human actually types or dictates: lowercase, spaces, missing
-- or extra dashes. Returns the canonical form, or NULL when the input contains
-- a character the generator never produces (I, L, O, U — usually a misread).
create or replace function public.normalize_account_ref(p_input text)
returns text language plpgsql immutable set search_path = public as $$
declare
  raw text;
begin
  raw := upper(regexp_replace(coalesce(p_input, ''), '[^0-9A-Za-z]', '', 'g'));
  if raw like 'FT%' then
    raw := substr(raw, 3);
  end if;
  if raw !~ '^[0-9A-HJ-KM-NP-TV-Z]{8}$' then
    return null;
  end if;
  return 'FT-' || substr(raw, 1, 4) || '-' || substr(raw, 5, 4);
end;
$$;

-- Enough of an address to confirm the operator found the right account, not
-- enough to contact the person or to be worth leaking: `k•••••@gmail.com`.
create or replace function public.mask_email(p_email text)
returns text language sql immutable set search_path = public as $$
  select case
    when coalesce(p_email, '') = '' then '—'
    when position('@' in p_email) <= 1 then '•••'
    else substr(p_email, 1, 1) || repeat('•', 5) || substr(p_email, position('@' in p_email))
  end;
$$;

-- The account's own view of its reference, and a fresh one on request. Both are
-- self-service: no admin, no audit noise, no effect on access.
create or replace function public.my_account_ref()
returns text language plpgsql security definer set search_path = public as $$
declare current_ref text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  select account_ref into current_ref from public.profiles where id = auth.uid();
  if current_ref is null then raise exception 'account_profile_missing' using errcode = 'P0002'; end if;
  return current_ref;
end;
$$;
revoke all on function public.my_account_ref() from public, anon;
grant execute on function public.my_account_ref() to authenticated;

create or replace function public.rotate_account_ref()
returns text language plpgsql security definer set search_path = public as $$
declare fresh text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  fresh := public.generate_account_ref();
  update public.profiles set account_ref = fresh where id = auth.uid();
  if not found then raise exception 'account_profile_missing' using errcode = 'P0002'; end if;
  return fresh;
end;
$$;
revoke all on function public.rotate_account_ref() from public, anon;
grant execute on function public.rotate_account_ref() to authenticated;

-- ------------------------------------------------------------- operator gate --

-- Restated per migration rather than assumed, so this file is safe to apply to
-- an installation that never ran 20261018.
create or replace function public.support_admin_mfa()
returns boolean language sql stable security definer set search_path = public, auth
as $$
  select public.is_platform_admin()
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;
revoke all on function public.support_admin_mfa() from public, anon;
grant execute on function public.support_admin_mfa() to authenticated;

-- ---------------------------------------------------------------- resolution --

-- Shared by the masked lookup and the reveal so they cannot disagree about which
-- account a ticket refers to.
--
--   * a reference resolves to the profile carrying it;
--   * a request id resolves to the signed-in account that filed it;
--   * both together must agree, otherwise the operator is looking at the wrong
--     account and gets a conflict instead of an answer.
--
-- Internal: revoked from every role. Only the two audited wrappers call it.
create or replace function public.support_resolve_account_id(
  p_ref text,
  p_request_id uuid
)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  v_ref text;
  v_request_user uuid;
  v_found boolean;
  v_account_id uuid;
begin
  if p_request_id is null and coalesce(btrim(p_ref), '') = '' then
    raise exception 'support_lookup_input_required' using errcode = '22023';
  end if;

  if p_request_id is not null then
    select user_id into v_request_user from public.cms_support_requests where id = p_request_id;
    if not found then
      raise exception 'support_request_not_found' using errcode = 'P0002';
    end if;
  end if;

  if coalesce(btrim(p_ref), '') <> '' then
    v_ref := public.normalize_account_ref(p_ref);
    if v_ref is null then
      raise exception 'support_account_ref_malformed' using errcode = '22023';
    end if;
    select p.id into v_account_id from public.profiles p where p.account_ref = v_ref;
    v_found := v_account_id is not null;
    if not v_found then
      raise exception 'support_account_not_found' using errcode = 'P0002';
    end if;
    if p_request_id is not null and v_request_user is not null and v_request_user <> v_account_id then
      raise exception 'support_account_ref_conflict' using errcode = '22023';
    end if;
    return v_account_id;
  end if;

  -- Reference absent: the ticket has to carry the account, and a ticket filed
  -- by a signed-out visitor carries none.
  if v_request_user is null then
    raise exception 'support_request_has_no_account' using errcode = 'P0002';
  end if;
  return v_request_user;
end;
$$;
revoke all on function public.support_resolve_account_id(text, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------- lookup --

create or replace function public.support_lookup_account(
  p_ref text default null,
  p_request_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  -- Well above what a human operator resolving tickets needs, well below what
  -- enumerating 40-bit references would take.
  c_rate_limit constant integer := 30;
  v_actor uuid := auth.uid();
  v_recent integer;
  v_account_id uuid;
  v_profile public.profiles%rowtype;
  v_email text;
  v_auth_email text;
  v_sub public.account_subscriptions%rowtype;
  v_usage public.usage_monthly%rowtype;
  v_request public.cms_support_requests%rowtype;
  v_devices integer := 0;
  v_request_count integer := 0;
  v_is_operator boolean := false;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not public.is_platform_admin() then
    raise exception 'support_lookup_forbidden' using errcode = '42501';
  end if;

  select count(*) into v_recent from public.admin_audit_events
   where actor_id = v_actor
     and action in ('support_account_lookup', 'support_account_reveal_email')
     and created_at > now() - interval '1 minute';
  if v_recent >= c_rate_limit then
    raise exception 'support_lookup_rate_limited' using errcode = '54000';
  end if;

  v_account_id := public.support_resolve_account_id(p_ref, p_request_id);

  select * into v_profile from public.profiles where id = v_account_id;
  if v_profile.id is null then
    raise exception 'support_account_not_found' using errcode = 'P0002';
  end if;

  -- `auth.users.email` is authoritative; `profiles.email` is a copy that can
  -- lag behind an address change. Which one answered is reported, so an
  -- operator never has to guess why the two disagree.
  select u.email into v_auth_email from auth.users u where u.id = v_account_id;
  v_email := coalesce(nullif(v_auth_email, ''), nullif(v_profile.email, ''));

  select * into v_sub from public.account_subscriptions where user_id = v_account_id;
  select * into v_usage from public.usage_monthly where user_id = v_account_id
   order by month_start desc limit 1;
  select count(*) into v_devices from public.business_backup_mirrors where user_id = v_account_id;
  select count(*) into v_request_count from public.cms_support_requests where user_id = v_account_id;
  select true into v_is_operator from public.platform_admins where user_id = v_account_id;

  if p_request_id is not null then
    select * into v_request from public.cms_support_requests where id = p_request_id;
  end if;

  -- Written before the payload leaves the function, so a resolution that
  -- returned data is never absent from the trail.
  insert into public.admin_audit_events (actor_id, action, target, details)
  values (
    v_actor,
    'support_account_lookup',
    v_profile.account_ref,
    jsonb_build_object(
      'account_id', v_account_id,
      'request_id', p_request_id,
      'matched_via', case when coalesce(btrim(p_ref), '') <> '' then 'reference' else 'request' end,
      'masked_view', true
    )
  );

  return jsonb_build_object(
    'account_ref', v_profile.account_ref,
    'name', v_profile.name,
    'email_masked', public.mask_email(v_email),
    'email_domain', nullif(split_part(v_email, '@', 2), ''),
    'email_source', case when nullif(v_auth_email, '') is not null then 'auth' else 'profile' end,
    'profile_email_stale', (
      nullif(v_auth_email, '') is not null
      and nullif(v_profile.email, '') is not null
      and lower(v_auth_email) <> lower(v_profile.email)
    ),
    'plan', coalesce(v_sub.plan::text, 'starter'),
    'plan_status', coalesce(v_sub.status::text, 'trialing'),
    'seats', coalesce(v_sub.seats, 1),
    'current_period_end', v_sub.current_period_end,
    'account_created_at', v_profile.created_at,
    'deletion_requested_at', v_profile.deletion_requested_at,
    'workspace_erased_at', v_profile.workspace_erased_at,
    'is_content_admin', coalesce(v_profile.is_admin, false),
    'is_platform_operator', coalesce(v_is_operator, false),
    'usage', case when v_usage.user_id is null then null else jsonb_build_object(
      'month_start', v_usage.month_start,
      'contacts_count', v_usage.contacts_count,
      'projects_count', v_usage.projects_count,
      'active_users', v_usage.active_users,
      'storage_bytes', v_usage.storage_bytes
    ) end,
    'cloud_backup_devices', v_devices,
    'support_request_count', v_request_count,
    'request', case when v_request.id is null then null else jsonb_build_object(
      'id', v_request.id,
      'name', v_request.name,
      'email', v_request.email,
      'subject', v_request.subject,
      'status', v_request.status,
      'category', v_request.category,
      'created_at', v_request.created_at,
      -- The verification step, computed rather than left to the eye: does the
      -- address in the ticket match the address the account actually uses?
      'email_matches_account', (
        nullif(v_email, '') is not null
        and lower(btrim(v_request.email)) = lower(v_email)
      )
    ) end
  );
end;
$$;
revoke all on function public.support_lookup_account(text, uuid) from public, anon;
grant execute on function public.support_lookup_account(text, uuid) to authenticated;

-- ------------------------------------------------------------------- reveal --

-- The single path to a full address, and the reason it is separate: the masked
-- view answers almost every support question, so the audit trail shows a full
-- address being disclosed far less often than the operator looks accounts up.
create or replace function public.support_reveal_account_email(
  p_ref text default null,
  p_request_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_recent integer;
  v_account_id uuid;
  v_profile public.profiles%rowtype;
  v_email text;
  v_request_email text;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not public.is_platform_admin() then
    raise exception 'support_lookup_forbidden' using errcode = '42501';
  end if;
  if not public.support_admin_mfa() then
    raise exception 'support_reveal_mfa_required' using errcode = '42501';
  end if;

  select count(*) into v_recent from public.admin_audit_events
   where actor_id = v_actor
     and action in ('support_account_lookup', 'support_account_reveal_email')
     and created_at > now() - interval '1 minute';
  if v_recent >= 30 then
    raise exception 'support_lookup_rate_limited' using errcode = '54000';
  end if;

  v_account_id := public.support_resolve_account_id(p_ref, p_request_id);

  select * into v_profile from public.profiles where id = v_account_id;
  if v_profile.id is null then
    raise exception 'support_account_not_found' using errcode = 'P0002';
  end if;

  select u.email into v_email from auth.users u where u.id = v_account_id;
  if nullif(v_email, '') is null then
    v_email := nullif(v_profile.email, '');
  end if;

  insert into public.admin_audit_events (actor_id, action, target, details)
  values (
    v_actor,
    'support_account_reveal_email',
    v_profile.account_ref,
    jsonb_build_object(
      'account_id', v_account_id,
      'request_id', p_request_id,
      'matched_via', case when coalesce(btrim(p_ref), '') <> '' then 'reference' else 'request' end,
      'masked_view', false
    )
  );

  if p_request_id is not null then
    select s.email into v_request_email from public.cms_support_requests s where s.id = p_request_id;
  end if;

  return jsonb_build_object(
    'account_ref', v_profile.account_ref,
    'email', v_email,
    'request_email', v_request_email,
    'email_matches_request', (
      v_email is not null
      and v_request_email is not null
      and lower(btrim(v_request_email)) = lower(v_email)
    )
  );
end;
$$;
revoke all on function public.support_reveal_account_email(text, uuid) from public, anon;
grant execute on function public.support_reveal_account_email(text, uuid) to authenticated;

-- ------------------------------------------------------------- operator view --

-- What an operator may see of the support trail itself. `platform_admins` can
-- already read `cms_support_requests`; this adds the join an operator actually
-- needs — the reference and the masked address behind each ticket — without
-- widening access to anything else.
create or replace function public.support_inbox()
returns table (
  id uuid,
  category text,
  name text,
  email text,
  subject text,
  status text,
  created_at timestamptz,
  account_ref text,
  account_email_masked text,
  email_matches_account boolean
)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not public.is_platform_admin() then
    raise exception 'support_lookup_forbidden' using errcode = '42501';
  end if;

  return query
  select s.id, s.category, s.name, s.email, s.subject, s.status, s.created_at,
         p.account_ref,
         public.mask_email(coalesce(nullif(u.email, ''), nullif(p.email, ''))),
         (
           coalesce(nullif(u.email, ''), nullif(p.email, '')) is not null
           and lower(btrim(s.email)) = lower(coalesce(nullif(u.email, ''), nullif(p.email, '')))
         )
    from public.cms_support_requests s
    left join public.profiles p on p.id = s.user_id
    left join auth.users u on u.id = s.user_id
   order by s.created_at desc
   limit 500;
end;
$$;
revoke all on function public.support_inbox() from public, anon;
grant execute on function public.support_inbox() to authenticated;
