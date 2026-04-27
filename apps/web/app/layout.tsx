import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "投稿一括統合システム",
  description: "Multi-SNS posting SaaS"
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
