# UI_SPEC.md

Matomell の画面仕様。

---

## 全体ナビゲーション

```
/
├─ /signup            (公開) アカウント作成
├─ /login             (公開) ログイン
├─ /dashboard         (要認証) ナビゲーションハブ
│   ├─ /dashboard/compose   投稿作成
│   └─ /dashboard/history   投稿履歴
├─ /onboarding/[1-5]  (要認証) 5 ステップウィザード
├─ /settings/connections (要認証) SNS 連携管理
└─ /auth/signout      ログアウト Action
```

middleware.ts が `/dashboard/*` `/onboarding/*` `/settings/*` への未認証アクセスを `/login` にリダイレクト。

---

## ブランディング

- **アプリ名**: Matomell（マトメル）
- **タグライン**: マルチSNS同時投稿システム
- **ロゴ**: 「M」文字 / `linear-gradient(135deg, #1f2937 0%, #4f46e5 100%)`（ダーク→紫）
- **アイコン生成**: `apps/web/app/icon.tsx`（192px）+ `apple-icon.tsx`（180px）で Next.js `ImageResponse` 動的生成（`runtime = "edge"` 指定で OneDrive のパス問題を回避）

---

## PWA

### 設定

- `apps/web/app/manifest.ts` で動的マニフェスト生成
- `display: "standalone"` でアプリ風起動
- `background_color: "#1f2937"` / `theme_color: "#4f46e5"`

### インストール手順

| プラットフォーム | 操作 |
|---|---|
| iPhone Safari | 共有ボタン → 「ホーム画面に追加」 |
| Android Chrome | 右上「⋮」→ 「ホーム画面に追加」/「アプリをインストール」 |
| デスクトップ Chrome / Edge | URL バー右側のインストールアイコン |

### 機能マトリクス（PWA）

| 機能 | スマホ PWA | PC ブラウザ |
|---|---|---|
| X / Bluesky 自動投稿 | ✅ | ✅ |
| 拡張機能（relaxy / 02） | ❌（拡張未対応） | ✅ |
| コピペ UI（relaxy / 02） | ✅ | ✅ |
| 投稿履歴・再試行 | ✅ | ✅ |

---

## ランディング `/`

ログイン誘導と簡単な紹介のみ。デザインはミニマル。

- `Matomell` 大見出し + タグライン
- 「ログイン」「新規登録」CTA ボタン
- マルチSNS同時投稿のメリット 1〜2 行

---

## サインアップ `/signup`

### 機能

- メール + パスワード（6文字以上）入力
- Server Action で `admin.createUser({ email_confirm: true })` → メール確認なしで即作成
- 直後に `signInWithPassword` で Cookie 確立 → `/dashboard` へリダイレクト

### エラー表示

`?error=...` クエリパラメータでフォーム上に赤文字表示。
- `email rate limit exceeded` → 通常出ない（admin.createUser はメール送信ゼロ）
- `User already registered` → メール重複
- `Password should be at least 6 characters` → 6 文字未満

---

## ログイン `/login`

### 機能

- メール + パスワード入力 → `signInWithPassword`
- 成功 → `/dashboard`、失敗 → `?error=Invalid login credentials`

### Email not confirmed 対処

- 通常出ない（auto-confirm 実装済み）
- 旧アカウントで出た場合は SQL Editor で:
  ```sql
  update auth.users set email_confirmed_at = now()
  where email = '<対象>' and email_confirmed_at is null;
  ```
  （`confirmed_at` は generated column のため UPDATE 不可。`email_confirmed_at` のみ更新）

---

## ダッシュボード `/dashboard`

### 構成

- 「Matomell」見出し + サブタイトル + ログイン中メアド
- ナビゲーションボタン（縦並び）:
  - **投稿を作成** → `/dashboard/compose`
  - **投稿履歴** → `/dashboard/history`
  - **SNS連携設定** → `/settings/connections`
  - **初めての方（5分セットアップ）** → `/onboarding/1`
  - **ログアウト**

### スマホ最適化

- max-width: `md`（28rem）でスマホ縦持ちに最適化
- ボタンは大きめ（`py-3` 以上）でタップしやすく

---

## 投稿作成 `/dashboard/compose`

### 構成

```
[ヘッダー]
  ├─ 「投稿を作成」見出し
  └─ 「← ダッシュボードへ」リンク

[本文セクション]
  ├─ <textarea> 投稿本文（自動リサイズ）
  └─ 4SNS別 文字数バー（プログレス + 上限超過は赤）

[画像セクション]
  ├─ ドラッグ&ドロップエリア
  ├─ ファイル選択ボタン
  ├─ 「画像を圧縮中...(N枚)」表示
  └─ プレビュー 4列グリッド + 削除ボタン（最大4枚）

[投稿先セクション]
  ├─ ✅ X (Twitter)
  ├─ ✅ Bluesky
  ├─ ✅ リラクシィー
  └─ ✅ 02
  各チェックボックス: 未連携 → 🔒 disabled / 文字数オーバー → 自動 OFF

[投稿ボタン]
  └─ 「全SNSに投稿する」（送信中は「送信中...」非活性）

[結果セクション]（投稿後のみ）
  ├─ post_id + 全体 status
  └─ 各 platform の結果
       ├─ ✅ 成功 → 投稿 URL リンク
       ├─ ❌ 失敗 → error_message
       └─ ⏳ pending →
            ├─ 拡張機能あり PC: 自動投稿中の表示
            └─ なし: コピペ UI（後述）
```

### 文字数制限

| Platform | 上限 | バー色 | 単位 |
|---|---|---|---|
| X | 280 | 黒 (`bg-black`) | grapheme |
| Bluesky | 300 | 空色 (`bg-sky-500`) | grapheme |
| リラクシィー | 330 | ピンク (`bg-pink-500`) | maxlength |
| 02 | 280 | 紫 (`bg-purple-500`) | 表示「0/280」 |

