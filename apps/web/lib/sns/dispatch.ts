// Phase 4-3 #data
// 投稿ディスパッチャ: API 系 SNS (x, bluesky) を統一インターフェースで並列投稿
// - 指数バックオフ 1s/2s/4s で初回+3リトライ = 計4回試行
// - 拡張系 (relaxy, 02) はここでは扱わない（Phase 5 で Chrome 拡張機能が処理）

import type { ImageItem, Platform } from "@posting/shared";
import { postToBluesky } from "@/lib/sns/bluesky";
import { postToX } from "@/lib/sns/x";

export const API_PLATFORMS: readonly Platform[] = ["x", "bluesky"] as const;
export const EXTENSION_PLATFORMS: readonly Platform[] = ["relaxy", "02"] as const;
export const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

export type DispatchTarget = {
  id: string; // post_targets.id
  platform: Platform;
};

export type DispatchResult = {
  id: string;
  platform: Platform;
  status: "success" | "failed";
  external_post_url?: string;
  error_message?: string;
};

export function isApiPlatform(p: Platform): boolean {
  return (API_PLATFORMS as readonly string[]).includes(p);
}

/** 指数バックオフ付き再試行: 初回 + delays.length 回リトライ */
export async function postWithRetry<T>(
  fn: () => Promise<T>,
  delays: readonly number[] = RETRY_DELAYS_MS
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("retry exhausted with non-Error rejection");
}

/** Platform → 投稿関数を呼び、外部URL文字列を返す */
async function postToPlatform(
  platform: Platform,
  userId: string,
  body: string,
  images?: ImageItem[]
): Promise<{ externalPostUrl: string }> {
  if (platform === "x") {
    const r = await postToX(userId, body, images);
    return { externalPostUrl: r.url };
  }
  if (platform === "bluesky") {
    const r = await postToBluesky(userId, body, images);
    return { externalPostUrl: r.webUrl };
  }
  throw new Error(`platform '${platform}' is not handled by dispatch`);
}

/**
 * API 系 SNS に並列投稿（各 SNS は内部でリトライ）
 * Promise.allSettled で 1 つ失敗しても他は進める
 */
export async function dispatchToApiPlatforms(
  userId: string,
  body: string,
  images: ImageItem[] | undefined,
  targets: DispatchTarget[]
): Promise<DispatchResult[]> {
  const settled = await Promise.allSettled(
    targets.map(async (t) => {
      try {
        const r = await postWithRetry(() =>
          postToPlatform(t.platform, userId, body, images)
        );
        return {
          id: t.id,
          platform: t.platform,
          status: "success" as const,
          external_post_url: r.externalPostUrl
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown error";
        return {
          id: t.id,
          platform: t.platform,
          status: "failed" as const,
          error_message: msg
        };
      }
    })
  );

  return settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    // ここに来る可能性は低い（catch している）が、念のため
    const t = targets[i];
    return {
      id: t.id,
      platform: t.platform,
      status: "failed" as const,
      error_message:
        s.reason instanceof Error ? s.reason.message : "promise rejected"
    };
  });
}
