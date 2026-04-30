# UI_SPEC.md

## Phase 6-1: 投稿作成画面

### URL
`/dashboard/compose`

### 認証
- Server Component で `auth.getUser()`、未認証なら `/login` リダイレクト
- middleware.ts の保護対象 `/dashboard/*` に含まれる

### 構成

```
[ヘッダー]
  ├─ タイトル「投稿を作成」
  └─ 「ダッシュボードへ」リンク

[本文セクション]
  ├─ <textarea> 投稿本文
  └─ 文字数バー (4SNS別の色 + 上限超過は赤背景)

[画像セクション]
  ├─ ドラッグ&ドロップエリア (border-dashed)
  ├─ ファイル選択ボタン
  └─ プレビュー (4列グリッド) + 削除ボタン

[投稿先セクション]
  ├─ X (旧Twitter) チェックボックス
  ├─ Bluesky チェックボックス
  ├─ リラクシィー チェックボックス
  └─ 02 チェックボックス
  各チェックボックスは未連携時は disabled + 🔒「未連携」表示

[投稿ボタン]
  └─ 「全SNSに投稿する」 (送信中は「送信中...」)

[結果表示]
  └─ 投稿成功時のみ表示
     ├─ post_id + status
     └─ 各 platform の結果 (✅/❌/⏳ + URL or error_message)
```

### 状態遷移

| 状態 | UI |
|---|---|
| 初期 | 入力欄空、画像0枚、ボタン非活性 |
| 入力中 | 文字数バー更新、上限超過SNSは自動OFF |
| 画像処理中 | 「画像を圧縮中...(N枚)」表示 |
| 送信中 | ボタン「送信中...」非活性 |
| 結果表示 | 結果セクション表示、再投稿可能 |
| エラー | 赤背景でエラーメッセージ表示 |

### 文字数制限

| Platform | Limit | Bar 色 |
|---|---|---|
| X | 280 | 黒 (`bg-black`) |
| Bluesky | 300 | 空色 (`bg-sky-500`) |
| リラクシィー | 500 (仮) | ピンク (`bg-pink-500`) |
| 02 | 500 (仮) | 紫 (`bg-purple-500`) |

超過時はバーが赤 (`bg-red-500`) + 文字数表示が赤太字 + 該当 SNS のチェックボックスが自動 OFF。

### 画像処理

- クライアント側 canvas API で **WebP / quality 0.85 / 最大 1080×1080** に圧縮
- アスペクト比保持、縮小のみ（拡大しない）
- Data URL 形式で `/api/posts` の `images[].url` に渡す
- 最大 4 枚（X / Bluesky / リラクシィー / 02 すべての上限を考慮）

### 投稿フロー

```
[ユーザー] 「全SNSに投稿する」クリック
   ↓
[Client] target_platforms = 連携済 + 選択済 のみ
       fetch POST /api/posts with { body_common, images, target_platforms }
   ↓
[Server /api/posts] (Phase 4-3)
   → posts INSERT, post_targets INSERT
   → API系 (X / Bluesky) 並列投稿 + リトライ
   → 拡張系 (relaxy / 02) は pending
   → posts.status 集計
   ↓
[Client] レスポンス受信 → 結果セクションに表示
   各 platform: ✅成功 / ❌失敗 / ⏳ pending
```

### コピーライティング規則

- 専門用語禁止（例: "API", "OAuth", "endpoint" は避ける）
- ボタン文言は具体的に（「投稿」ではなく「全SNSに投稿する」）
- エラーメッセージは「〜できませんでした」「〜してください」の口語

### 連携未完了の扱い

- 未連携 SNS はチェックボックスが disabled
- ラベル右に 🔒 + 「未連携」表示
- セクション下に「連携設定」へのリンク表示

### 文字数自動 OFF

- テキスト変更時 useEffect で各 SNS の上限超過判定
- 超過 → `selected[platform] = false` に上書き
- 同時にバナー警告「⚠️ 文字数オーバー: X, Bluesky は自動で投稿先から外されました」

### スコープ外（v2 以降）

- プラットフォーム別オーバーライド（SNS ごとに別文章）
- 予約投稿
- ハッシュタグ提案
- Supabase Storage 経由の画像アップロード（現状は Data URL）

### 既知の制約

- Data URL は base64 エンコードのため、4枚 1080×1080 WebP で約 200-400KB × 4 ≈ 1MB前後 のリクエストになる
- Vercel Function のリクエストサイズ上限: 4.5MB → 余裕あり
- ただし、長期的には Supabase Storage 等の CDN 経由が望ましい（Phase 7 以降で改善検討）
