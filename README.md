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

## Chrome 拡張機能（Phase 5-1）

### 1. 拡張機能のビルド
```powershell
cd "c:\Users\iwaiy\OneDrive\デスクトップ\業務効率化システム\水商売システム\投稿一括統合システム"
pnpm --filter extension build
```
→ `apps/extension/dist/` に拡張機能のビルド成果物が出力される。

### 2. Chrome に開発者モードでロード
1. Chrome / Edge で `chrome://extensions/`（Edge は `edge://extensions/`）を開く
2. 右上の「**デベロッパーモード**」を ON
3. 左上の「**パッケージ化されていない拡張機能を読み込む**」をクリック
4. ファイル選択で `apps/extension/dist/` フォルダを選択
5. 拡張機能一覧に「**投稿一括統合システム**」が追加される
6. 「**ID: xxxxxxxxx**」（32文字の英字）をコピー → メモ帳に保存（後で使う）

### 3. ポップアップ表示確認
1. ブラウザのツールバーで拡張機能アイコン（パズルピース）をクリック
2. 「投稿一括統合システム」のアイコンをピン留め（任意）→ クリック
3. ポップアップが開いて以下が表示される：
   - **未接続**（赤背景）
   - Extension ID
   - 最終接続: 未受信
   - 最終接続元: 未受信

### 4. Web アプリから ping を送信して接続テスト
1. http://localhost:3000 を開く（Web アプリの dev サーバーが動いている前提）
2. F12 で DevTools → **Console**
3. 以下を貼り付け（**`<EXT_ID>` を 2 でコピーした拡張 ID に置換**）:

```js
chrome.runtime.sendMessage(
  '<EXT_ID>',
  { type: 'ping' },
  (response) => console.log('pong response:', response)
);
```

**期待結果**: Console に
```js
pong response: { type: "pong", extensionId: "xxxx...", receivedAt: "2026-..." }
```

5. 拡張機能のポップアップを再度開く → 「**Webアプリと接続中**」（緑背景）+ タイムスタンプ表示 ✅ **Done 条件達成**

### 5. 接続テストの再実行
ポップアップの状態は ping を受けるたびに更新されます。Console で何度でも実行可能。

### 注意点
- **拡張機能のリロード**: コード変更後は `chrome://extensions/` で「↻ リロード」ボタン
- **背景 Service Worker のログ**: `chrome://extensions/` → 拡張機能の「**サービスワーカー**」リンクをクリック → DevTools が開く
- **externally_connectable のオリジン**: 現状 `localhost:3000` と Vercel 本番のみ許可。他のオリジンからは無視される

## リラクシィー自動投稿（Phase 5-2 / 仮実装）

### 状態
- **コードは仮実装済み**（拡張機能 content script + background + Web 側 PATCH API）
- **動作テストは未実施**（リラクシィー実 URL とフォーム HTML 構造の調査が必要）
- セレクタは仮値: `textarea[name="body"]` / `input[type="file"]` / `button[type="submit"]`
- 実 URL: `https://relaxy.example/*`（架空）→ Phase 5-4 で動的取得に置換 + 実 URL に差し替え

### 実装ファイル
- 拡張: [apps/extension/src/content/relaxy.ts](apps/extension/src/content/relaxy.ts)
- 拡張: [apps/extension/src/background.ts](apps/extension/src/background.ts)（リラクシィーフロー追加）
- 拡張: [apps/extension/src/types.ts](apps/extension/src/types.ts)（共有型）
- Web: [apps/web/app/api/post-targets/[id]/status/route.ts](apps/web/app/api/post-targets/[id]/status/route.ts)（PATCH）

### フロー（実 URL 確定後の想定）

```
[Web (localhost:3000)]
   ↓ POST /api/posts (target_platforms に 'relaxy' 含む)
[Web]
   ↓ posts INSERT, post_targets INSERT (relaxy=pending)
   ↓ X/Bluesky は API 即時投稿
   ↓ relaxy は pending のまま、Web ページ JS が拡張に通知
[ブラウザ JS] chrome.runtime.sendMessage(extId, {
     type: 'post_to_relaxy',
     postTargetId, text, imageUrl, apiBaseUrl: location.origin,
     formUrl: 'https://relaxy.example/post/new'
   })
   ↓
[拡張 background.ts] tabs.create({url: formUrl, active: false})
   ↓
[content/relaxy.ts loaded]
   ↓ sendMessage({type: 'relaxy_ready'})
[拡張 background] sendResponse({task: {text, imageUrl, postTargetId}})
[content] DOM 操作 → 送信ボタン → URL 変化検知
[content] sendMessage({type: 'relaxy_result', result: {success, ...}})
[拡張 background] PATCH /api/post-targets/:id/status with credentials
[Web] post_targets ステータス更新
```

