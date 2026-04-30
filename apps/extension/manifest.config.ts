import { defineManifest } from "@crxjs/vite-plugin";

// Phase 5-1 #ops 拡張スケルトン + Phase 5-2 #ops リラクシィー content script
// host_permissions の relaxy.example / 02.example は仮値。
// Phase 5-2 / 5-3 で実 URL に差替予定。
// host_permissions に Web 側ドメインも含める（background から PATCH するため）。
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
    "https://02.example/*",
    "http://localhost:3000/*",
    "https://post-integration-system.vercel.app/*",
    "https://post-integration-system-frees-projects-906fc790.vercel.app/*"
  ],
  externally_connectable: {
    matches: [
      "http://localhost:3000/*",
      "https://post-integration-system.vercel.app/*",
      "https://post-integration-system-frees-projects-906fc790.vercel.app/*"
    ]
  },
  content_scripts: [
    {
      matches: ["https://relaxy.example/*"],
      js: ["src/content/relaxy.ts"],
      run_at: "document_idle"
    },
    {
      matches: ["https://02.example/*"],
      js: ["src/content/zero-two.ts"],
      run_at: "document_idle"
    }
  ]
});
