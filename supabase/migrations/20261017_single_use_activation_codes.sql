-- Phase 1 of the single-use activation-key rollout.
--
-- IMPORTANT: this migration must be applied and committed by itself before
-- running 20261018_activation_key_security.sql. PostgreSQL permits ADD VALUE
-- in a transaction, but the new enum label cannot be used until that
-- transaction commits. Keep all use of 'boost' (including plan_catalog rows)
-- in the next migration.

create extension if not exists pgcrypto;

alter type public.subscription_plan add value if not exists 'boost';
