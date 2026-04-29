# 投稿一括統合システム (post-integration-system)

マルチSNS同時投稿SaaSのモノレポ。

## 構成

```
.
├── apps/
│   ├── web/         # Next.js 14 (App Router) + TypeScript + Tailwind
│   └── extension/   # Vite + @crxjs/vite-plugin (Chrome 拡張 MV3)
└── packages/
    └── shared/      # 共通型定義（現状は空）
```

## 必要環境

- Node.js >= 20
- pnpm >= 9

## セットアップ

```bash
pnpm install
```

## 開発起動

### apps/web のみ起動（既定）

```bash
pnpm dev
# → http://localhost:3000
```

### apps/extension のみ起動

```bash
pnpm dev:ext
```

## 環境変数

`.env.example` をコピーして `.env.local` を作成し、値を設定してください（現時点では Phase1-1 の範囲では不要）。

```bash
cp .env.example .env.local
```

## CI / CD

### 概要
- **CI**: GitHub Actions（[.github/workflows/ci.yml](.github/workflows/ci.yml)）
  - トリガ: `main` への push / `main` への PR
  - 実行: `pnpm install` → `lint` → `typecheck` → `build`（全パッケージ、`--if-present` で未定義はスキップ）
- **CD（ステージング = preview / 本番 = main）**: Vercel
  - apps/web のみデプロイ（[vercel.json](vercel.json) 参照）
  - GitHub 連携で自動デプロイ（PR ごとに preview URL、main マージで本番）

### 初回セットアップ手順（ユーザー側）

1. **GitHub リポジトリを作成**
   - 例: `gh repo create post-integration-system --private --source=. --remote=origin`
   - もしくは Web で作成 → `git init && git add . && git commit -m "init" && git branch -M main && git remote add origin <URL> && git push -u origin main`
2. **Vercel にプロジェクトをインポート**
   - https://vercel.com/new で対象 GitHub リポジトリを選択
   - **Root Directory**: そのまま（リポジトリルート。`vercel.json` で apps/web をビルドする設定済）
   - **Framework Preset**: Next.js（自動検出）
   - **Install Command / Build Command / Output Directory**: `vercel.json` の値が使われる
3. **GitHub Secrets 登録（CIから Vercel CLI を使う場合のみ。今回の ci.yml では未使用）**
   - `Settings → Secrets and variables → Actions → New repository secret`
   - `VERCEL_TOKEN`: `[REDACTED]`（Vercel ダッシュボードの Account Settings → Tokens で発行）
   - `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`: 必要に応じて追加（本Stepでは未利用）
4. **branch protection（推奨：手動設定）**
   - `Settings → Branches → Add rule`
   - Branch name pattern: `main`
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging → `lint / typecheck / build` を必須に指定
   - ✅ Require branches to be up to date before merging

### 動作確認

- main に push → Actions タブで CI 緑になることを確認
- Vercel ダッシュボードでデプロイ完了 → 表示された Preview URL / 本番 URL にアクセス

## 認証 / DB セットアップ（Phase 2-1）

### 1. Supabase プロジェクト準備
- Supabase Dashboard でプロジェクト作成済み: `freeeeeeesfrees-ui's Project`
- Region: ap-northeast-1 (Tokyo)
- URL: `https://pfdjajckhvnxgetcmieh.supabase.co`

### 2. Supabase Dashboard で確認メール認証を OFF
1. Supabase Dashboard → 左サイドバー「**Authentication**」 → 「**Providers**」
2. 「**Email**」を開く
3. 「**Confirm email**」を **OFF** にする（Phase 2-1 のスコープ：確認メールなしで即サインアップ）
4. Save

### 3. SQL マイグレーション実行
1. Supabase Dashboard → 左サイドバー「**SQL Editor**」
2. 「**New query**」をクリック
3. [supabase/migrations/0001_users_with_rls.sql](supabase/migrations/0001_users_with_rls.sql) の内容を全文コピペ
4. 「**Run**」をクリック → 「Success. No rows returned」表示でOK

### 4. API Keys を取得
1. Supabase Dashboard → 左サイドバー「**Settings**」 → 「**API**」
2. 以下をコピー:
   - **Project URL**（既に分かっている値: `https://pfdjajckhvnxgetcmieh.supabase.co`）
   - **anon public** キー
   - **service_role** キー（**絶対公開禁止**）

### 5. ローカル `.env.local` 作成
```bash
# プロジェクトルートで
cp .env.example .env.local
```
`.env.local` を編集して値を埋める:
```
NEXT_PUBLIC_SUPABASE_URL=https://pfdjajckhvnxgetcmieh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public キーをここに>
SUPABASE_SERVICE_ROLE_KEY=<service_role キーをここに（流出注意）>
```

