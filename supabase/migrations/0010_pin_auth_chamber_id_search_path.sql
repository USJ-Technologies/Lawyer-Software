-- Final whole-branch review (Phase 1 sign-off) flagged that auth_chamber_id(),
-- the security definer function every tenant-isolation RLS policy depends on,
-- had no pinned search_path -- unlike create_chamber_and_profile (0008), which
-- already does. A mutable search_path on a security definer function is a
-- known Postgres privilege-escalation vector (a malicious schema earlier in
-- the caller's search_path could shadow `profile` or `chamber_id`). Pin it
-- the same way 0008 already does, with no change in behavior.

create or replace function auth_chamber_id() returns uuid
language sql security definer stable
set search_path = public
as $$
  select chamber_id from profile where id = auth.uid()
$$;
