# SECURITY.md

## 認証フロー仕様（Phase 2-1）

### 採用方式
- **Supabase Auth** によるメール+パスワード認証（JWT セッション）
- ライブラリ: `@supabase/ssr`（Server Component / Server Action 両対応）
- セッション保管: HttpOnly Cookie（Supabase 標準、改ざん耐性あり）

### スコープ
- ✅ サインアップ / ログイン / ログアウト
- ✅ 認証ミドルウェアによる `/dashboard` 配下の保護
- ✅ `public.users` テーブル + RLS（本人のみ SELECT/UPDATE 可）
- ❌ Phase 2-2 以降: 暗号化、SNS OAuth、2FA、パスワードリセット、確認メール

### フロー図

```
ブラウザ              Next.js (Vercel)            Supabase Auth
  │                        │                           │
  │ POST /signup           │                           │
  ├───────────────────────>│                           │
  │  (form: email/pwd)     │ supabase.auth.signUp()    │
  │                        ├──────────────────────────>│
  │                        │                           │ INSERT auth.users
  │                        │                           │ → trigger
  │                        │                           │ → INSERT public.users
  │                        │ Set-Cookie (sb-*)         │
  │<───────────────────────┤<──────────────────────────┤
  │ 302 → /dashboard       │                           │
  │                        │                           │
  │ GET /dashboard         │                           │
  ├───────────────────────>│                           │
  │  (Cookie: sb-*)        │ middleware: getUser()     │
  │                        ├──────────────────────────>│
  │                        │ → user OK / null          │
  │<───────────────────────┤                           │
  │ 200 (Hello Dashboard)  │                           │
  │ or 302 → /login        │                           │
```

### 未認証アクセスのリダイレクト
- `/dashboard` 配下：`middleware.ts` が Cookie から user を取得、null なら `/login` へ 302
- 未保護パス（`/`, `/login`, `/signup`）：常に通過

---

## 鍵棚卸し表

| 鍵名 | 用途 | 保管場所 | クライアント露出 | ローテ周期 | 担当 |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API エンドポイント | Vercel 環境変数 / `.env.local` | あり（NEXT_PUBLIC_）| 不要 | [REDACTED] |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名キー（RLS 必須） | Vercel 環境変数 / `.env.local` | あり（NEXT_PUBLIC_）| 90日 | [REDACTED] |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバ側管理用（RLS バイパス） | Vercel 環境変数のみ（**`.env.local` も最小限**）| **絶対露出禁止** | 90日 | [REDACTED] |

### 鍵取り扱い原則
- **値は本ドキュメントには一切記載しない**（`[REDACTED]` のみ）
- `git grep -E "eyJ[A-Za-z0-9_-]+\\." -- ':!**/node_modules/**'` で JWT リテラル0件を確認すること
- `.env.local` は `.gitignore` で除外済（Phase 1-1 で確認）
- Service Role Key を持つコードは Server Component / Route Handler のみ。Client Component で参照禁止
- 鍵漏洩時は Supabase Dashboard で即時ローテし、Vercel 環境変数を更新 → 再デプロイ

---

## RLS（Row Level Security）方針

### `public.users`
- **SELECT**: `auth.uid() = id`（本人のみ）
- **UPDATE**: `auth.uid() = id`（本人のみ、`with check` 同条件）
- **INSERT/DELETE**: ポリシーなし → 直接拒否。`auth.users` への INSERT トリガ経由のみ自動生成

### 拒否される操作の例
- 他ユーザーの `id` を指定した SELECT/UPDATE → RLS で 0行 / 0更新
- 匿名キーでの直接 INSERT → ポリシーなしで拒否
- 認証なしでの全件取得 → 拒否

---

## 監査
- ログイン成功・失敗：Supabase Dashboard の **Logs → Auth** で確認
- 未認証 `/dashboard` アクセス：middleware が静かにリダイレクト（ログ不要、Phase 7 で Sentry 追加予定）

---

## 既知の制限（Phase 2-1 のスコープ外）
- パスワードリセットフロー（メール送信）→ Phase 2-2 以降
- 確認メール（email_confirm）→ Supabase Dashboard で OFF にして即サインアップ可能にする想定
- OAuth（Google / GitHub / SNS）→ Phase 4 で SNS 投稿用に追加
- 2FA → Phase 8 ベータ前
- 監査ログテーブル → Phase 3
