// Phase 6-1 #ui 画像クライアント圧縮ユーティリティ
// canvas API で画像を WebP / 1080x1080 にリサイズして Data URL を返す。
// 縮小のみ（拡大はしない）、アスペクト比保持。

const MAX_DIMENSION = 1080;
const WEBP_QUALITY = 0.85;

export type CompressedImage = {
  dataUrl: string;
  width: number;
  height: number;
  byteSize: number;
};

export async function compressImage(file: File): Promise<CompressedImage> {
  // <img> に読み込み
  const img = await loadImage(file);

  // 縮小サイズを決定（アスペクト比保持、縮小のみ）
  let width = img.naturalWidth;
  let height = img.naturalHeight;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width >= height) {
      height = Math.round((height / width) * MAX_DIMENSION);
      width = MAX_DIMENSION;
    } else {
      width = Math.round((width / height) * MAX_DIMENSION);
      height = MAX_DIMENSION;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d context not available");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
  const dataUrl = await blobToDataUrl(blob);
  return { dataUrl, width, height, byteSize: blob.size };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
      type,
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}
