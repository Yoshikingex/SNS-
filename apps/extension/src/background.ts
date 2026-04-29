// Phase 5-1 #ops 拡張 Service Worker (MV3 background)
// 役割:
//   - Web アプリ (externally_connectable) からの ping を受け取り pong を返す
//   - 接続状態を chrome.storage.local に記録（ポップアップが読む）
//   - 拡張内部メッセージ get_status に応答

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

chrome.runtime.onInstalled.addListener(() => {
  console.log("[投稿一括統合システム] extension installed");
  chrome.storage.local.set(INITIAL_STATE);
});

// Web アプリ（許可されたオリジン）からの外部メッセージ
chrome.runtime.onMessageExternal.addListener(
  (message: unknown, sender, sendResponse) => {
    const msg = message as { type?: string } | null;

    if (msg?.type === "ping") {
      const state: ConnectionState = {
        connected: true,
        last_ping: new Date().toISOString(),
        last_origin: sender.origin ?? sender.url ?? null
      };
      chrome.storage.local.set(state);
      sendResponse({
        type: "pong",
        extensionId: chrome.runtime.id,
        receivedAt: state.last_ping
      });
      return true; // async response
    }

    sendResponse({ error: `unknown message type: ${msg?.type ?? "(none)"}` });
    return true;
  }
);

// ポップアップからの内部メッセージ
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const msg = message as { type?: string } | null;

  if (msg?.type === "get_status") {
    chrome.storage.local.get(
      ["connected", "last_ping", "last_origin"],
      (data) => sendResponse(data as Partial<ConnectionState>)
    );
    return true; // async
  }

  return false;
});