### Phase 5-4 完了後にやる動作テスト
1. `manifest.config.ts` の host_permissions / content_scripts の `relaxy.example` を実 URL に置換
2. `dom_selectors` テーブルの仮値を実セレクタで上書き（admin SQL 実行）
3. content script を `await getDomSelectors('relaxy', 'post_body')` 等の動的取得に書き換え
4. リラクシィーにログイン状態のブラウザで `/api/posts` を target_platforms=['relaxy'] で叩く
5. 拡張機能が背面でタブを開いて自動投稿、post_targets.status='success' に更新される

## 02 自動投稿（Phase 5-3 / 仮実装）

### 状態
- **コードは仮実装済み**（リラクシィーと鏡対称、共通ヘルパー使用）
- **動作テストは未実施**（02 実 URL とフォーム HTML 構造の調査必要）
- セレクタは仮値: `#post-body` / `#image-upload` / `#submit-btn`
- 実 URL: `https://02.example/*`（架空）→ Phase 5-4 で動的取得 + 実 URL に差替

### 実装ファイル
- 拡張: [apps/extension/src/content/zero-two.ts](apps/extension/src/content/zero-two.ts)（新規、02 専用）
- 拡張: [apps/extension/src/lib/dom-helpers.ts](apps/extension/src/lib/dom-helpers.ts)（新規、共通ヘルパー）
- 拡張: [apps/extension/src/content/relaxy.ts](apps/extension/src/content/relaxy.ts)（共通ヘルパー使用にリファクタ）
- 拡張: [apps/extension/src/background.ts](apps/extension/src/background.ts)（リラクシィー/02 のメッセージ処理を統合）
- 拡張: [apps/extension/manifest.config.ts](apps/extension/manifest.config.ts)（content_scripts に 02 追加）
- Web: [apps/web/app/api/post-targets/[id]/status/route.ts](apps/web/app/api/post-targets/[id]/status/route.ts)（リラクシィーと共通）

### Web 側からの使い方（Phase 5-4 完了後）
リラクシィーと同じパターンで `chrome.runtime.sendMessage` の type を `post_to_02` にする：

```js
chrome.runtime.sendMessage(
  '<EXT_ID>',
  {
    type: 'post_to_02',
    postTargetId: '<post_target uuid>',
    text: '投稿本文',
    imageUrl: 'https://...',
    apiBaseUrl: location.origin,
    formUrl: 'https://02.example/post/new'  // 実 URL に差替必要
  },
  (response) => console.log(response)
);
```

## セレクタ動的取得（Phase 5-4）

### 仕様
拡張機能の `background.ts` が **/api/dom-selectors** を以下のタイミングで取得 → `chrome.storage.local` にキャッシュ:
- 拡張インストール時 (`onInstalled`)
- ブラウザ起動時 (`onStartup`)
- Web ページから ping を受けた時 (即時 refresh)
- **chrome.alarms による1分ごとの定期取得**

content script (relaxy / zero-two) はキャッシュを直接読む（メッセージ不要）。

### 反映時間
- DB の dom_selectors を更新 → **最大60秒以内に拡張機能が新セレクタを使用** ✅

### admin によるセレクタ更新運用
1. ユーザーを admin に昇格（必要なら）:
```sql
update public.users set plan = 'admin' where email = '<admin-email>';
```

2. セレクタを新バージョンとして INSERT（既存は残る、最新 version が API で返される）:
```sql
insert into public.dom_selectors (platform, field_name, selector, version, updated_by)
values
  ('relaxy', 'post_body', '<新しいCSSセレクタ>', 2,
   (select id from public.users where email = '<admin-email>'));
```

3. 60秒以内に拡張機能が自動取得 → 投稿時に新セレクタが使われる

### 取得失敗時の挙動
- API エラー / ネットワーク断 → **キャッシュ使用継続**（最後に取得成功した値）
- キャッシュもなし → content script でエラー: `No cached dom_selectors. ...`

### 関連ファイル
- [apps/extension/src/lib/selectors.ts](apps/extension/src/lib/selectors.ts) — fetch / cache / API base URL 管理
- [apps/extension/src/background.ts](apps/extension/src/background.ts) — 起動時 + alarm
- [apps/extension/src/content/relaxy.ts](apps/extension/src/content/relaxy.ts) / [zero-two.ts](apps/extension/src/content/zero-two.ts) — getCachedSelectors 使用

## 投稿作成画面（Phase 6-1）

### URL
- **`/dashboard/compose`** (ログイン必須)
- ダッシュボード (`/dashboard`) からも「投稿を作成」ボタンでアクセス可能

