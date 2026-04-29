# DATA_SPEC.md

## Phase 3-1: 投稿系テーブル仕様

### 全体像

```
auth.users (Supabase Auth)
  └─ public.users (Phase 2-1)
       ├─ public.posts (1:N)
       │    └─ public.post_targets (1:N)
       └─ public.sns_accounts (1:N)
```

すべてのテーブルは **RLS 有効**、`auth.uid()` ベースで本人のみ CRUD 可能。

---

## テーブル定義

### `public.posts` — 投稿の共通本文

| カラム | 型 | 必須 | 既定値 | 備考 |
|---|---|---|---|---|
| `id` | uuid | ✓ | gen_random_uuid() | PK |
| `user_id` | uuid | ✓ | - | FK → public.users(id) ON DELETE CASCADE |
| `body_common` | text | ✓ | - | 全SNS共通の投稿本文 |
| `images` | jsonb | ✓ | `[]` | `ImageItem[]` 形式（後述） |
| `status` | text | ✓ | `'pending'` | `'pending' \| 'success' \| 'failed'` |
| `created_at` | timestamptz | ✓ | now() | |

**`ImageItem` JSON スキーマ**:
```json
{ "url": "https://...", "width": 1024, "height": 768 }
```

### `public.post_targets` — 投稿先プラットフォーム別の状態

| カラム | 型 | 必須 | 既定値 | 備考 |
|---|---|---|---|---|
| `id` | uuid | ✓ | gen_random_uuid() | PK |
| `post_id` | uuid | ✓ | - | FK → public.posts(id) ON DELETE CASCADE |
| `platform` | text | ✓ | - | `'x' \| 'bluesky' \| 'relaxy' \| '02'` |
| `status` | text | ✓ | `'pending'` | `'pending' \| 'success' \| 'failed'` |
| `error_message` | text | - | NULL | 失敗時の理由 |
| `posted_at` | timestamptz | - | NULL | 成功時刻 |
| `external_post_url` | text | - | NULL | 投稿先のURL |

**所有判定**: `user_id` を持たず、`posts.user_id` 経由で RLS 判定する。

### `public.sns_accounts` — ユーザーが連携した SNS アカウント

| カラム | 型 | 必須 | 既定値 | 備考 |
|---|---|---|---|---|
| `id` | uuid | ✓ | gen_random_uuid() | PK |
| `user_id` | uuid | ✓ | - | FK → public.users(id) ON DELETE CASCADE |
| `platform` | text | ✓ | - | `'x' \| 'bluesky' \| 'relaxy' \| '02'` |
| `account_name` | text | ✓ | - | 表示用（@handle 等） |
| `encrypted_credentials` | text | ✓ | - | Phase 2-2 の `crypto.ts` で AES-256-GCM 暗号化済の文字列 |
| `is_active` | boolean | ✓ | true | 一時停止用フラグ |

---

## RLS ポリシー

### `posts` / `sns_accounts`（user_id を持つテーブル）
4 種すべて **`auth.uid() = user_id`** で制限：
- SELECT
- INSERT (with check)
- UPDATE (using + with check)
- DELETE

### `post_targets`（user_id を持たない）
4 種すべて **posts 経由のサブクエリ**で制限：
```sql
exists (
  select 1 from public.posts
  where posts.id = post_targets.post_id
    and posts.user_id = auth.uid()
)
```

→ 自分の posts に紐付く post_targets のみ操作可能。

---

## マイグレーション適用方法

1. Supabase Dashboard → 左サイドバー「**SQL Editor**」 → 「**+ New query**」
2. [supabase/migrations/0002_posts.sql](supabase/migrations/0002_posts.sql) の中身を**全文コピペ**
3. 「**Run**」をクリック
4. 「**Success. No rows returned**」表示で完了

---

## RLS 動作確認手順（Done 条件②: 別ユーザーのデータが取得できないこと）

### 準備: 2人のテストユーザーを作成
1. Authentication → Users → **Add user** → Create new user
   - Email: `userA@test.com` / Password: `Test1234!` / Auto Confirm: ✅
2. もう一度 Add user
   - Email: `userB@test.com` / Password: `Test1234!` / Auto Confirm: ✅
3. 各ユーザーの **UID** を控える（一覧の UID 列）

### Test 1: ユーザーA として posts を1件作成
SQL Editor で実行（`<userA-uid>` を実際の UID に置換）:
```sql
-- ユーザーA を擬似的に偽装するため、JWT を直接設定
select set_config('request.jwt.claims', '{"sub":"<userA-uid>","role":"authenticated"}', true);
set local role authenticated;

insert into public.posts (user_id, body_common)
values ('<userA-uid>', 'これはユーザーAの投稿');

select id, body_common from public.posts;  -- → 1件返る（自分の投稿）
```

### Test 2: ユーザーB に切り替えて SELECT
```sql
select set_config('request.jwt.claims', '{"sub":"<userB-uid>","role":"authenticated"}', true);
set local role authenticated;

select id, body_common from public.posts;  -- → 0 件（ユーザーAの投稿は見えない）✅
```

### Test 3: ユーザーB から強制 INSERT を試行（RLS で拒否されるはず）
```sql
insert into public.posts (user_id, body_common)
values ('<userA-uid>', 'なりすまし投稿');  -- → エラー: new row violates row-level security policy ✅
```

### Test 4: 認証なし（anon）で SELECT
```sql
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select id from public.posts;  -- → 0件 ✅
```

**4つすべての挙動が期待通りなら RLS 正常**。

---

## TypeScript 型自動生成（任意 / Phase 4 以降に推奨）

現状は手書き型 [`packages/shared/src/db.ts`](packages/shared/src/db.ts) を使用しています。
Supabase スキーマと完全同期させたい場合は Supabase CLI で生成可能：

### 1. Supabase CLI インストール
```powershell
# pnpm dlx で都度実行する場合（インストール不要）
pnpm dlx supabase --version

# またはグローバルインストール
npm i -g supabase
```

### 2. 型生成コマンド
```powershell
pnpm dlx supabase gen types typescript --project-id pfdjajckhvnxgetcmieh > packages/shared/src/db.ts
```

実行すると `packages/shared/src/db.ts` が自動生成版で上書きされます。

### 3. 認証
初回は `pnpm dlx supabase login` でブラウザ認証が必要です。

---

## 次フェーズへの引き継ぎ事項

- **Phase 3-2**: `dom_selectors` テーブル追加（同様パターンで RLS）
- **Phase 4**: `apps/web` から Supabase クライアント経由で CRUD、`encrypted_credentials` は `crypto.ts` で暗号化保存
- **Phase 7**: 監査ログテーブル `audit_logs` を追加、各 CRUD イベントを Supabase の Database Functions で自動記録
