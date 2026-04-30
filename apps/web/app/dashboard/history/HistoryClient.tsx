"use client";

import { useState } from "react";
import Link from "next/link";
import { copyToClipboard } from "@/lib/clipboard";

const PLATFORM_LABEL: Record<string, string> = {
  x: "X",
  bluesky: "Bluesky",
  relaxy: "リラクシィー",
  "02": "02"
};

const STATUS_BADGE: Record<
  string,
  { icon: string; bg: string; label: string }
> = {
  success: { icon: "✅", bg: "bg-green-100 text-green-700", label: "成功" },
  failed: { icon: "❌", bg: "bg-red-100 text-red-700", label: "失敗" },
  pending: { icon: "⏳", bg: "bg-yellow-100 text-yellow-700", label: "待機中" }
};

// 業界SNS の手動投稿用 URL（実 URL）
const MANUAL_OPEN_URL: Record<string, string> = {
  relaxy: "https://rx-sns.jp/",
  "02": "https://m-sns.net/user/post/"
};

export type PostTargetSlim = {
  id: string;
  platform: string;
  status: string;
  external_post_url: string | null;
  error_message: string | null;
  posted_at: string | null;
};

export type PostWithTargets = {
  id: string;
  body_common: string;
  images: unknown[];
  status: string;
  created_at: string;
  post_targets: PostTargetSlim[];
};

export function HistoryClient({
  posts,
  totalCount,
  currentPage,
  pageSize
}: {
  posts: PostWithTargets[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<Record<string, string>>({});
  const [copyMsg, setCopyMsg] = useState<Record<string, string>>({});

  async function onRetry(postId: string) {
    setRetryingId(postId);
    setRetryError((prev) => ({ ...prev, [postId]: "" }));
    try {
      const res = await fetch(`/api/posts/${postId}/retry`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      // 再読込で最新状態を反映
      window.location.reload();
    } catch (e) {
      setRetryError((prev) => ({
        ...prev,
        [postId]: e instanceof Error ? e.message : "再試行に失敗しました"
      }));
    } finally {
      setRetryingId(null);
    }
  }

  function openManual(platform: string) {
    const url = MANUAL_OPEN_URL[platform];
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleCopy(targetId: string, text: string) {
    const ok = await copyToClipboard(text);
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
      window.location.reload();
    } catch (e) {
      alert(
        "投稿完了の記録に失敗しました: " +
          (e instanceof Error ? e.message : "unknown")
      );
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">投稿履歴</h1>
        <Link href="/dashboard" className="text-sm text-blue-600 underline">
          ダッシュボードへ
        </Link>
      </header>

      <p className="text-xs text-gray-600">
        過去30日の投稿を新しい順に表示しています（{totalCount} 件）。
      </p>

      {posts.length === 0 ? (
        <div className="rounded border bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-600">
            過去30日の投稿はまだありません
          </p>
          <Link
            href="/dashboard/compose"
            className="mt-4 inline-block rounded bg-black px-4 py-2 text-sm text-white"
          >
            投稿を作成
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => {
            const failedTargets = post.post_targets.filter(
              (t) => t.status === "failed"
            );
            // pending/failed の relaxy/02 はコピペ手動投稿の対象
            const manualTargets = post.post_targets.filter(
              (t) =>
                (t.platform === "relaxy" || t.platform === "02") &&
                (t.status === "pending" || t.status === "failed")
            );
            const hasRetryable = failedTargets.length > 0;
            const hasManual = manualTargets.length > 0;
            const isRetrying = retryingId === post.id;

            return (
              <li
                key={post.id}
                className="rounded border bg-white p-4 space-y-2"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-xs text-gray-500 tabular-nums">
                    {formatDate(post.created_at)}
                  </span>
                  <StatusPill status={post.status} />
                </div>

                <p className="text-sm whitespace-pre-wrap break-words">
                  {truncate(post.body_common, 120)}
                </p>

                {post.post_targets.length > 0 && (
                  <ul className="space-y-1">
                    {post.post_targets
                      .slice()
                      .sort((a, b) => a.platform.localeCompare(b.platform))
                      .map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="w-24 font-semibold">
                            {PLATFORM_LABEL[t.platform] ?? t.platform}
                          </span>
                          <StatusPill status={t.status} />
                          {t.external_post_url ? (
                            <a
                              href={t.external_post_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 truncate text-blue-600 underline"
                            >
                              {t.external_post_url}
                            </a>
                          ) : t.error_message ? (
                            <span className="flex-1 truncate text-red-600">
                              {t.error_message}
                            </span>
                          ) : (
                            <span className="flex-1 text-gray-500">
                              {STATUS_BADGE[t.status]?.label ?? t.status}
                            </span>
                          )}
                        </li>
                      ))}
                  </ul>
                )}

                {(hasRetryable || hasManual) && (
                  <div className="space-y-2 pt-2 border-t">
                    {hasRetryable && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onRetry(post.id)}
                          disabled={isRetrying}
                          className="rounded bg-black px-3 py-1.5 text-xs text-white disabled:bg-gray-300"
                        >
                          {isRetrying ? "再試行中..." : "再試行"}
                        </button>
                        {retryError[post.id] && (
                          <span className="text-xs text-red-600">
                            {retryError[post.id]}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 手動投稿フロー（relaxy / 02 で pending or failed の場合） */}
                    {manualTargets.map((t) => (
                      <div
                        key={`manual-${t.id}`}
                        className="rounded bg-blue-50 p-2 text-xs"
                      >
                        <div className="mb-1 font-semibold">
                          {PLATFORM_LABEL[t.platform]} 手動投稿フロー
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(t.id, post.body_common)
                            }
                            className="rounded border bg-white px-2 py-1 hover:bg-gray-100"
                          >
                            📋 本文をコピー
                          </button>
                          <button
                            type="button"
                            onClick={() => openManual(t.platform)}
                            className="rounded border bg-white px-2 py-1 hover:bg-gray-100"
                          >
                            🌐 {PLATFORM_LABEL[t.platform]}を開く
                          </button>
                          <button
                            type="button"
                            onClick={() => markAsSuccess(t.id)}
                            className="rounded bg-green-600 px-2 py-1 text-white hover:bg-green-700"
                          >
                            ✅ 投稿完了として記録
                          </button>
                          {copyMsg[t.id] && (
                            <span className="text-green-700">
                              {copyMsg[t.id]}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-4">
          {currentPage > 1 ? (
            <Link
              href={`/dashboard/history?page=${currentPage - 1}`}
              className="rounded border px-3 py-1.5 text-sm"
            >
              ← 前へ
            </Link>
          ) : (
            <span className="rounded border px-3 py-1.5 text-sm opacity-40">
              ← 前へ
            </span>
          )}
          <span className="text-sm text-gray-600 tabular-nums">
            {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              href={`/dashboard/history?page=${currentPage + 1}`}
              className="rounded border px-3 py-1.5 text-sm"
            >
              次へ →
            </Link>
          ) : (
            <span className="rounded border px-3 py-1.5 text-sm opacity-40">
              次へ →
            </span>
          )}
        </nav>
      )}
    </main>
  );
}

function StatusPill({ status }: { status: string }) {
  const badge =
    STATUS_BADGE[status] ?? {
      icon: "?",
      bg: "bg-gray-100 text-gray-700",
      label: status
    };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${badge.bg}`}
    >
      <span>{badge.icon}</span>
      <span>{badge.label}</span>
    </span>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}
