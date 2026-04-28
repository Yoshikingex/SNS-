-- Phase 2-1 #security
-- public.users (auth.users.id を FK 参照する拡張テーブル)

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

-- RLS 有効化
alter table public.users enable row level security;

-- ポリシー: 本人のみ SELECT 可能
create policy "users_select_self"
  on public.users
  for select
  using (auth.uid() = id);

-- ポリシー: 本人のみ UPDATE 可能（plan 等の更新を許可）
create policy "users_update_self"
  on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- INSERT/DELETE は trigger 経由のみ（直接の policy なし = 拒否）

-- auth.users INSERT 時に public.users を自動作成するトリガ
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
