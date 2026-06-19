create table document (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references "case"(id) on delete cascade,
  chamber_id uuid not null references chamber(id) on delete cascade,
  storage_ref text not null,
  label text not null,
  uploaded_by uuid not null references profile(id),
  created_at timestamptz not null default now()
);
create index document_case_id_idx on document(case_id);

create table note (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references "case"(id) on delete cascade,
  body text not null,
  author uuid not null references profile(id),
  created_at timestamptz not null default now()
);
create index note_case_id_idx on note(case_id);
