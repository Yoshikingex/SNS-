# SECURITY.md

Matomell のセキュリティ設計とポリシー。

---

## 認証フロー

### 採用方式

- **Supabase Auth**（メール+パスワード、JWT セッション）
- ライブラリ: `@supabase/ssr`（Server Component / Server Action 両対応）
- セッション保管: HttpOnly Cookie

### サインアップフロー（auto-confirm 実装済み）

Supabase Free プランは「Confirm email」を UI から OFF にできない仕様（強制 ON）。本番投入時に「Email not confirmed」エラーで詰まったため、**Service Role Key を使った admin.createUser で迂回**する設計に切り替え済み。

```
ブラウザ                  Next.js Server Action               Supabase
  │ POST /signup              │                                 │
  ├─────────────────────────>│                                 │
  │ (email, password)        │ admin.createUser({              │
  │                          │   email, password,              │
  │                          │   email_confirm: true           │  ← メール送信ゼロ
  │                          │ })                              │     即時確認済み状態
  │                          ├────────────────────────────────>│
  │                          │                                 │ INSERT auth.users
  │                          │                                 │ → trigger
  │                          │                                 │ → INSERT public.users
  │                          │ signInWithPassword              │
  │                          ├────────────────────────────────>│
  │ Set-Cookie (sb-*)        │                                 │
  │<─────────────────────────┤<────────────────────────────────┤
  │ 302 → /dashboard         │                                 │
```

実装: `apps/web/lib/supabase/admin.ts` + `apps/web/app/(auth)/signup/page.tsx`

### ログインフロー

`signInWithPassword` のみ。Cookie に JWT セッションが保存され、`middleware.ts` が `/dashboard/*` への未認証アクセスをブロック → `/login` へリダイレクト。

### ログアウト

`/auth/signout` で `supabase.auth.signOut()` → Cookie 削除 → `/login` へ。

---

## 鍵棚卸し表

| 鍵名 | 用途 | 保管場所 | クライアント露出 | ローテ周期 |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API エンドポイント | Vercel 環境変数 / `.env.local` | あり（NEXT_PUBLIC_）| 不要 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 匿名キー（RLS 必須） | Vercel 環境変数 / `.env.local` | あり（NEXT_PUBLIC_）| 90日 |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバ側管理用（RLS バイパス） | Vercel 環境変数 / `.env.local`（最小限） | **絶対露出禁止** | 90日 |
| `ENCRYPTION_KEY` | AES-256-GCM 暗号化鍵（SNS資格情報用） | Vercel 環境変数のみ | **絶対露出禁止** | 180日 |
| `X_CLIENT_ID` | X OAuth2 Client ID | Vercel 環境変数 / `.env.local` | サーバ側のみ参照 | アプリ削除時のみ |
| `X_CLIENT_SECRET` | X OAuth2 Client Secret | Vercel 環境変数のみ | **絶対露出禁止** | アプリ削除時のみ |
| `X_REDIRECT_URI` | X OAuth callback URL | Vercel 環境変数 / `.env.local` | URL のみ | 不要 |
| ユーザー個別 X access/refresh token | 投稿用 OAuth2 トークン | `sns_accounts.encrypted_credentials`（AES-256-GCM 暗号化） | **平文露出禁止** | refresh で自動更新 |
| ユーザー個別 Bluesky AppPassword | 投稿用認証 | `sns_accounts.encrypted_credentials`（AES-256-GCM 暗号化） | **平文露出禁止** | ユーザーが Bluesky 側で revoke + 再連携 |

### Service Role Key の取得位置

Supabase Dashboard → `Settings > API Keys` → タブ **Legacy anon, service_role API keys** → `service_role` の `eyJ...` JWT。新形式 `sb_secret_*` は使わない（既存コードは JWT 形式前提）。

### `ENCRYPTION_KEY` の生成

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

44文字 Base64 を `ENCRYPTION_KEY` に設定。

### 鍵取り扱い原則

