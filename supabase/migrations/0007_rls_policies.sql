alter table chamber enable row level security;
alter table profile enable row level security;
alter table client enable row level security;
alter table "case" enable row level security;
alter table party enable row level security;
alter table hearing enable row level security;
alter table reminder enable row level security;
alter table document enable row level security;
alter table note enable row level security;
alter table cnr_sync_log enable row level security;

-- Helper: the chamber_id of the calling user
create function auth_chamber_id() returns uuid
language sql security definer stable as $$
  select chamber_id from profile where id = auth.uid()
$$;

create policy "own chamber" on chamber
  for select using (id = auth_chamber_id());

create policy "own profile row" on profile
  for select using (chamber_id = auth_chamber_id());

create policy "chamber rw client" on client
  for all using (chamber_id = auth_chamber_id()) with check (chamber_id = auth_chamber_id());

create policy "chamber rw case" on "case"
  for all using (chamber_id = auth_chamber_id()) with check (chamber_id = auth_chamber_id());

create policy "chamber rw party" on party
  for all using (
    case_id in (select id from "case" where chamber_id = auth_chamber_id())
  ) with check (
    case_id in (select id from "case" where chamber_id = auth_chamber_id())
  );

create policy "chamber rw hearing" on hearing
  for all using (
    case_id in (select id from "case" where chamber_id = auth_chamber_id())
  ) with check (
    case_id in (select id from "case" where chamber_id = auth_chamber_id())
  );

create policy "chamber rw reminder" on reminder
  for all using (
    hearing_id in (
      select h.id from hearing h join "case" c on c.id = h.case_id
      where c.chamber_id = auth_chamber_id()
    )
  ) with check (
    hearing_id in (
      select h.id from hearing h join "case" c on c.id = h.case_id
      where c.chamber_id = auth_chamber_id()
    )
  );

create policy "chamber rw document" on document
  for all using (chamber_id = auth_chamber_id()) with check (chamber_id = auth_chamber_id());

create policy "chamber rw note" on note
  for all using (
    case_id in (select id from "case" where chamber_id = auth_chamber_id())
  ) with check (
    case_id in (select id from "case" where chamber_id = auth_chamber_id())
  );

create policy "chamber rw cnr_sync_log" on cnr_sync_log
  for all using (
    case_id in (select id from "case" where chamber_id = auth_chamber_id())
  ) with check (
    case_id in (select id from "case" where chamber_id = auth_chamber_id())
  );
