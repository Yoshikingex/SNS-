// Phase 5-2 #ops 拡張内 + Web ↔ 拡張 で共有する型

/** Web アプリから拡張に送る投稿リクエスト（externally_connectable） */
export type ExternalPostRequest = {
  type: "post_to_relaxy" | "post_to_02";
  postTargetId: string; // public.post_targets.id (uuid)
  text: string;
  imageUrl?: string; // 画像1枚
  apiBaseUrl: string; // 結果通知先 (例: http://localhost:3000)
  formUrl: string; // 投稿フォーム URL (例: https://relaxy.example/post/new)
};

/** background → content script に渡す投稿タスク */
export type ContentPostTask = {
  postTargetId: string;
  text: string;
  imageUrl?: string;
};

/** content script → background に返す結果 */
export type ContentPostResult = {
  success: boolean;
  externalPostUrl?: string;
  errorMessage?: string;
};

/** content script ↔ background の内部メッセージ */
export type ContentToBackgroundMessage =
  | { type: "relaxy_ready" | "02_ready" }
  | {
      type: "relaxy_result" | "02_result";
      postTargetId: string;
      result: ContentPostResult;
    };

export type BackgroundToContentResponse = {
  task: ContentPostTask | null;
};
