-- Phase 6-2 修正: Chrome MV3 拡張の Service Worker から認証 Cookie が送られない制約に対応
-- dom_selectors の SELECT を anon にも許可する
-- INSERT/UPDATE/DELETE は引き続き admin のみ（変更なし）

-- 既存の authenticated only ポリシーを削除
drop policy if exists "dom_selectors_select_authenticated" on public.dom_selectors;

-- anon + authenticated 両方に SELECT を許可
create policy "dom_selectors_select_public"
  on public.dom_selectors for select
  to anon, authenticated
  using (true);