- 値は本ドキュメントには一切記載しない（`[REDACTED]`）
- `git grep -E "eyJ[A-Za-z0-9_-]+\\."` で JWT リテラル0件であること
- `.env.local` は `.gitignore` で除外
- Service Role Key を使うコードは Server Action / Route Handler のみ。Client Component で参照禁止（admin.ts に閉じ込め）
- 漏洩時は Supabase Dashboard で即時ローテ → Vercel 環境変数を更新 → 再デプロイ

### ローテーション方針（運用開始時に確立）

- `ENCRYPTION_KEY` 変更前に既存暗号文を全件旧鍵で復号 → 新鍵で再暗号化 → DB 更新（Phase 7-3 ランブック予定）
- 短時間メンテナンスウィンドウを設けて実施

---

## RLS（Row Level Security）方針

### user_id を持つテーブル（`users` / `posts` / `sns_accounts`）

4種すべて `auth.uid() = user_id` で制限：SELECT / INSERT (with check) / UPDATE / DELETE。

### `post_targets`（user_id を持たない）

posts 経由のサブクエリで制限：

```sql
exists (
  select 1 from public.posts
  where posts.id = post_targets.post_id
    and posts.user_id = auth.uid()
)
```

### `dom_selectors`（拡張機能から anon でも読める例外）

- **SELECT**: anon 含む全員可（migration 0004 で許可、MV3 SW が Cookie を送れないため）
- **INSERT/UPDATE/DELETE**: `users.plan = 'admin'` のみ

### 拒否される操作

- 他ユーザーの `id` を指定した SELECT/UPDATE → 0行 / 0更新
- 認証なしでの posts/sns_accounts 全件取得 → 拒否
- 一般ユーザーの dom_selectors INSERT → 拒否

---

## 拡張機能のセキュリティ

### externally_connectable

`apps/extension/manifest.config.ts` で `chrome.runtime.sendMessage` を受け付けるオリジンを限定:
- `http://localhost:3000`
- `https://post-integration-system-frees-projects-906fc790.vercel.app`
- （将来的にカスタムドメインを足す場合は明示追加）

### Service Worker → Web API への呼び出し

MV3 SW は third-party context 扱いのため Supabase の `sb-*` Cookie (SameSite=Lax) が送られない。対策:
- `dom_selectors` API は anon SELECT 可に開放（migration 0004）
- 拡張からの結果通知 (`PATCH /api/post-targets/:id/status`) は対応する Web ページが Cookie を持って中継する設計

### content script の権限

リラクシィー / 02 のページに content_script を注入。投稿フォームの DOM 操作のみで、ページ外の情報は読まない。

---

## 監査

| 項目 | 確認場所 |
|---|---|
| ログイン成功・失敗 | Supabase Dashboard > Logs > Auth |
| 投稿成功・失敗 | `posts` / `post_targets` テーブル |
| OAuth 認可 | `sns_accounts` の作成・更新タイムスタンプ |
| 拡張機能 SW ログ | `chrome://extensions/` の拡張ページの「サービスワーカー」リンク |

Phase 7-1 で Sentry を導入予定（フロント+API のエラートラッキング）。

---

## 既知の制限・対処

| 項目 | 状態 |
|---|---|
| Supabase Free プランの確認メール強制 ON | ✅ admin.createUser で迂回 |
| Supabase Free プランの SMTP レート制限（1時間 数通） | ✅ admin.createUser で完全回避（メール送信なし） |
| MV3 SW から Cookie 認証 API への呼び出し不可 | ✅ dom_selectors は anon 可に / 結果通知は Web ページ経由 |
| パスワードリセットメール | ⚠️ 動作するはずだが運用未検証（Site URL 修正済み） |
| 2FA | 未実装（Phase 8 ベータ前に検討） |
| 監査ログテーブル | 未実装（Phase 7） |

---

## 連絡先

セキュリティに関する報告 / 質問は、リポジトリの GitHub Issue（private）または直接連絡。
