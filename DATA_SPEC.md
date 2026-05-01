# DATA_SPEC.md

Matomell のデータベーススキーマ・マイグレーション仕様。

---

## ER 概要

```
auth.users (Supabase Auth 管理)
   │
   ▼ on insert trigger
public.users
   ├─ public.posts (1:N)
   │     └─ public.post_targets (1:N)
   └─ public.sns_accounts (1:N)

public.dom_selectors  (admin 管理 / 拡張機能から anon SELECT)
```

すべての user 紐付きテーブルは **RLS 有効**、`auth.uid()` ベースで本人のみ CRUD。

---

## テーブル定義

### `public.users` — ユーザープロフィール

| カラム | 型 | 必須 | 既定値 | 備考 |
|---|---|---|---|---|
| `id` | uuid | ✓ | - | PK / `auth.users.id` と同値 |
| `email` | text | ✓ | - | UNIQUE |
| `plan` | text | ✓ | `'free'` | `'free' \| 'admin'` |
| `created_at` | timestamptz | ✓ | now() | |

`auth.users` への INSERT トリガで自動生成。

### `public.posts` — 投稿の共通本文

| カラム | 型 | 必須 | 既定値 | 備考 |
|---|---|---|---|---|
| `id` | uuid | ✓ | gen_random_uuid() | PK |
| `user_id` | uuid | ✓ | - | FK → public.users(id) ON DELETE CASCADE |
| `body_common` | text | ✓ | - | 全SNS共通の投稿本文 |
| `images` | jsonb | ✓ | `[]` | `ImageItem[]`（後述） |
| `status` | text | ✓ | `'pending'` | `'pending' \| 'success' \| 'failed'` |
| `created_at` | timestamptz | ✓ | now() | |

`ImageItem`:
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

所有判定は `posts.user_id` 経由（後述 RLS）。

### `public.sns_accounts` — SNS 連携情報

| カラム | 型 | 必須 | 既定値 | 備考 |
|---|---|---|---|---|
| `id` | uuid | ✓ | gen_random_uuid() | PK |
| `user_id` | uuid | ✓ | - | FK → public.users(id) ON DELETE CASCADE |
| `platform` | text | ✓ | - | `'x' \| 'bluesky' \| 'relaxy' \| '02'` |
| `account_name` | text | ✓ | - | 表示用（@handle 等） |
| `encrypted_credentials` | text | ✓ | - | AES-256-GCM 暗号化（`packages/shared/src/crypto.ts`） |
| `is_active` | boolean | ✓ | true | 一時停止フラグ |

UNIQUE: `(user_id, platform)`

`encrypted_credentials` の中身（プラットフォーム別）:
- **x**: `{ access_token, refresh_token, scope, expires_at, twitter_user_id }`
- **bluesky**: `{ identifier, app_password }`
- リラクシィー / 02 は連携情報を持たない（ブラウザ Cookie / 拡張機能が直接ログイン状態を利用）

### `public.dom_selectors` — 業界SNS の DOM セレクタ管理

| カラム | 型 | 必須 | 既定値 | 備考 |
|---|---|---|---|---|
| `id` | uuid | ✓ | gen_random_uuid() | PK |
| `platform` | text | ✓ | - | `'relaxy' \| '02'` |
| `field_name` | text | ✓ | - | 例: `post_body`, `image_upload`, `submit_button` |
| `selector` | text | ✓ | - | CSS セレクタ |
| `version` | int | ✓ | 1 | 同 (platform, field_name) で履歴保持 |
| `updated_at` | timestamptz | ✓ | now() | |
| `updated_by` | uuid | - | NULL | FK → public.users(id) ON DELETE SET NULL |

UNIQUE: `(platform, field_name, version)`

各 (platform, field_name) ペアで最新 version のみ API で返される。

---

## RLS ポリシー

### user_id を持つテーブル（`users` / `posts` / `sns_accounts`）

すべて `auth.uid() = user_id` で SELECT / INSERT (with check) / UPDATE / DELETE。

### `post_targets`（user_id を持たない）

posts 経由のサブクエリで制限:

```sql
exists (
  select 1 from public.posts
  where posts.id = post_targets.post_id
    and posts.user_id = auth.uid()
)
```

### `dom_selectors`

| 操作 | 条件 |
|---|---|
| SELECT | **anon 含む全員可**（拡張 SW から Cookie が送れないため、migration 0004 で開放） |
| INSERT / UPDATE / DELETE | `users.plan = 'admin'` のみ |

---

## マイグレーション一覧

### 0001_users_with_rls.sql
- `public.users` 作成
- `auth.users` への INSERT トリガで自動 `public.users` 生成
- RLS（本人のみ）

