import { defineManifest } from "@crxjs/vite-plugin";

// Phase 5-1 #ops 拡張スケルトン
// host_permissions の relaxy.example / 02.example は仮 URL。
// Phase 5-2 / 5-3 で実 URL を確定する。
// externally_connectable は Web アプリ（localhost / Vercel 本番）からのみ ping を受け付ける。
export default defineManifest({
  manifest_version: 3,
  name: "投稿一括統合システム",
  description: "マルチSNS投稿のためのブラウザ拡張",
  version: "0.0.1",
  action: {
    default_popup: "src/popup/index.html",
    default_title: "投稿一括統合システム"
  },
  background: {
    service_worker: "src/background.ts",
    type: "module"
  },
  permissions: ["storage", "tabs", "scripting"],
  host_permissions: [
    "https://relaxy.example/*",
    "https://02.example/*"
  ],
  externally_connectable: {
    matches: [
      "http://localhost:3000/*",
      "https://post-integration-system.vercel.app/*",
      "https://post-integration-system-frees-projects-906fc790.vercel.app/*"
    ]
  }
});
