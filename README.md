# Matomell（マトメル）

**マルチSNS同時投稿システム** — X / Bluesky / リラクシィー / 02 への投稿を、ひとつの画面から一括送信できる SaaS。

- 本番 URL: https://post-integration-system-frees-projects-906fc790.vercel.app
- リポジトリ: https://github.com/Yoshikingex/SNS-
- 開発状況: Phase 6 完了、Phase 7（運用整備）/ Phase 8（クローズドベータ）準備中

---

## 主な特徴

- **1画面・1タップで X / Bluesky に同時投稿**（公開 API 経由で完全自動）
- **リラクシィー / 02 にも対応**：PC は Chrome 拡張機能で完全自動、スマホは半自動コピペ UI（5秒）
- **PWA 対応**：iPhone Safari / Android Chrome で「ホーム画面に追加」してアプリ風に使用可能
- **暗号化されたトークン保管**：AES-256-GCM で SNS 連携情報を暗号化（鍵は Vercel 環境変数のみ）
- **手動招待制ベータ**：Supabase Auth + Service Role による auto-confirm 実装済み（メール確認不要）

---

## アーキテクチャ

```
.
├── apps/
│   ├── web/             # Next.js 14 (App Router) + TypeScript + Tailwind / Vercel デプロイ
│   └── extension/       # Vite + @crxjs/vite-plugin (Chrome 拡張 MV3)
├── packages/
│   └── shared/          # 共通型 / AES 暗号化ユーティリティ
└── supabase/
    └── migrations/      # 0001〜0005 SQL マイグレーション
```

### スタック

| 領域 | 採用技術 |
|---|---|
| Web | Next.js 14.2 / React 18.3 / TypeScript 5.6 / Tailwind 3.4 |
| 認証 | Supabase Auth (`@supabase/ssr`) Cookie ベース |
| DB | Supabase Postgres + RLS |
| 拡張機能 | Vite 5.4 / @crxjs/vite-plugin / Chrome MV3 |
| X 連携 | OAuth 2.0 PKCE (`twitter-api-v2`) |
| Bluesky 連携 | AT Protocol AppPassword (`@atproto/api`) |
| 文字数計測 | `graphemer`（grapheme 単位） |
| 画像圧縮 | クライアント canvas → WebP 1080px |
| デプロイ | Vercel（apps/web のみ） |

---

## 必要環境

- Node.js >= 20（推奨 24）
- pnpm >= 9（corepack 経由を推奨、Windows は管理者権限要）
- Windows 11 / macOS / Linux

詳細な開発環境ハマり所はメモリ `user_dev_environment.md` 参照。

---

## ローカル開発

### 1. インストール

```bash
pnpm install
```

### 2. 環境変数

`apps/web/.env.local` を作成（既存があればそのまま）：

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://pfdjajckhvnxgetcmieh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon publicキー>
SUPABASE_SERVICE_ROLE_KEY=<service_role キー / Legacy タブから>

# X (Twitter) OAuth
X_CLIENT_ID=<X Developer Portal の Client ID>
X_CLIENT_SECRET=<X Developer Portal の Client Secret>
X_REDIRECT_URI=http://localhost:3000/api/auth/x/callback

# 暗号化鍵（32 byte Base64）
ENCRYPTION_KEY=<生成コマンドは下記>
```

`ENCRYPTION_KEY` 生成:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. 起動

```bash
# Web (localhost:3000)
pnpm dev

# 拡張機能（別ターミナル、開発時のみ）
pnpm dev:ext
# または
pnpm --filter extension build  # 本番ビルド
```

### 4. Chrome 拡張のロード（開発時）

1. `chrome://extensions/` を開いて「デベロッパーモード」ON
2. 「パッケージ化されていない拡張機能を読み込む」→ `apps/extension/dist/` を選択
3. ID をコピー → 必要なら `apps/extension/manifest.config.ts` の `externally_connectable` を確認

---

## 本番デプロイ（Vercel）

### Vercel プロジェクト

- プロジェクト名: `post-integration-system`
- Root Directory: `apps/web`
- Framework Preset: Next.js
- 自動デプロイ: GitHub `main` push でトリガ

不要な `sns-extension` プロジェクトが残っているが、削除予定（拡張機能は ZIP 配布なので Vercel 不要）。

### Vercel 環境変数（Production / Preview / Development）

`.env.local` と同じキーを Vercel ダッシュボード `Settings > Environment Variables` に登録。`X_REDIRECT_URI` のみ本番 URL に置換：

```
X_REDIRECT_URI=https://post-integration-system-frees-projects-906fc790.vercel.app/api/auth/x/callback
```

### X Developer Portal

「User authentication settings」の Callback URI に**両方**追加:
- `http://localhost:3000/api/auth/x/callback`
- `https://post-integration-system-frees-projects-906fc790.vercel.app/api/auth/x/callback`

---

## Supabase セットアップ

### マイグレーション適用

`supabase/migrations/` 内の SQL を順番に Supabase SQL Editor で実行（既に適用済み）：

