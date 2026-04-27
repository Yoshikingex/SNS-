import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "投稿一括統合システム Extension",
  description: "Multi-SNS posting helper extension (skeleton)",
  version: "0.0.1",
  action: {
    default_popup: "src/popup/index.html"
  },
  permissions: []
});
