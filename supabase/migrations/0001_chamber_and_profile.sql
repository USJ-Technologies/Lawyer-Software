create table chamber (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table profile (
  id uuid primary key references auth.users(id) on delete cascade,
  chamber_id uuid not null references chamber(id) on delete cascade,
  email text not null,
  role text not null default 'owner' check (role in ('owner', 'junior', 'clerk')),
  created_at timestamptz not null default now()
);

create index profile_chamber_id_idx on profile(chamber_id);
