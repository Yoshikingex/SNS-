"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent
} from "react";
import Link from "next/link";
import { compressImage, type CompressedImage } from "@/lib/image";
import { copyToClipboard } from "@/lib/clipboard";

type Platform = "x" | "bluesky" | "relaxy" | "02";

type Connections = Record<Platform, boolean>;

// API 連携が必要なプラットフォーム（OAuth/AppPassword）
// それ以外（relaxy / 02）は拡張機能 + ユーザーのブラウザログインで動作
const REQUIRES_OAUTH: Record<Platform, boolean> = {
  x: true,
  bluesky: true,
  relaxy: false,
  "02": false
};

type ResultTarget = {
  id: string;
  platform: string;
  status: "success" | "failed" | "pending";
  external_post_url: string | null;
  error_message: string | null;
};

type PostResult = {
  post_id: string;
  status: string;
  targets: ResultTarget[];
};

const PLATFORMS: Platform[] = ["x", "bluesky", "relaxy", "02"];

const LIMITS: Record<Platform, number> = {
  x: 280,
  bluesky: 300,
  relaxy: 330, // rx-sns.jp の textarea maxlength="330" から確定
  "02": 280 // m-sns.net の文字数表示「0/280」から確定
};

// 業界SNS の手動投稿フロー用 URL
const MANUAL_URL: Record<string, string> = {
  relaxy: "https://rx-sns.jp/",
  "02": "https://m-sns.net/user/post/"
};

const COLORS: Record<Platform, string> = {
  x: "bg-black",
  bluesky: "bg-sky-500",
  relaxy: "bg-pink-500",
  "02": "bg-purple-500"
};

const LABELS: Record<Platform, string> = {
  x: "X (旧Twitter)",
  bluesky: "Bluesky",
  relaxy: "リラクシィー",
  "02": "02"
};

const MAX_IMAGES = 4;

