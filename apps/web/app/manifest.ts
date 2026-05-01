import type { MetadataRoute } from "next";

// PWA Web App Manifest
// スマホで「ホーム画面に追加」 → アプリ風アイコンで起動可能に
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Matomell - マルチSNS同時投稿システム",
    short_name: "Matomell",
    description:
      "X / Bluesky / リラクシィー / 02 への投稿をひとつの画面から一括で。",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#000000",
    lang: "ja",
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any"
      }
    ]
  };
}
