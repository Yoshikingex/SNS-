// Phase 6-2 #ui Web アプリと拡張のブリッジ
// localhost:3000 / Vercel 本番のページで動き、Web ページに「拡張インストール済み」と通知する。
// onboarding の Step1（拡張検知）と /dashboard 等で使われる。

console.log("[投稿一括統合システム/web-bridge] loaded");

// ページ読み込み時に1回 announce する（onboarding の useEffect が listen している）
function announce(): void {
  window.postMessage(
    {
      source: "post-integration-extension",
      type: "installed",
      extensionId: chrome.runtime.id
    },
    "*"
  );
}

announce();

// Web ページ側から ping を受けたら pong を返す
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data as { source?: string; type?: string } | null;
  if (data?.source !== "post-integration-app") return;
  if (data?.type !== "ping_extension") return;

  window.postMessage(
    {
      source: "post-integration-extension",
      type: "pong",
      extensionId: chrome.runtime.id
    },
    "*"
  );
});
