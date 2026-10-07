-- Klong Phai Farm Marketing Director Secretary: database setup.
-- Paste this whole file once into Supabase: SQL Editor, New query, Run.
-- Every table uses row-level security: a logged-in user can only read and change their own rows.

-- 1. The user's entries (tasks, meetings, customers, campaigns, content, issues, approvals, documents).
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- updated_at changes on every save, so a save from another device is noticed instead of overwritten.
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_data_touch on public.user_data;
create trigger user_data_touch before update on public.user_data
for each row execute function public.touch_updated_at();

alter table public.user_data enable row level security;
drop policy if exists "own entries" on public.user_data;
create policy "own entries" on public.user_data for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 2. Monthly reports, read once when uploaded (one per month).
create table if not exists public.reports (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (id ~ '^\d{4}-\d{2}$'),
  file_name text not null,
  file_path text not null,
  report jsonb not null,
  uploaded_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.reports enable row level security;
drop policy if exists "own reports" on public.reports;
create policy "own reports" on public.reports for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 3. Private storage for the uploaded Word files, one folder per user ({user id}/file.docx), max 10 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 10485760, array['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "own report files: read" on storage.objects;
create policy "own report files: read" on storage.objects for select to authenticated
  using (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "own report files: add" on storage.objects;
create policy "own report files: add" on storage.objects for insert to authenticated
  with check (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "own report files: remove" on storage.objects;
create policy "own report files: remove" on storage.objects for delete to authenticated
  using (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text);
