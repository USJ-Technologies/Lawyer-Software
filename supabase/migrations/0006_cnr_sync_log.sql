create table cnr_sync_log (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references "case"(id) on delete cascade,
  fetched_at timestamptz not null default now(),
  raw_payload jsonb,
  parsed_next_date date,
  status text not null check (status in ('updated', 'unchanged', 'failed'))
);
create index cnr_sync_log_case_id_idx on cnr_sync_log(case_id);