### 6. ローカル動作確認
```bash
pnpm dev
```
- http://localhost:3000/signup でアカウント作成
- http://localhost:3000/login でログイン
- http://localhost:3000/dashboard で「ログイン中: <メアド>」表示
- 未認証で `/dashboard` にアクセス → `/login` にリダイレクト

### 7. Vercel 環境変数登録（本番反映）
1. Vercel Dashboard → プロジェクト「post-integration-system」 → Settings → Environment Variables
2. 上記3つのキーを **Production / Preview / Development** すべてに登録
3. Deployments タブで再デプロイ（または次の git push で自動）

詳細仕様は [SECURITY.md](SECURITY.md) を参照。

## 投稿系テーブル（Phase 3-1）

### マイグレーション 0002 適用
1. Supabase Dashboard → SQL Editor → New query
2. [supabase/migrations/0002_posts.sql](supabase/migrations/0002_posts.sql) の内容を全文コピペ
3. Run → 「Success」確認

これで `posts` / `post_targets` / `sns_accounts` の3テーブルが作成され RLS が有効になります。

## DOMセレクタテーブル（Phase 3-2）

### マイグレーション 0003 適用
1. Supabase Dashboard → SQL Editor → New query
2. [supabase/migrations/0003_dom_selectors.sql](supabase/migrations/0003_dom_selectors.sql) の中身を全文コピペ
3. Run → 「Success」確認

これで `dom_selectors` テーブルが作成され、初期データ6件が投入されます。

### API 動作確認
1. http://localhost:3000/login にログイン
2. 同じブラウザで http://localhost:3000/api/dom-selectors にアクセス → JSON 返却
3. ログアウト → 同 URL → 401 Unauthorized

詳細仕様は [DATA_SPEC.md](DATA_SPEC.md) を参照。

## X (Twitter) 連携と投稿（Phase 4-1）

### 1. X Developer Portal でアプリ作成
1. https://developer.x.com/en/portal/dashboard にアクセス（X アカウントでログイン）
2. 「**Create Project**」 → プロジェクト名 / 用途 / 説明を入力
3. プロジェクト内で「**Add App**」 → アプリ名を入力
4. アプリ詳細画面の「**User authentication settings**」 → 「**Set up**」
5. 以下を設定:
   - **App permissions**: `Read and Write`
   - **Type of App**: `Web App, Automated App or Bot`
   - **Callback URI / Redirect URL**: `http://localhost:3000/api/auth/x/callback`
   - **Website URL**: `http://localhost:3000`（任意）
6. 「**Save**」 → 「**Keys and tokens**」タブ
7. 「**OAuth 2.0 Client ID and Client Secret**」セクションで以下を控える:
   - **Client ID**
   - **Client Secret**

### 2. ローカル環境変数に登録
`apps/web/.env.local` に追加:
```
X_CLIENT_ID=<上記の Client ID>
X_CLIENT_SECRET=<上記の Client Secret>
X_REDIRECT_URI=http://localhost:3000/api/auth/x/callback
ENCRYPTION_KEY=<32バイト Base64、未設定なら下記コマンドで生成>
```

ENCRYPTION_KEY 生成:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. 連携と投稿テスト
1. `pnpm dev` 起動 → http://localhost:3000/login でログイン
2. http://localhost:3000/settings/connections を開く
3. 「**Xと連携**」をクリック → X の認可画面 → 「Authorize app」
4. リダイレクトで `/settings/connections?success=1` に戻り、`@<your-x-handle>` 表示
5. 投稿テスト（PowerShell or curl）:

```powershell
# Cookie を持ったブラウザで /api/post/x に POST する場合は DevTools から
# あるいは、ブラウザで以下を Console から実行:
fetch('/api/post/x', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Hello from 投稿一括統合システム! ' + new Date().toISOString() })
}).then(r => r.json()).then(console.log);
```

→ レスポンスに `{ tweetId, url }` が返れば投稿成功 ✅

### 4. 画像付き投稿テスト
```js
fetch('/api/post/x', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: '画像テスト',
    image_url: 'https://picsum.photos/600/400'
  })
}).then(r => r.json()).then(console.log);
```

詳細仕様は [SECURITY.md](SECURITY.md) を参照。

## Bluesky 連携と投稿（Phase 4-2）

