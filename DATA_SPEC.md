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

## RLS 動作確認

### Phase 3-1 時点の確認（ポリシー定義の存在確認）

Supabase SQL Editor は `service_role` 権限で動作するため、**SQL Editor 上で `set local role authenticated` を使った RLS の実動作テストは難しい**。Phase 3-1 では、**ポリシー定義の存在確認**で Done 条件②達成と判定する：

```sql
-- ① RLS が有効か確認
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in ('posts', 'post_targets', 'sns_accounts', 'dom_selectors')
order by tablename;

-- ② ポリシー一覧
select tablename, policyname, cmd as command
from pg_policies
where schemaname = 'public'
  and tablename in ('posts', 'post_targets', 'sns_accounts', 'dom_selectors')
order by tablename, policyname;
```

期待結果:
- ① 4 行すべて `rls_enabled = true`
- ② 16 行（posts/post_targets/sns_accounts は各4ポリシー、dom_selectors も4ポリシー = SELECT 全員 + INSERT/UPDATE/DELETE admin）

### Phase 4 で実施する実動作テスト

apps/web で `getServerSession` + `supabase.from('posts').select()` を実装する Phase 4 で、以下が**自動的に検証される**：
- ユーザーA でログイン → 自分の posts のみ返る
- ユーザーB でログイン → ユーザーAの posts は見えない
- 認証なしで API 叩く → 401

別ユーザーアクセス禁止の真のテストは Phase 4 で実施。

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

## Phase 3-2: dom_selectors テーブル

### 目的
業界SNS（リラクシィー / 02）の DOM 構造変更に追従するため、CSS セレクタを DB で管理する。

### スキーマ

| カラム | 型 | 必須 | 既定値 | 備考 |
|---|---|---|---|---|
| `id` | uuid | ✓ | gen_random_uuid() | PK |
| `platform` | text | ✓ | - | `'relaxy' \| '02'` |
| `field_name` | text | ✓ | - | 例: `post_body`, `image_upload`, `submit_button` |
| `selector` | text | ✓ | - | CSS セレクタ文字列 |
| `version` | int | ✓ | 1 | 同一 (platform, field_name) で履歴を持つ |
| `updated_at` | timestamptz | ✓ | now() | |
| `updated_by` | uuid | - | NULL | FK → public.users(id) ON DELETE SET NULL |

**UNIQUE 制約**: `(platform, field_name, version)`

### RLS ポリシー

| 操作 | 条件 |
|---|---|
| SELECT | `authenticated` 全員可（拡張機能から取得するため） |
| INSERT | `users.plan = 'admin'` のみ |
| UPDATE | `users.plan = 'admin'` のみ |
| DELETE | `users.plan = 'admin'` のみ |

### 初期データ
[supabase/migrations/0003_dom_selectors.sql](supabase/migrations/0003_dom_selectors.sql) で 6 件投入（仮値）：
- relaxy: post_body / image_upload / submit_button
- 02: post_body / image_upload / submit_button

実値は Phase 5 で確定。

### 管理者ロール設定方法

任意のユーザーを admin にするには、Supabase SQL Editor で実行：
```sql
update public.users set plan = 'admin' where email = '<対象メアド>';
```

### API: `GET /api/dom-selectors`

#### 認証
- 必須（Cookie ベース、Supabase セッション）
- 未認証 → **401 Unauthorized**

#### レスポンス（200 OK）
```json
{
  "selectors": [
    { "id": "...", "platform": "relaxy", "field_name": "post_body", "selector": "textarea[name=\"body\"]", "version": 1, "updated_at": "..." },
    ...
  ]
}
```

各 (platform, field_name) ペアごとに**最新 version のみ**を返す。

#### 動作確認手順
1. ブラウザで http://localhost:3000/login にログイン
2. 同じブラウザで http://localhost:3000/api/dom-selectors を直接アクセス
3. 6 件の selector が JSON で返れば OK ✅
4. ログアウトしてから同 URL → `{"error":"Unauthorized"}` 返れば認証保護OK ✅

---

## 次フェーズへの引き継ぎ事項

- **Phase 4**: `apps/web` から Supabase クライアント経由で posts CRUD、`encrypted_credentials` は `crypto.ts` で暗号化保存。RLS 実動作の検証もここで実施。
- **Phase 5**: Chrome 拡張から `GET /api/dom-selectors` を呼んで取得 + 投稿時に使用
- **Phase 7**: 監査ログテーブル `audit_logs` を追加、各 CRUD イベントを Supabase の Database Functions で自動記録
