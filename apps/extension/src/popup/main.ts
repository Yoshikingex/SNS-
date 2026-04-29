// Phase 5-1 #ops 拡張ポップアップ
// background が chrome.storage.local に保存した接続状態を取得して表示

const statusEl = document.getElementById("status") as HTMLDivElement;
const extIdEl = document.getElementById("ext-id") as HTMLElement;
const lastPingEl = document.getElementById("last-ping") as HTMLElement;
const lastOriginEl = document.getElementById("last-origin") as HTMLElement;

extIdEl.textContent = chrome.runtime.id;

chrome.runtime.sendMessage({ type: "get_status" }, (data) => {
  if (chrome.runtime.lastError) {
    statusEl.className = "status status-disconnected";
    statusEl.textContent = "エラー: " + chrome.runtime.lastError.message;
    return;
  }

  const connected = !!(data && data.connected);
  if (connected) {
    statusEl.className = "status status-connected";
    statusEl.textContent = "Webアプリと接続中";
  } else {
    statusEl.className = "status status-disconnected";
    statusEl.textContent = "未接続";
  }

  lastPingEl.textContent = data?.last_ping ?? "未受信";
  lastOriginEl.textContent = data?.last_origin ?? "未受信";
});
