import { ImageResponse } from "next/og";

// iOS の「ホーム画面に追加」用アイコン
// runtime = edge は @vercel/og の prerender エラー回避
export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1f2937 0%, #4f46e5 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 100,
          fontWeight: 800,
          letterSpacing: -3,
          fontFamily: "sans-serif"
        }}
      >
        M
      </div>
    ),
    { ...size }
  );
}
