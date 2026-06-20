alter table document
  add column category text not null default 'other'
    check (category in ('petition', 'affidavit', 'order', 'evidence', 'correspondence', 'other')),
  add column mime_type text,
  add column size_bytes bigint;

alter table document alter column label drop not null;
