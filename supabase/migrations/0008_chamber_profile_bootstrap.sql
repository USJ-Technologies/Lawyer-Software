-- Task 5's RLS migration enabled RLS on chamber/profile with only `select`
-- policies, which (correctly, per Postgres RLS default-deny) blocks the
-- signup page's direct client-side `insert into chamber` / `insert into
-- profile` calls.
--
-- A naive fix -- adding a client-writable INSERT policy on profile such as
-- `with check (id = auth.uid())` -- is a critical security bug: it puts no
-- constraint on chamber_id. Any signed-up user could set chamber_id to ANY
-- existing chamber's UUID in their profile insert and instantly gain full
-- read/write access to that law firm's confidential clients, cases, and
-- documents via the "chamber rw ..." policies from 0007 (which key off
-- profile.chamber_id). That is a complete cross-tenant breach.
--
-- The safe approach: bootstrap (chamber creation + the caller's own profile
-- row) happens atomically inside a single `security definer` function. The
-- function always creates a brand-new chamber -- callers cannot pass an
-- existing chamber_id -- and refuses if the caller already has a profile
-- (preventing re-bootstrap / hijacking a second chamber). No direct
-- client-writable INSERT policy is added to chamber or profile; this RPC is
-- the only sanctioned write path for chamber/profile creation.

create function create_chamber_and_profile(p_chamber_name text)
returns table (chamber_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chamber_id uuid;
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from profile where id = v_uid) then
    raise exception 'profile already exists for this user';
  end if;

  if p_chamber_name is null or length(trim(p_chamber_name)) = 0 then
    raise exception 'chamber name is required';
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into chamber (name) values (p_chamber_name) returning id into v_chamber_id;

  insert into profile (id, chamber_id, email) values (v_uid, v_chamber_id, v_email);

  return query select v_chamber_id;
end;
$$;

revoke all on function create_chamber_and_profile(text) from public;
grant execute on function create_chamber_and_profile(text) to authenticated;