### 1. Bluesky で AppPassword を発行
1. Bluesky アプリ or Web (https://bsky.app) でログイン
2. **Settings** → **Privacy and Security** → **App Passwords**
3. 「**Add App Password**」をクリック
4. 名前を入力（例: `post-integration-system`）
5. 「**Create**」 → 表示された AppPassword を**コピー**（**1度しか表示されません**）

### 2. アプリで連携
1. http://localhost:3000/settings/connections を開く
2. 「Bluesky」セクションのフォームに入力:
   - **Identifier**: あなたの Bluesky handle（例: `alice.bsky.social`）
   - **AppPassword**: 上記 1 でコピーした値
3. 「**Blueskyと連携**」をクリック
4. 成功すると「連携済み: @<handle>」表示

### 3. 投稿テスト（DevTools Console）
```js
fetch('/api/post/bluesky', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Hello from 投稿一括統合システム! ' + new Date().toISOString()
  })
}).then(r => r.json()).then(console.log);
```

→ レスポンスに `{ uri, cid, webUrl }` が返れば投稿成功 ✅
→ webUrl をブラウザで開いて Bluesky 上の投稿を目視確認

### 4. 画像付き投稿
```js
fetch('/api/post/bluesky', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: '画像テスト',
    image_url: 'https://picsum.photos/600/400'
  })
}).then(r => r.json()).then(console.log);
```

### 文字数制限
- Bluesky は **300 grapheme**（実描画文字単位、絵文字や日本語含む）
- 超えると 500 エラー: `Bluesky text exceeds 300 graphemes`

### Bluesky の利点（X との比較）
- ✅ **完全無料**（課金不要）
- ✅ Developer Portal 不要（AppPassword だけ）
- ✅ レート制限緩い（個人利用には実質無制限）

## 統合投稿 API（Phase 4-3）

### 仕様
**`POST /api/posts`**: 複数 SNS に同時投稿（API系は即時、拡張系は pending）

#### リクエスト
```json
{
  "body_common": "投稿本文",
  "images": [{ "url": "https://...", "width": 600, "height": 400 }],
  "target_platforms": ["x", "bluesky", "relaxy", "02"]
}
```

- `body_common` (必須): 投稿本文
- `images` (任意): 画像配列、各要素は `{url, width, height}`
- `target_platforms` (必須): 配列、`'x' | 'bluesky' | 'relaxy' | '02'` のいずれか

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

#### 動作詳細
- **API系 (X / Bluesky)**: 並列投稿、各リクエストは**指数バックオフ 1s/2s/4s で初回+3リトライ = 計4回試行**
- **拡張系 (relaxy / 02)**: post_targets を pending のまま残す → Phase 5 で Chrome 拡張機能が拾って投稿
- 部分成功対応: X 成功 + Bluesky 失敗 でも posts は「failed」、各 target の詳細は post_targets に
- 全体 status:
  - 全 target が success → `success`
  - どれか failed → `failed`
  - それ以外（pending 残り） → `pending`

### 動作確認（DevTools Console）

#### X + Bluesky 同時投稿
```js
fetch('/api/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    body_common: '統合API テスト ' + new Date().toISOString(),
    target_platforms: ['x', 'bluesky']
  })
}).then(r => r.json()).then(console.log);
```

→ 両方の `external_post_url` が返れば成功 ✅

#### 画像付き同時投稿
```js
fetch('/api/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    body_common: '画像付き統合テスト',
    images: [{ url: 'https://picsum.photos/600/400', width: 600, height: 400 }],
    target_platforms: ['x', 'bluesky']
  })
}).then(r => r.json()).then(console.log);
```

#### 拡張系を含む（relaxy/02 は pending のまま残る）
```js
fetch('/api/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    body_common: '拡張機能経由のテスト',
    target_platforms: ['x', 'bluesky', 'relaxy', '02']
  })
}).then(r => r.json()).then(console.log);
```

→ X / Bluesky は success、relaxy / 02 は pending（拡張機能が後で投稿）

### Vercel タイムアウトについて
- API系 4回試行 + バックオフ計7秒 + 各投稿の処理時間で合計 30秒前後の可能性
- Vercel Hobby プランは **maxDuration 10秒（Edge）/ 60秒 (Node Function)**
- 本コードでは `maxDuration = 60` を指定済（route.ts）
- リトライが多発するとタイムアウトの可能性、その場合は Phase 7 でキュー化（BullMQ等）検討

## 注意

- 本リポジトリは Phase 4-3（投稿API統合）の状態。
- Chrome拡張機能配信 / Instagram / Sentry / 課金制限 は未設定。後続フェーズで追加予定。
#   S N S -  
 