### 機能
- 投稿本文の入力 (textarea)
- 4SNS の文字数を別色プログレスバーで可視化（X 280 / Bluesky 300 / リラクシィー 500仮 / 02 500仮）
- 文字数超過の SNS は自動で投稿先から OFF + 警告表示
- 画像のドラッグ&ドロップ・ファイル選択（最大4枚）
- 画像はクライアント側で **WebP / 最大1080×1080** に自動圧縮
- 投稿先 SNS のチェックボックス選択（連携未完了は 🔒 + 未連携表示）
- 「全SNSに投稿する」ボタン → `/api/posts` を叩く
- 結果表示（成功/失敗/pending を SNS 別アイコン付きで）

### 動作確認手順
1. `pnpm dev` で起動
2. http://localhost:3000/login でログイン
3. http://localhost:3000/dashboard でダッシュボード表示
4. 「**投稿を作成**」ボタンをクリック
5. テキスト入力 → 文字数バーが更新される
6. 画像をドラッグ＆ドロップ or ファイル選択
7. 投稿先 SNS をチェック
8. 「全SNSに投稿する」をクリック
9. 結果が画面下に表示される（X / Bluesky の URL クリックで実投稿確認）

### 詳細仕様
詳細は [UI_SPEC.md](UI_SPEC.md) 参照。

## オンボーディング（Phase 6-2）

### URL
- **`/onboarding/1`** 〜 `/onboarding/5`（ログイン必須）
- ダッシュボード (`/dashboard`) から「初めての方（5分セットアップ）」リンクでアクセス可能

### 5ステップ
1. **Chrome 拡張機能インストール案内**: 拡張がインストールされたら自動検知（`web-bridge.ts` content script が postMessage で通知）
2. **X 連携**: 既存 OAuth 2.0 PKCE フロー
3. **Bluesky 連携**: AppPassword 入力フォーム
4. **リラクシィー ログイン確認**: ブラウザで普通にログインしておくよう案内 + チェックボックス
5. **02 ログイン確認**: 同上 + 完了で `/dashboard/compose` へ遷移

### 各ステップの特徴
- 独立 URL → ブラウザ戻るボタン対応
- 進捗バー（1/5 〜 5/5）
- 戻る / スキップ / 次へ のナビゲーション
- 連携済みなら「✅ 連携済み: @user」表示

### 拡張インストール検知の仕組み
- 拡張側 [src/content/web-bridge.ts](apps/extension/src/content/web-bridge.ts) が localhost:3000 / Vercel オリジンで動作
- ページロード時に `window.postMessage({source: "post-integration-extension", type: "installed"})` を送信
- Web 側 (Step1) が `window.addEventListener("message", ...)` で受信 → 「✅ 拡張機能を検知しました」表示

### 動作確認手順
1. http://localhost:3000/login でログイン
2. http://localhost:3000/onboarding/1 を開く
3. 拡張がインストール済なら緑表示、未インストールなら手順に従ってインストール → リロード
4. 「次へ」で 2/5 → X連携、3/5 → Bluesky、4/5 → リラクシィー、5/5 → 02
5. 5/5 で「完了して投稿画面へ」 → `/dashboard/compose` 遷移

## 投稿履歴画面（Phase 6-3）

### URL
- **`/dashboard/history`**（ログイン必須）
- ダッシュボードから「投稿履歴」リンクでアクセス可能

### 機能
- **過去30日**の投稿をカード形式で時系列降順表示
- ページネーション（**20件/ページ**）
- 各投稿のメタ情報: 日時 / 本文プレビュー（120文字まで）/ SNS別ステータス
- ステータス: ✅成功（緑）/ ❌失敗（赤）/ ⏳pending（黄）
- 成功 SNS: 投稿URL を新タブで開けるリンク
- 失敗 SNS: error_message 表示
- **失敗投稿に「再試行」ボタン** → `POST /api/posts/[id]/retry` を呼ぶ
- リラクシィー / 02 の失敗には「**手動で開く**」ボタン（新タブで投稿フォーム開く）

### 再試行 API: `POST /api/posts/[id]/retry`
- failed の post_targets を pending に戻す
- API系（X / Bluesky）のみ即時再投稿（Phase 4-3 の dispatcher 再利用）
- 拡張系（リラクシィー / 02）は pending のまま残す
- posts.status を再集計

### 動作確認手順
1. http://localhost:3000/dashboard/history を開く
2. 過去の投稿カードが時系列で表示
3. 失敗した投稿があれば「再試行」ボタンクリック → 自動で再投稿 → 結果がページリロードで反映
4. リラクシィー / 02 の失敗には「手動で開く」ボタン → 新タブで投稿フォーム表示

## 注意

- 本リポジトリは Phase 6-3（投稿履歴画面）の状態。
- エラーUI / Sentry / 課金制限 は未設定。後続フェーズで追加予定。
- リラクシィー / 02 の実 URL は仮値のまま。実 URL 確定時に `manifest.config.ts` の content_scripts.matches と host_permissions を差替 + 拡張をリロード。
#   S N S -  
 