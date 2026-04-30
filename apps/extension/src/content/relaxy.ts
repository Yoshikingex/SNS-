// Phase 5-2 #ops リラクシィー DOM 投稿
// 注: セレクタはすべて仮値。Phase 5-4 で /api/dom-selectors から動的取得に置換予定。
// 実 URL も仮値 (relaxy.example)。実 URL 確定時に manifest.config.ts と合わせて差替。

import type {
  BackgroundToContentResponse,
  ContentPostResult,
  ContentPostTask
} from "../types";

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

// セレクタ仮値 (TODO: Phase 5-4 で /api/dom-selectors から動的取得)
const SELECTORS = {
  text: 'textarea[name="body"]',
  fileInput: 'input[type="file"]',
  submit: 'button[type="submit"]'
} as const;

const TIMEOUT_MS = 15_000;

async function executePost(task: ContentPostTask): Promise<void> {
  const result: ContentPostResult = await runPost(task).catch((e) => ({
    success: false,
    errorMessage: e instanceof Error ? e.message : String(e)
  }));

  // background に結果を返す
  chrome.runtime.sendMessage({
    type: "relaxy_result",
    postTargetId: task.postTargetId,
    result
  });
}

async function runPost(task: ContentPostTask): Promise<ContentPostResult> {
  // 1. テキスト入力欄を待つ
  const textArea = await waitForElement<HTMLTextAreaElement>(
    SELECTORS.text,
    TIMEOUT_MS
  );
  setReactValue(textArea, task.text);

  // 2. 画像があれば添付
  if (task.imageUrl) {
    const fileInput = await waitForElement<HTMLInputElement>(
      SELECTORS.fileInput,
      TIMEOUT_MS
    );
    await uploadImage(fileInput, task.imageUrl);
  }

  // 3. 送信ボタンを押す
  const submit = await waitForElement<HTMLButtonElement>(
    SELECTORS.submit,
    TIMEOUT_MS
  );
  submit.click();

  // 4. 成功判定: URL 変化（投稿後にリダイレクトされる前提、仮実装）
  const moved = await waitForUrlChange(TIMEOUT_MS);
  if (!moved) {
    throw new Error("Submit pressed but URL did not change within timeout");
  }

  return {
    success: true,
    externalPostUrl: location.href
  };
}

// ===== ユーティリティ =====

/** React の controlled input でも値が反映されるよう native setter で値を入れる */
function setReactValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (!setter) {
    throw new Error("native value setter not available");
  }
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/** DataTransfer API でファイル input に画像を仕込む */
async function uploadImage(
  input: HTMLInputElement,
  imageUrl: string
): Promise<void> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch image: HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const filename =
    imageUrl.split("/").pop()?.split("?")[0] || "image.jpg";
  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });

  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/** MutationObserver で要素出現を待つ */
function waitForElement<T extends Element>(
  selector: string,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<T>(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    const observer = new MutationObserver(() => {
      const el = document.querySelector<T>(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(
        new Error(
          `Element not found within ${timeoutMs}ms: ${selector}`
        )
      );
    }, timeoutMs);
  });
}

/** URL が変化したら成功とみなす（仮実装、Phase 5-4 で改良予定） */
function waitForUrlChange(timeoutMs: number): Promise<boolean> {
  const initialUrl = location.href;
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (location.href !== initialUrl) {
        resolve(true);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}
