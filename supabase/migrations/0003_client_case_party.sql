create table client (
  id uuid primary key default gen_random_uuid(),
  chamber_id uuid not null references chamber(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now()
);
create index client_chamber_id_idx on client(chamber_id);

create table "case" (
  id uuid primary key default gen_random_uuid(),
  chamber_id uuid not null references chamber(id) on delete cascade,
  client_id uuid not null references client(id) on delete restrict,
  case_type_id uuid not null references case_type(id),
  court_id uuid not null references court(id),
  title text not null,
  case_number text,
  cnr text,
  stage text not null default 'filed' check (stage in ('filed', 'listed', 'heard', 'disposed')),
  status text not null default 'active' check (status in ('active', 'disposed')),
  sync_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint cnr_format check (cnr is null or cnr ~ '^[A-Za-z0-9]{16}$')
);
create index case_chamber_id_idx on "case"(chamber_id);
create index case_cnr_idx on "case"(cnr) where cnr is not null;

create table party (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references "case"(id) on delete cascade,
  name text not null,
  role text not null check (role in ('petitioner', 'respondent', 'opposing_counsel', 'other'))
);
create index party_case_id_idx on party(case_id);
