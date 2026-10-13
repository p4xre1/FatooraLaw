-- Apply from Supabase's SQL Editor as a trusted database operator.
-- RLS checks which ROW a user can change, not which COLUMNS. Allowing a
-- self-update of profiles.is_admin would bypass every CMS posts policy.
-- Auth's handle_new_user() creates profiles; users only edit their name.
begin;

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_delete_own on public.profiles;

revoke insert, update, delete on public.profiles from public, anon, authenticated;
-- Clear pre-existing column grants too (revoking a table grant alone does
-- not revoke column-level privileges from an older/custom installation).
do $$ declare columns text; begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into columns
    from pg_attribute
   where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke insert (%s), update (%s) on public.profiles from public, anon, authenticated', columns, columns);
end $$;

grant select on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;
-- Existing profiles_select_own / profiles_update_own policies still restrict
-- reads and permitted name updates to auth.uid(). Admin flags/roles/email
-- remain writable only by trusted SQL operators / the service role.

commit;
