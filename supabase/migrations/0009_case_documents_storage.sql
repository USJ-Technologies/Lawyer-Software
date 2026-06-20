-- Task 10's case-documents storage bucket + RLS policy. Originally applied
-- directly via the Studio/SQL editor since it depends on the bucket existing
-- first; captured here as a migration so a fresh environment's `supabase db
-- push` reproduces the same private bucket and chamber-scoped access policy
-- instead of silently missing it.

insert into storage.buckets (id, name, public)
values ('case-documents', 'case-documents', false)
on conflict (id) do nothing;

create policy "chamber rw case documents"
on storage.objects for all
using (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth_chamber_id()::text)
with check (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth_chamber_id()::text);