### 0002_posts.sql
- `posts` / `post_targets` / `sns_accounts`
- 全テーブル RLS 有効化

### 0003_dom_selectors.sql
- `dom_selectors` テーブル
- 仮セレクタ初期データ 6件（relaxy/02 × {post_body, image_upload, submit_button}）

### 0004_dom_selectors_anon_read.sql
- `dom_selectors` の SELECT を anon に開放
- MV3 拡張 SW が Cookie を送れない問題への対処

### 0005_dom_selectors_real_urls.sql
- 実際の DOM 構造に基づくセレクタを version=2 として追加
- リラクシィー（rx-sns.jp）:
  - post_body: `textarea[placeholder="いまどうしてる？"]`（maxlength=330）
  - image_upload: `input[data-testid="image-file-input"]`
  - submit_button: `button[aria-label="投稿する"]`
- 02（m-sns.net/user/post/）:
  - post_body: `textarea#content`（maxlength=280）
  - image_upload: `input[name="image1"]`
  - submit_button: `button[type="submit"][name="action"][value="publish"]`

---

## RLS 動作確認用 SQL

```sql
-- RLS が有効か
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
order by tablename;

-- ポリシー一覧
select tablename, policyname, cmd as command, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

実動作テストは Phase 4 で実施済み（X+Bluesky の本人投稿のみ可、他ユーザーの posts は不可視）。

---

## TypeScript 型

`packages/shared/src/db.ts` に手書き型を保持。Supabase CLI で自動生成も可能:

```bash
pnpm dlx supabase gen types typescript --project-id pfdjajckhvnxgetcmieh > packages/shared/src/db.ts
```

初回は `pnpm dlx supabase login` でブラウザ認証要。

---

## 主要 API

### `POST /api/posts` — 統合投稿

#### リクエスト
```json
{
  "body_common": "投稿本文",
  "images": [{ "url": "https://...", "width": 600, "height": 400 }],
  "target_platforms": ["x", "bluesky", "relaxy", "02"]
}
```

#### レスポンス
```json
{
  "post_id": "uuid",
  "status": "success" | "failed" | "pending",
  "targets": [
    {
      "id": "uuid",
      "platform": "x",
      "status": "success",
      "external_post_url": "https://x.com/.../status/...",
      "error_message": null
    }
  ]
}
```

#### 動作
- API 系（X / Bluesky）: 並列投稿、指数バックオフ 1s/2s/4s で初回+3 リトライ = 計4回試行
- 拡張系（relaxy / 02）: post_targets を `pending` のまま残し、Chrome 拡張 or コピペ UI が後続処理
- 全体 status: 全 success → `success` / どれか failed → `failed` / それ以外 → `pending`
- `maxDuration = 60` 秒（Vercel Function 上限）

### `POST /api/posts/[id]/retry` — 失敗投稿の再試行

failed の post_targets を pending に戻し、API 系のみ再投稿。拡張系は pending のまま残す（コピペ UI で対応）。

### `PATCH /api/post-targets/[id]/status` — 拡張機能 / 手動完了通知

拡張機能の content script、またはコピペ UI の「✅ 投稿完了として記録」ボタンから呼ばれ、status を `success`/`failed` に更新。

### `GET /api/dom-selectors`

拡張機能用。anon でも SELECT 可。各 (platform, field_name) ペアで最新 version を返す。

### `GET /api/auth/x/start` / `GET /api/auth/x/callback` / `POST /api/auth/x/disconnect`

X OAuth 2.0 PKCE フロー。scope: `tweet.read tweet.write users.read media.write offline.access`。

### `POST /api/auth/bluesky/connect` / `POST /api/auth/bluesky/disconnect`

Bluesky AppPassword の暗号化保存 / 削除。

---

## 拡張機能のセレクタ更新運用

### admin への昇格

```sql
update public.users set plan = 'admin' where email = '<対象メアド>';
```

### 新セレクタの追加（version をインクリメント）

```sql
insert into public.dom_selectors (platform, field_name, selector, version, updated_by)
values
  ('relaxy', 'post_body', '<新CSSセレクタ>', 3,
   (select id from public.users where email = '<admin-email>'));
```

60秒以内に拡張機能（chrome.alarms）が新セレクタを取得 → 投稿時に使用。

### 取得失敗時の挙動

- API エラー / ネットワーク断 → キャッシュ使用継続（最後に取得成功した値）
- キャッシュもなし → content script が `No cached dom_selectors. ...` エラー

---

## Phase 7 以降の TODO

- 監査ログテーブル `audit_logs`（CRUD イベント自動記録）
- セレクタ自動検知 Bot（rx-sns.jp / m-sns.net の DOM 変化を毎日監視）
- バックアップ / リストア手順（Supabase Free のスナップショット運用）
