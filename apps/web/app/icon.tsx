import { ImageResponse } from "next/og";

// Next.js 14 動的アイコン生成（PWA / favicon 兼用）
// runtime = edge は @vercel/og の prerender エラー回避
export const runtime = "edge";
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 110,
          fontWeight: 800,
          letterSpacing: -4,
          fontFamily: "sans-serif"
        }}
      >
        M
      </div>
    ),
    { ...size }
  );
}
