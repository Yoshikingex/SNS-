// Phase 5-1 #ops 拡張 Service Worker (MV3 background)
// Phase 5-2 #ops リラクシィー投稿フローを追加
// 役割:
//   - Web アプリからの ping (Phase 5-1) と post_to_relaxy (Phase 5-2) を受け取る
//   - リラクシィー: tab を開く → content script に投稿タスク渡す → 結果を /api/post-targets/:id/status に PATCH

import type {
  ContentPostResult,
  ExternalPostRequest
} from "./types";
import { refreshSelectors, setApiBaseUrl } from "./lib/selectors";

const ALARM_REFRESH_SELECTORS = "refresh_selectors";

type ConnectionState = {
  connected: boolean;
  last_ping: string | null;
  last_origin: string | null;
};

const INITIAL_STATE: ConnectionState = {
  connected: false,
  last_ping: null,
  last_origin: null
};

// tabId -> 投稿タスク（content script への引き渡しと結果通知に使う）
type PendingTask = {
  postTargetId: string;
  text: string;
  imageUrl?: string;
  apiBaseUrl: string;
};
const pendingTasks = new Map<number, PendingTask>();

chrome.runtime.onInstalled.addListener(() => {
  console.log("[投稿一括統合システム] extension installed");
  chrome.storage.local.set(INITIAL_STATE);
  // Phase 5-4: 拡張インストール直後にセレクタを取得 + 1分間隔の alarm 開始
  void refreshSelectors();
  chrome.alarms.create(ALARM_REFRESH_SELECTORS, { periodInMinutes: 1 });
});

// 拡張起動（ブラウザ起動）時にもセレクタを取得して alarm を再生成
chrome.runtime.onStartup.addListener(() => {
  console.log("[投稿一括統合システム] browser startup");
  void refreshSelectors();
  chrome.alarms.create(ALARM_REFRESH_SELECTORS, { periodInMinutes: 1 });
});

// alarm 発火: 1分ごとにセレクタを再取得
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_REFRESH_SELECTORS) {
    void refreshSelectors();
  }
});

// ===== Web アプリ → 拡張 (externally_connectable) =====

chrome.runtime.onMessageExternal.addListener(
  (message: unknown, sender, sendResponse) => {
    const msg = message as { type?: string } | null;

    // Phase 5-1: ping/pong + 接続状態保存
    if (msg?.type === "ping") {
      const state: ConnectionState = {
        connected: true,
        last_ping: new Date().toISOString(),
        last_origin: sender.origin ?? sender.url ?? null
      };
      chrome.storage.local.set(state);
      // Phase 5-4: Web オリジンを apiBaseUrl として保存して、selectors 取得先に使う
      if (sender.origin) {
        void setApiBaseUrl(sender.origin);
        // 即時に1回 refresh しておく（次の alarm を待たない）
        void refreshSelectors();
      }
      sendResponse({
        type: "pong",
        extensionId: chrome.runtime.id,
        receivedAt: state.last_ping
      });
      return true;
    }

    // Phase 5-2/5-3: リラクシィー or 02 への投稿リクエスト（同一フロー）
    if (msg?.type === "post_to_relaxy" || msg?.type === "post_to_02") {
      handleExtensionPost(msg as ExternalPostRequest)
        .then((r) => sendResponse(r))
        .catch((e) =>
          sendResponse({
            error: e instanceof Error ? e.message : String(e)
          })
        );
      return true; // async response
    }

    sendResponse({ error: `unknown message type: ${msg?.type ?? "(none)"}` });
    return true;
  }
);

async function handleExtensionPost(
  req: ExternalPostRequest
): Promise<{ ok: boolean; tabId: number }> {
  if (!req.formUrl || !req.postTargetId || !req.apiBaseUrl) {
    throw new Error(
      `${req.type}: formUrl / postTargetId / apiBaseUrl are required`
    );
  }
  // 背面タブを開く
  const tab = await chrome.tabs.create({
    url: req.formUrl,
    active: false
  });
  if (!tab.id) {
    throw new Error("tabs.create returned no id");
  }
  pendingTasks.set(tab.id, {
    postTargetId: req.postTargetId,
    text: req.text,
    imageUrl: req.imageUrl,
    apiBaseUrl: req.apiBaseUrl
  });
  return { ok: true, tabId: tab.id };
}

// ===== content script ↔ background 内部メッセージ =====

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  const msg = message as { type?: string } | null;

  // ポップアップからの状態取得 (Phase 5-1)
  if (msg?.type === "get_status") {
    chrome.storage.local.get(
      ["connected", "last_ping", "last_origin"],
      (data) => sendResponse(data as Partial<ConnectionState>)
    );
    return true;
  }

  // content script の準備完了通知 (Phase 5-2 relaxy / 5-3 02 共通)
  if (msg?.type === "relaxy_ready" || msg?.type === "02_ready") {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ task: null });
      return true;
    }
    const task = pendingTasks.get(tabId);
    if (!task) {
      sendResponse({ task: null });
      return true;
    }
    sendResponse({
      task: {
        postTargetId: task.postTargetId,
        text: task.text,
        imageUrl: task.imageUrl
      }
    });
    return true;
  }

  // content script からの結果通知 (Phase 5-2 relaxy / 5-3 02 共通)
  if (msg?.type === "relaxy_result" || msg?.type === "02_result") {
    const tabId = sender.tab?.id;
    const result = (msg as { result?: ContentPostResult }).result;
    const postTargetId = (msg as { postTargetId?: string }).postTargetId;
    if (!tabId || !result || !postTargetId) {
      return false;
    }
    void finalizeExtensionTask(tabId, postTargetId, result);
    return false;
  }

  return false;
});

async function finalizeExtensionTask(
  tabId: number,
  postTargetId: string,
  result: ContentPostResult
): Promise<void> {
  const task = pendingTasks.get(tabId);
  if (!task) return;

  // Web 側 API に PATCH（背景 fetch、host_permissions が必須）
  try {
    await fetch(
      `${task.apiBaseUrl}/api/post-targets/${postTargetId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Cookie 送信
        body: JSON.stringify({
          status: result.success ? "success" : "failed",
          external_post_url: result.externalPostUrl ?? null,
          error_message: result.errorMessage ?? null
        })
      }
    );
  } catch (e) {
    console.error(
      "[ext] status PATCH failed:",
      e instanceof Error ? e.message : e
    );
  }

  pendingTasks.delete(tabId);
  try {
    await chrome.tabs.remove(tabId);
  } catch (e) {
    console.warn("[ext] tab close failed:", e);
  }
}