| # | ファイル | 内容 |
|---|---|---|
| 0001 | users_with_rls.sql | `public.users` + RLS + auth トリガ |
| 0002 | posts.sql | `posts` / `post_targets` / `sns_accounts` + RLS |
| 0003 | dom_selectors.sql | `dom_selectors` テーブル + 仮セレクタ初期データ |
| 0004 | dom_selectors_anon_read.sql | dom_selectors を anon SELECT 可に（拡張 SW 用） |
| 0005 | dom_selectors_real_urls.sql | rx-sns.jp / m-sns.net 実セレクタ反映 |

### Auth 設定（Production）

| 項目 | 値 |
|---|---|
| Site URL | `https://post-integration-system-frees-projects-906fc790.vercel.app` |
| Redirect URLs | `https://post-integration-system-frees-projects-906fc790.vercel.app/**` <br> `http://localhost:3000/**` |
| Confirm email | Free プランは UI から OFF にできない仕様 → **`admin.createUser({email_confirm: true})` で迂回**（実装済み） |

### Service Role Key の取得

Supabase Dashboard → `Settings > API Keys` → タブ **Legacy anon, service_role API keys** → service_role の `eyJ...` JWT をコピー。
新形式 `sb_publishable_*` / `sb_secret_*` は使わない（既存コードは JWT 形式前提）。

---

## エンドユーザー向け使い方

### 1. アカウント作成

`/signup` でメール+パスワード登録 → 自動で確認済み状態 → ダッシュボードへ遷移（メール確認不要）。

### 2. SNS 連携

`/settings/connections` で各 SNS と連携:
- **X**: 「Xと連携」ボタン → OAuth 2.0 PKCE 認可画面 → コールバック
- **Bluesky**: handle + AppPassword（`bsky.app > Settings > App Passwords` で発行）を入力
- **リラクシィー / 02**: 連携不要（ブラウザでログイン状態維持 → PC 拡張が自動投稿、スマホはコピペ）

### 3. 投稿

`/dashboard/compose` で本文入力 → 画像追加 → 投稿先 SNS チェック → 「全SNSに投稿する」

- X / Bluesky: 即時投稿
- リラクシィー / 02 (PC + 拡張): 背面タブで自動投稿
- リラクシィー / 02 (スマホ or 拡張なし): 結果画面で「📋 本文をコピー」「🌐 サイトを開く」「✅ 投稿完了として記録」の3タップ

### 4. 履歴 / 再投稿

`/dashboard/history` で過去30日の投稿確認、失敗投稿の再試行、リラクシィー/02 の手動投稿フォロー。

### 5. PWA インストール

スマホブラウザで本番 URL を開く:
- **iPhone (Safari)**: 共有ボタン → 「ホーム画面に追加」
- **Android (Chrome)**: 右上 ⋮ → 「ホーム画面に追加」/「アプリをインストール」

ホーム画面の M アイコンから起動するとフルスクリーンのアプリ風 UI。

---

## 機能マトリクス（プラットフォーム別自動度）

| Platform | PC（拡張あり） | スマホ（拡張なし） | API 提供 | 完全自動の可否 |
|---|---|---|---|---|
| X | ✅ 完全自動 | ✅ 完全自動 | あり (OAuth 2.0) | ◯ |
| Bluesky | ✅ 完全自動 | ✅ 完全自動 | あり (AT Protocol) | ◯ |
| リラクシィー | ✅ 完全自動（拡張） | ⚠️ コピペ約5秒（半自動） | なし | ✕（API 非公開） |
| 02 | ✅ 完全自動（拡張） | ⚠️ コピペ約5秒（半自動） | なし | ✕（API 非公開） |
| Instagram（未実装） | - | - | Graph API（Business/Creator のみ） | △（個人アカウントは不可） |

スマホでの完全自動化は **サーバー側ヘッドレスブラウザ + ID/パスワード保管** が必要 → コスト/ToS/セキュリティのトレードオフ。詳細は「未決事項」参照。

---

## 文字数制限（実値）

| Platform | 上限 | バー色 | 単位 |
|---|---|---|---|
| X | 280 | 黒 | grapheme |
| Bluesky | 300 | 空色 | grapheme |
| リラクシィー | 330 | ピンク | maxlength（rx-sns.jp 確認済） |
| 02 | 280 | 紫 | 表示「0/280」確認済 |

入力時に上限超過したプラットフォームは自動でチェックボックス OFF + 警告バナー。

---

## ディレクトリ別の主要ファイル

### apps/web

