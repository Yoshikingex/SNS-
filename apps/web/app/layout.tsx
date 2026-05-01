import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matomell - マルチSNS同時投稿システム",
  description:
    "X / Bluesky / リラクシィー / 02 への投稿をひとつの画面から一括で。",
  applicationName: "Matomell",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Matomell"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
