-- Phase 3-1 #data
-- posts / post_targets / sns_accounts の3テーブル + RLS

-- ======================================================================
-- posts: 投稿の共通本文・添付画像・ステータス
-- ======================================================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  body_common text not null,
  images jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "posts_select_own"
  on public.posts for select
  using (auth.uid() = user_id);

create policy "posts_insert_own"
  on public.posts for insert
  with check (auth.uid() = user_id);

create policy "posts_update_own"
  on public.posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "posts_delete_own"
  on public.posts for delete
  using (auth.uid() = user_id);

-- ======================================================================
-- post_targets: 投稿先プラットフォーム別の状態（X / Bluesky / リラクシィー / 02）
--   user_id は持たず、posts 経由で所有判定する
-- ======================================================================
create table if not exists public.post_targets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  platform text not null
    check (platform in ('x', 'bluesky', 'relaxy', '02')),
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed')),
  error_message text,
  posted_at timestamptz,
  external_post_url text
);

alter table public.post_targets enable row level security;

-- posts.user_id 経由で所有判定する RLS（4種ともサブクエリで揃える）
create policy "post_targets_select_own"
  on public.post_targets for select
  using (
    exists (
      select 1 from public.posts
      where posts.id = post_targets.post_id
        and posts.user_id = auth.uid()
    )
  );

create policy "post_targets_insert_own"
  on public.post_targets for insert
  with check (
    exists (
      select 1 from public.posts
      where posts.id = post_targets.post_id
        and posts.user_id = auth.uid()
    )
  );

create policy "post_targets_update_own"
  on public.post_targets for update
  using (
    exists (
      select 1 from public.posts
      where posts.id = post_targets.post_id
        and posts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.posts
      where posts.id = post_targets.post_id
        and posts.user_id = auth.uid()
    )
  );

create policy "post_targets_delete_own"
  on public.post_targets for delete
  using (
    exists (
      select 1 from public.posts
      where posts.id = post_targets.post_id
        and posts.user_id = auth.uid()
    )
  );

-- ======================================================================
-- sns_accounts: ユーザーが連携した SNS アカウント情報
--   encrypted_credentials は packages/shared/src/crypto.ts (Phase 2-2) で
--   AES-256-GCM 暗号化した文字列を保存（Phase 4 で実装）
-- ======================================================================
create table if not exists public.sns_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null
    check (platform in ('x', 'bluesky', 'relaxy', '02')),
  account_name text not null,
  encrypted_credentials text not null,
  is_active boolean not null default true
);

alter table public.sns_accounts enable row level security;

create policy "sns_accounts_select_own"
  on public.sns_accounts for select
  using (auth.uid() = user_id);

create policy "sns_accounts_insert_own"
  on public.sns_accounts for insert
  with check (auth.uid() = user_id);

create policy "sns_accounts_update_own"
  on public.sns_accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sns_accounts_delete_own"
  on public.sns_accounts for delete
  using (auth.uid() = user_id);
