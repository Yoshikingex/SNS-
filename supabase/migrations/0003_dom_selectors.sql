-- Phase 3-2 #data
-- dom_selectors: 業界SNSのDOM変更に追従するためのセレクタDB管理
--   read: authenticated すべて
--   write: users.plan = 'admin' のみ

create table if not exists public.dom_selectors (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('relaxy', '02')),
  field_name text not null,
  selector text not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null,
  unique (platform, field_name, version)
);

alter table public.dom_selectors enable row level security;

-- SELECT: authenticated 全員可
create policy "dom_selectors_select_authenticated"
  on public.dom_selectors for select
  to authenticated
  using (true);

-- INSERT: admin のみ
create policy "dom_selectors_insert_admin"
  on public.dom_selectors for insert
  to authenticated
  with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.plan = 'admin'
    )
  );

-- UPDATE: admin のみ
create policy "dom_selectors_update_admin"
  on public.dom_selectors for update
  to authenticated
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.plan = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.plan = 'admin'
    )
  );

-- DELETE: admin のみ
create policy "dom_selectors_delete_admin"
  on public.dom_selectors for delete
  to authenticated
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.plan = 'admin'
    )
  );

-- 初期データ（仮値、Phase 5 で実値確定）
insert into public.dom_selectors (platform, field_name, selector, version) values
  ('relaxy', 'post_body',     'textarea[name="body"]',  1),
  ('relaxy', 'image_upload',  'input[type="file"]',     1),
  ('relaxy', 'submit_button', 'button[type="submit"]',  1),
  ('02',     'post_body',     '#post-body',             1),
  ('02',     'image_upload',  '#image-upload',          1),
  ('02',     'submit_button', '#submit-btn',            1)
on conflict (platform, field_name, version) do nothing;