```
app/
├── (auth)/
│   ├── login/page.tsx          # ログインフォーム + Server Action
│   └── signup/page.tsx         # admin.createUser で auto-confirm
├── api/
│   ├── auth/
│   │   ├── x/{start,callback,disconnect}    # X OAuth 2.0 PKCE
│   │   └── bluesky/{connect,disconnect}     # Bluesky AppPassword
│   ├── dom-selectors/route.ts             # 拡張用 anon SELECT
│   ├── post-targets/[id]/status/route.ts  # PATCH: 拡張からの結果通知
│   ├── post/x/route.ts                    # 個別 X 投稿
│   ├── post/bluesky/route.ts              # 個別 Bluesky 投稿
│   └── posts/
│       ├── route.ts                       # 統合投稿 API
│       └── [id]/retry/route.ts            # 失敗時の再投稿
├── dashboard/
│   ├── page.tsx                           # ナビゲーションハブ
│   ├── compose/                           # 投稿作成画面
│   └── history/                           # 投稿履歴 + 再試行
├── onboarding/[step]/page.tsx             # 5ステップウィザード
├── settings/connections/page.tsx          # SNS 連携管理
├── icon.tsx + apple-icon.tsx              # PWA アイコン動的生成
├── manifest.ts                            # PWA マニフェスト
└── page.tsx                               # ランディング

lib/
├── supabase/{client,server,middleware,admin}.ts
├── sns/{x,bluesky,dispatch}.ts            # 投稿ロジック
├── clipboard.ts / image.ts                # クライアントヘルパー
```

### apps/extension

```
src/
├── manifest.config.ts                      # MV3 マニフェスト動的生成
├── background.ts                           # Service Worker（メッセージング + chrome.alarms）
├── content/
│   ├── relaxy.ts                           # rx-sns.jp 自動投稿
│   ├── zero-two.ts                         # m-sns.net 自動投稿
│   └── web-bridge.ts                       # 拡張インストール検知 (postMessage)
├── lib/
│   ├── selectors.ts                        # /api/dom-selectors fetch + cache
│   └── dom-helpers.ts                      # setReactValue / DataTransfer / waitForElement
└── popup/                                  # 拡張ポップアップ UI
```

---

## CI / CD

- GitHub Actions: `.github/workflows/ci.yml` で `lint` / `typecheck` / `build` を全パッケージで実行
- Vercel: GitHub 連携で `main` push → 自動デプロイ

---

## Phase 進捗

| Phase | 内容 | 状態 |
|---|---|---|
| 1-1 | モノレポ初期化 | ✅ |
| 1-2 | CI / CD | ✅ |
| 2-1 | Supabase Auth | ✅ |
| 2-2 | AES-256-GCM 暗号化 | ✅ |
| 3-1 | 投稿系テーブル + RLS | ✅ |
| 3-2 | dom_selectors テーブル | ✅ |
| 4-1 | X OAuth + 投稿 | ✅（実投稿確認済） |
| 4-2 | Bluesky AppPassword + 投稿 | ✅（実投稿確認済） |
| 4-3 | 統合投稿 API + リトライ | ✅ |
| 5-1 | 拡張 MV3 スケルトン | ✅ |
| 5-2 | リラクシィー自動投稿 | ✅（実セレクタ反映） |
| 5-3 | 02 自動投稿 | ✅（実セレクタ反映） |
| 5-4 | セレクタ動的取得 | ✅ |
| 6-1 | 投稿作成画面 | ✅ |
| 6-2 | オンボーディング 5 ステップ | ✅ |
| 6-3 | 投稿履歴 + 再試行 + コピペ UI | ✅ |
| 6-4 | エラー UI 強化 | 🔜 |
| **追加** | **Matomell ブランディング + PWA** | ✅ |
| **追加** | **signup auto-confirm（admin.createUser）** | ✅ |
| 7-1 | Sentry | 🔜 |
| 7-2 | DOM 変更検知 Bot | 🔜 |
| 7-3 | ランブック | 🔜 |
| 7-4 | 課金制限 | 🔜 |
| 8-1 | E2E テスト | 🔜 |
| 8-2 | Chrome Web Store 申請 | 🔜 |
| 8-3 | クローズドベータ | 🔜 |

---

## 未決事項（ユーザー判断待ち）

### 1. スマホ・拡張なしでのリラクシィー/02 完全自動化

選択肢:
- **案 A: サーバー側ヘッドレスブラウザ**（完全自動 / 月 $5〜20 / 利用規約・パスワード保管リスクあり）
- **案 B: 半自動コピペ UI 強化**（即実装可 / コスト 0 / 各サイト 3 タップ程度）⬅ 推奨
- **案 C: ハイブリッド**（PC=拡張 / スマホ=ヘッドレス）

### 2. Instagram 対応

選択肢:
- **Graph API**（完全自動 / Business/Creator アカウント + Meta 審査が必要 / 個人アカウント不可）
- **案 B コピペ**（個人アカウントでも可 / 画像転送が手動で 5〜6 タップ）
- **案 A ヘッドレス**：Meta の Bot 検知が強力で**非推奨**

---

## 関連ドキュメント

- [SECURITY.md](SECURITY.md) — 鍵管理、RLS ポリシー、認証フロー
- [DATA_SPEC.md](DATA_SPEC.md) — テーブル定義、マイグレーション
- [UI_SPEC.md](UI_SPEC.md) — 画面仕様、コンポーネント設計
