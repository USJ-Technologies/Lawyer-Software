create table hearing (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references "case"(id) on delete cascade,
  date date not null,
  purpose text,
  source text not null check (source in ('manual', 'cnr_sync')),
  outcome text,
  next_action text,
  created_at timestamptz not null default now()
);
create index hearing_case_id_idx on hearing(case_id);
create index hearing_date_idx on hearing(date);

create table reminder (
  id uuid primary key default gen_random_uuid(),
  hearing_id uuid not null references hearing(id) on delete cascade,
  remind_at timestamptz not null,
  channel text not null default 'in_app' check (channel in ('in_app', 'push')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  sent_at timestamptz
);
create index reminder_due_idx on reminder(remind_at) where status = 'pending';