超過時:
- バーが赤
- 文字数表示が赤太字
- 該当 SNS のチェックボックスが自動 OFF
- バナー警告「⚠️ 文字数オーバー: X, Bluesky は自動で投稿先から外されました」

### 画像処理

- クライアント canvas API で **WebP / quality 0.85 / 最大 1080×1080** に圧縮
- アスペクト比保持、縮小のみ
- Data URL 形式で `images[].url` に渡す
- 最大 4 枚

実装: `apps/web/lib/image.ts`

### REQUIRES_OAUTH マップ

```
const REQUIRES_OAUTH = {
  x: true,
  bluesky: true,
  relaxy: false,
  02: false
}
```

X / Bluesky は連携必須、リラクシィー / 02 は連携不要で常に選択可能。

### コピペ UI（pending or 拡張機能なし時）

リラクシィー / 02 の post_target が pending または失敗した場合、結果セクションに3つのボタンを表示:

- **📋 本文をコピー** → `navigator.clipboard.writeText`（fallback: `document.execCommand('copy')`）
- **🌐 リラクシィー/02を開く** → 実 URL を新タブで開く（rx-sns.jp / m-sns.net/user/post/）
- **✅ 投稿完了として記録** → `PATCH /api/post-targets/[id]/status` で success に更新

---

## 投稿履歴 `/dashboard/history`

### 機能

- 過去 30 日の投稿をカード形式で時系列降順表示
- ページネーション 20 件/ページ
- 各カード:
  - 日時 + 本文プレビュー（120文字まで）
  - SNS 別ステータス（✅成功 / ❌失敗 / ⏳pending）
  - 成功 → 投稿 URL リンク（新タブ）
  - 失敗 → error_message + 「再試行」ボタン
  - リラクシィー / 02 の pending / failed → コピペ UI 3ボタン

### 再試行 API

`POST /api/posts/[id]/retry` を呼び出し:
- failed の post_targets を pending に戻す
- API 系のみ即時再投稿（dispatch.ts 再利用）
- 拡張系は pending のまま残し、ユーザーがコピペ UI で対応
- posts.status を再集計

---

## オンボーディング `/onboarding/[1-5]`

### 5 ステップ

1. **Chrome 拡張機能インストール案内**
   - `web-bridge.ts` content script が postMessage で「installed」通知
   - Web 側が受信 → 「✅ 拡張機能を検知しました」表示
   - スマホ利用者向けに「拡張なしでもコピペで投稿できます」案内

2. **X 連携**
   - 「Xと連携」ボタン → 既存 OAuth 2.0 PKCE フロー
   - 連携済みなら ✅ 連携済み: @handle 表示

3. **Bluesky 連携**
   - identifier + AppPassword 入力フォーム
   - 連携済み判定 + 「変更する」リンク

4. **リラクシィー ログイン確認**
   - rx-sns.jp を新タブで開いて事前ログインしておく案内
   - 「ログインしました」チェックボックスで次へ進める

5. **02 ログイン確認**
   - m-sns.net で同様
   - 「完了して投稿画面へ」 → `/dashboard/compose`

### 各ステップの特徴

- 独立 URL（ブラウザ戻るボタン対応）
- 進捗バー 1/5 〜 5/5
- 戻る / スキップ / 次へ ナビゲーション

---

## SNS 連携設定 `/settings/connections`

### 機能

各 SNS のセクション:
- **X**: 「Xと連携」ボタン → OAuth、連携済みなら「@handle 連携中」+ 「解除」
- **Bluesky**: identifier + AppPassword フォーム、連携済みなら「@handle 連携中」+ 「解除」
- **リラクシィー / 02**: 「ブラウザでログイン状態維持してください」案内のみ（API 連携不要）

### Bluesky AppPassword 発行手順（埋込ヘルプ）

1. https://bsky.app にログイン
2. Settings → Privacy and Security → App Passwords
3. Add App Password → 名前入力（例: Matomell）
4. 表示されたパスワードをコピー（**1度しか表示されない**）

---

## コピーライティング規則

- 専門用語禁止（API / OAuth / endpoint 等は避ける）
- ボタン文言は具体的に（「投稿」ではなく「全SNSに投稿する」）
- エラーメッセージは「〜できませんでした」「〜してください」の口語

---

## モバイル対応原則

- max-width: `md`（28rem）でスマホ縦持ちに最適化
- タップ領域 44px 以上（Apple HIG 推奨）
- `<input type="email" />` `<input type="password" />` などで適切なキーボード呼び出し
- PWA `display: "standalone"` でブラウザ UI を消す
- 横向きでも崩れないレイアウト

---

## スコープ外（v2 以降）

- プラットフォーム別オーバーライド（SNS ごとに別文章）
- 予約投稿
- ハッシュタグ提案
- Supabase Storage 経由の画像アップロード（現状 Data URL）
- Instagram 対応（未決事項）
- スマホ・拡張なしでの relaxy / 02 完全自動化（未決事項：案 A/B/C）

---

## 既知の制約

- Data URL は base64 で 4枚 1080×1080 WebP ≈ 1MB 前後、Vercel Function の 4.5MB 上限には余裕
- Apple Web Capable meta tag は deprecated 警告が出る（影響なし、将来 `mobile-web-app-capable` に置換）
- chrome-extension:// の console エラーは Matomell とは無関係（ユーザー側のサードパーティ拡張）

---

## 関連ドキュメント

- [README.md](README.md) — プロジェクト全体
- [SECURITY.md](SECURITY.md) — 認証・鍵管理
- [DATA_SPEC.md](DATA_SPEC.md) — DB スキーマ・API
