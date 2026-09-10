-- Standalone copy of the onboarding section already appended to
-- supabase/schema.sql — this project doesn't use the Supabase CLI
-- migration workflow (see SUPABASE_OPERATIONS.md: the whole schema.sql
-- is pasted into the Supabase SQL Editor as one script). This file
-- exists purely so you can run *just* the new onboarding piece against
-- a database that already has the rest of schema.sql applied, without
-- re-running the whole thing.

-- ---------------------------------------------------------------------------
-- Onboarding: one-time "welcome" questionnaire
--
-- Shown the first time a user reaches the dashboard after creating an
-- account. Three questions: where they heard about Fatorati, what kind
-- of activity they run, and whether they want update notifications.
--
-- Deliberately NOT auto-created by `handle_new_user()` the way `profiles`
-- and `company_settings` are: the presence of a row here is itself the
-- "has this user been onboarded?" flag the frontend checks on sign-in.
-- An auto-inserted default row would defeat that — there would be no way
-- to tell "answered" apart from "never asked".

do $$ begin
  create type public.referral_source as enum (
    'google_search',
    'social_media',
    'word_of_mouth',
    'online_ad',
    'blog_article',
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.business_profile as enum (
    'small_company',
    'self_employed',
    'professional',
    'tradesperson',
    'individual'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.onboarding_responses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  referral_source public.referral_source not null,
  referral_source_other text not null default '' check (char_length(referral_source_other) <= 200),
  business_profile public.business_profile not null,
  wants_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_onboarding_responses_updated_at on public.onboarding_responses;
create trigger set_onboarding_responses_updated_at
before update on public.onboarding_responses
for each row execute function public.set_updated_at();

alter table public.onboarding_responses enable row level security;

drop policy if exists onboarding_responses_select_own on public.onboarding_responses;
drop policy if exists onboarding_responses_insert_own on public.onboarding_responses;
drop policy if exists onboarding_responses_update_own on public.onboarding_responses;
drop policy if exists onboarding_responses_delete_own on public.onboarding_responses;
create policy onboarding_responses_select_own on public.onboarding_responses
for select to authenticated using (user_id = auth.uid());
create policy onboarding_responses_insert_own on public.onboarding_responses
for insert to authenticated with check (user_id = auth.uid());
create policy onboarding_responses_update_own on public.onboarding_responses
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy onboarding_responses_delete_own on public.onboarding_responses
for delete to authenticated using (user_id = auth.uid());

-- Explicit grant needed: this table is created after the schema's initial
-- blanket `grant ... on all tables in schema public to authenticated`,
-- which only covers tables that already existed at that point — same
-- reasoning as `posts` and the SaaS-control-layer tables above it.
grant select, insert, update, delete on public.onboarding_responses to authenticated;
