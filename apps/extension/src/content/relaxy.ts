// Phase 5-2 #ops リラクシィー DOM 投稿
// Phase 5-3 #ops で共通ロジックを ../lib/dom-helpers.ts に抽出
// Phase 5-4 #ops でセレクタを ../lib/selectors.ts のキャッシュから動的取得
// 注: 実 URL は仮値 (relaxy.example)。実 URL 確定時に manifest を差し替え。
//     dom_selectors テーブル (admin SQL) で実セレクタを管理する。

import type {
  BackgroundToContentResponse,
  ContentPostResult,
  ContentPostTask
} from "../types";
import {
  setReactValue,
  uploadImage,
  waitForElement,
  waitForUrlChange
} from "../lib/dom-helpers";
import { getCachedSelectors } from "../lib/selectors";

console.log("[投稿一括統合システム/relaxy] content script loaded");

// background に「準備できた、タスクをくれ」と通知
chrome.runtime.sendMessage(
  { type: "relaxy_ready" },
  (response: BackgroundToContentResponse | undefined) => {
    if (chrome.runtime.lastError) {
      console.error(
        "[relaxy] sendMessage error:",
        chrome.runtime.lastError.message
      );
      return;
    }
    if (!response || !response.task) {
      console.log("[relaxy] no task assigned");
      return;
    }
    void executePost(response.task);
  }
);

// dom_selectors の field_name に対応するキー
const FIELD_TEXT = "post_body";
const FIELD_FILE = "image_upload";
const FIELD_SUBMIT = "submit_button";

const TIMEOUT_MS = 15_000;

async function executePost(task: ContentPostTask): Promise<void> {
  const result: ContentPostResult = await runPost(task).catch((e) => ({
    success: false,
    errorMessage: e instanceof Error ? e.message : String(e)
  }));

  chrome.runtime.sendMessage({
    type: "relaxy_result",
    postTargetId: task.postTargetId,
    result
  });
}

async function runPost(task: ContentPostTask): Promise<ContentPostResult> {
  // Phase 5-4: キャッシュからセレクタを取得（admin が dom_selectors を更新すると自動追従）
  const selectors = await getCachedSelectors("relaxy");

  const textSelector = requireSelector(selectors, FIELD_TEXT);
  const fileSelector = requireSelector(selectors, FIELD_FILE);
  const submitSelector = requireSelector(selectors, FIELD_SUBMIT);

  const textArea = await waitForElement<HTMLTextAreaElement>(
    textSelector,
    TIMEOUT_MS
  );
  setReactValue(textArea, task.text);

  if (task.imageUrl) {
    const fileInput = await waitForElement<HTMLInputElement>(
      fileSelector,
      TIMEOUT_MS
    );
    await uploadImage(fileInput, task.imageUrl);
  }

  const submit = await waitForElement<HTMLButtonElement>(
    submitSelector,
    TIMEOUT_MS
  );
  submit.click();

  const moved = await waitForUrlChange(TIMEOUT_MS);
  if (!moved) {
    throw new Error("Submit pressed but URL did not change within timeout");
  }

  return {
    success: true,
    externalPostUrl: location.href
  };
}

function requireSelector(
  map: Record<string, string>,
  fieldName: string
): string {
  const value = map[fieldName];
  if (!value) {
    throw new Error(
      `Selector for field '${fieldName}' is not in cache. ` +
        "Check dom_selectors table and wait for next refresh."
    );
  }
  return value;
}
