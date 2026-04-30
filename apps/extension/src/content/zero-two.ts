// Phase 5-3 #ops 02 (メンエス専用SNS) DOM 投稿
// 注: セレクタはすべて仮値。Phase 5-4 で /api/dom-selectors から動的取得に置換予定。
// 実 URL も仮値 (02.example)。実 URL とフォーム DOM 構造が分かったら manifest と
// dom_selectors テーブルを差し替え。
// 02 の DOM が大きく異なる場合（contenteditable / iframe 等）は別実装方針が必要。

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

console.log("[投稿一括統合システム/02] content script loaded");

chrome.runtime.sendMessage(
  { type: "02_ready" },
  (response: BackgroundToContentResponse | undefined) => {
    if (chrome.runtime.lastError) {
      console.error(
        "[02] sendMessage error:",
        chrome.runtime.lastError.message
      );
      return;
    }
    if (!response || !response.task) {
      console.log("[02] no task assigned");
      return;
    }
    void executePost(response.task);
  }
);

// セレクタ仮値 (TODO: Phase 5-4 で /api/dom-selectors から動的取得)
// supabase/migrations/0003_dom_selectors.sql の seed と整合
const SELECTORS = {
  text: "#post-body",
  fileInput: "#image-upload",
  submit: "#submit-btn"
} as const;

const TIMEOUT_MS = 15_000;

async function executePost(task: ContentPostTask): Promise<void> {
  const result: ContentPostResult = await runPost(task).catch((e) => ({
    success: false,
    errorMessage: e instanceof Error ? e.message : String(e)
  }));

  chrome.runtime.sendMessage({
    type: "02_result",
    postTargetId: task.postTargetId,
    result
  });
}

async function runPost(task: ContentPostTask): Promise<ContentPostResult> {
  // 02 のテキストフィールドが textarea か input か未確定 → 両対応
  const textEl = (await waitForElement<HTMLElement>(
    SELECTORS.text,
    TIMEOUT_MS
  )) as HTMLTextAreaElement | HTMLInputElement;
  setReactValue(textEl, task.text);

  if (task.imageUrl) {
    const fileInput = await waitForElement<HTMLInputElement>(
      SELECTORS.fileInput,
      TIMEOUT_MS
    );
    await uploadImage(fileInput, task.imageUrl);
  }

  const submit = await waitForElement<HTMLButtonElement>(
    SELECTORS.submit,
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
