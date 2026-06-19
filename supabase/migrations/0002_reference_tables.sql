create table case_type (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null
);

create table court (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text not null check (level in ('district', 'high_court', 'supreme_court', 'tribunal')),
  state text
);
