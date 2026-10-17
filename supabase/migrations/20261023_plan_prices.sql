-- Published monthly prices in MAD. Existing activation periods are unchanged.
-- Business is the legacy name for the public Boost/Team tier.
begin;
update public.plan_catalog
set monthly_price = case when code::text = 'pro' then 79 else 250 end,
    updated_at = now()
where code::text in ('pro', 'boost', 'business');
commit;