export function ComposeClient({ connections }: { connections: Connections }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<CompressedImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imagesProcessing, setImagesProcessing] = useState(0);
  const [selected, setSelected] = useState<Record<Platform, boolean>>({
    x: connections.x,
    bluesky: connections.bluesky,
    // 業界系は OAuth 不要、default は OFF（ユーザーが必要時にチェック）
    relaxy: false,
    "02": false
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PostResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 文字数超過の SNS は自動 OFF
  useEffect(() => {
    const updates: Partial<Record<Platform, boolean>> = {};
    for (const p of PLATFORMS) {
      if (text.length > LIMITS[p] && selected[p]) {
        updates[p] = false;
      }
    }
    if (Object.keys(updates).length > 0) {
      setSelected((prev) => ({ ...prev, ...updates }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const overLimitPlatforms = useMemo(
    () => PLATFORMS.filter((p) => text.length > LIMITS[p]),
    [text]
  );

  const canSubmit =
    !submitting &&
    text.trim().length > 0 &&
    PLATFORMS.some(
      (p) => selected[p] && (REQUIRES_OAUTH[p] ? connections[p] : true)
    );

  async function handleFiles(files: FileList | File[]) {
    setImageError(null);
    const list = Array.from(files);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setImageError(`画像は最大 ${MAX_IMAGES} 枚までです`);
      return;
    }
    const toProcess = list.slice(0, remaining);
    setImagesProcessing((c) => c + toProcess.length);
    try {
      const compressed = await Promise.all(toProcess.map(compressImage));
      setImages((prev) => [...prev, ...compressed].slice(0, MAX_IMAGES));
    } catch (e) {
      setImageError(
        e instanceof Error ? e.message : "画像の処理に失敗しました"
      );
    } finally {
      setImagesProcessing((c) => Math.max(0, c - toProcess.length));
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      void handleFiles(e.target.files);
      e.target.value = "";
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    setResult(null);
    try {
      const target_platforms = PLATFORMS.filter(
        (p) => selected[p] && (REQUIRES_OAUTH[p] ? connections[p] : true)
      );
      if (target_platforms.length === 0) {
        throw new Error("投稿先のSNSが選択されていません");
      }
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body_common: text,
          images: images.map((img) => ({
            url: img.dataUrl,
            width: img.width,
            height: img.height
          })),
          target_platforms
        })
      });
      const data = (await res.json()) as PostResult & { error?: string };
      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setResult(data);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "投稿に失敗しました"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">投稿を作成</h1>
        <Link href="/dashboard" className="text-sm text-blue-600 underline">
          ダッシュボードへ
        </Link>
      </header>

      {/* テキスト入力 */}
      <section className="space-y-2">
        <label className="block">
          <span className="text-sm font-semibold">投稿本文</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="mt-1 w-full rounded border px-3 py-2"
            placeholder="ここに投稿する文章を入力..."
          />
        </label>

        {/* 文字数バー（4SNS） */}
        <div className="space-y-1">
          {PLATFORMS.map((p) => {
            const used = text.length;
            const limit = LIMITS[p];
            const ratio = Math.min(1, used / limit);
            const over = used > limit;
            return (
              <div key={p} className="flex items-center gap-2 text-xs">
                <span className="w-32">{LABELS[p]}</span>
                <div className="flex-1 h-2 rounded bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full ${over ? "bg-red-500" : COLORS[p]} transition-all`}
                    style={{ width: `${ratio * 100}%` }}
                  />
                </div>
                <span
                  className={`w-20 text-right tabular-nums ${over ? "text-red-600 font-bold" : "text-gray-600"}`}
                >
                  {used}/{limit}
                </span>
              </div>
            );
          })}
        </div>

        {overLimitPlatforms.length > 0 && (
          <p className="text-xs text-amber-700">
            ⚠️ 文字数オーバー: {overLimitPlatforms.map((p) => LABELS[p]).join(", ")} は自動で投稿先から外されました
          </p>
        )}
      </section>

      {/* 画像 */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          画像 ({images.length}/{MAX_IMAGES})
        </h2>
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="rounded border-2 border-dashed border-gray-300 p-4 text-center"
        >
          <p className="text-sm text-gray-600">
            ドラッグ＆ドロップ、または{" "}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-blue-600 underline"
            >
              ファイルを選択
            </button>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onFileChange}
            className="hidden"
          />
          <p className="mt-1 text-xs text-gray-500">
            最大 {MAX_IMAGES} 枚、自動で WebP / 1080px に圧縮されます
          </p>
        </div>
        {imagesProcessing > 0 && (
          <p className="text-xs text-gray-600">画像を圧縮中... ({imagesProcessing}枚)</p>
        )}
        {imageError && (
          <p className="text-xs text-red-600">{imageError}</p>
        )}
        {images.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative">
                <img
                  src={img.dataUrl}
                  alt={`uploaded ${i + 1}`}
                  className="w-full aspect-square object-cover rounded border"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 rounded-full bg-black/70 text-white px-2 text-xs"
                  aria-label="削除"
                >
                  ×
                </button>
                <p className="mt-1 text-[10px] text-gray-500 text-center">
                  {img.width}×{img.height} ({Math.round(img.byteSize / 1024)}KB)
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SNS 選択 */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">投稿先</h2>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map((p) => {
            const requiresOauth = REQUIRES_OAUTH[p];
            const connected = connections[p];
            const overLimit = text.length > LIMITS[p];
            // OAuth 必須なら未連携時に disabled、業界系（拡張対応）は文字数オーバーのみ
            const disabled = (requiresOauth && !connected) || overLimit;
            return (
              <label
                key={p}
                className={`flex items-center gap-2 rounded border px-3 py-2 ${
                  disabled
                    ? "opacity-60 bg-gray-50"
                    : "cursor-pointer hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected[p] && !disabled}
                  disabled={disabled}
                  onChange={(e) =>
                    setSelected((prev) => ({ ...prev, [p]: e.target.checked }))
                  }
                />
                <span className="flex-1 text-sm">{LABELS[p]}</span>
                {requiresOauth && !connected && (
                  <span className="text-xs text-gray-500">🔒 未連携</span>
                )}
                {!requiresOauth && (
                  <span className="text-xs text-gray-500">拡張で投稿</span>
                )}
                {overLimit && (requiresOauth ? connected : true) && (
                  <span className="text-xs text-red-500">超過</span>
                )}
              </label>
            );
          })}
        </div>
        {PLATFORMS.some((p) => REQUIRES_OAUTH[p] && !connections[p]) && (
          <p className="text-xs text-gray-600">
            未連携のSNS（X / Bluesky）は{" "}
            <Link href="/settings/connections" className="text-blue-600 underline">
              連携設定
            </Link>
            {" "}から登録してください
          </p>
        )}
        <p className="text-xs text-gray-500">
          リラクシィー / 02 はブラウザでログイン中なら、拡張機能 + コピペで投稿できます
        </p>
      </section>

      {/* 投稿ボタン */}
      <section className="space-y-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full rounded bg-black px-4 py-3 text-white font-bold disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {submitting ? "送信中..." : "全SNSに投稿する"}
        </button>
        {submitError && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            エラー: {submitError}
          </p>
        )}
      </section>

      {/* 結果表示 */}
      {result && (
        <ResultSection
          result={result}
          bodyText={text}
          setResult={setResult}
        />
      )}
    </main>
  );
}

// 結果セクション + コピペ補助 UI
function ResultSection({
  result,
  bodyText,
  setResult
}: {
  result: PostResult;
  bodyText: string;
  setResult: (r: PostResult) => void;
}) {
  const [copyMsg, setCopyMsg] = useState<Record<string, string>>({});

  async function handleCopy(targetId: string) {
    const ok = await copyToClipboard(bodyText);
    setCopyMsg((prev) => ({
      ...prev,
      [targetId]: ok ? "コピーしました" : "コピーに失敗"
    }));
    setTimeout(() => {
      setCopyMsg((prev) => ({ ...prev, [targetId]: "" }));
    }, 2000);
  }

  async function markAsSuccess(targetId: string) {
    try {
      const res = await fetch(`/api/post-targets/${targetId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "success",
          external_post_url: "(manual)",
          error_message: null
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      // ローカル状態を更新
      const updated: PostResult = {
        ...result,
        targets: result.targets.map((t) =>
          t.id === targetId
            ? { ...t, status: "success", external_post_url: "(manual)" }
            : t
        )
      };
      setResult(updated);
    } catch (e) {
      alert(
        "投稿完了の記録に失敗しました: " +
          (e instanceof Error ? e.message : "unknown")
      );
    }
  }

  return (
    <section className="space-y-3 rounded border bg-gray-50 p-4">
      <h2 className="text-sm font-semibold">投稿結果</h2>
      <p className="text-xs text-gray-600">
        post_id: <code>{result.post_id}</code> (status: {result.status})
      </p>
      <ul className="space-y-2">
        {result.targets.map((t) => {
          const isManual =
            (t.platform === "relaxy" || t.platform === "02") &&
            (t.status === "pending" || t.status === "failed");
          return (
            <li key={t.id} className="rounded border bg-white p-2 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span>
                  {t.status === "success"
                    ? "✅"
                    : t.status === "failed"
                      ? "❌"
                      : "⏳"}
                </span>
                <span className="font-semibold w-32">
                  {LABELS[t.platform as Platform] ?? t.platform}
                </span>
                {t.external_post_url && t.external_post_url !== "(manual)" ? (
                  <a
                    href={t.external_post_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline truncate text-xs"
                  >
                    {t.external_post_url}
                  </a>
                ) : t.external_post_url === "(manual)" ? (
                  <span className="text-xs text-green-700">
                    手動投稿として記録済み
                  </span>
                ) : t.error_message ? (
                  <span className="text-red-600 text-xs">
                    {t.error_message}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">
                    {t.status === "pending"
                      ? "拡張機能で処理中..."
                      : "処理中"}
                  </span>
                )}
              </div>

              {isManual && (
                <div className="flex flex-wrap items-center gap-2 pl-6 text-xs">
                  <button
                    type="button"
                    onClick={() => handleCopy(t.id)}
                    className="rounded border bg-white px-2 py-1 hover:bg-gray-100"
                  >
                    📋 本文をコピー
                  </button>
                  <a
                    href={MANUAL_URL[t.platform]}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded border bg-white px-2 py-1 hover:bg-gray-100"
                  >
                    🌐 {LABELS[t.platform as Platform]}を開く
                  </a>
                  <button
                    type="button"
                    onClick={() => markAsSuccess(t.id)}
                    className="rounded bg-green-600 px-2 py-1 text-white hover:bg-green-700"
                  >
                    ✅ 投稿完了として記録
                  </button>
                  {copyMsg[t.id] && (
                    <span className="text-green-700">{copyMsg[t.id]}</span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
