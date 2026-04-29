import { NextResponse } from "next/server";
import type { ImageItem, Platform, PostStatus } from "@posting/shared";
import { createClient } from "@/lib/supabase/server";
import {
  API_PLATFORMS,
  dispatchToApiPlatforms,
  isApiPlatform
} from "@/lib/sns/dispatch";

export const dynamic = "force-dynamic";
// API 系 4回試行 + バックオフ 1+2+4 = 7秒 + 各投稿の処理時間で
// Vercel Hobby (10秒) を超える可能性あり。タイムアウトは Phase 7 で
// キュー化検討（今は同期実行）
export const maxDuration = 60;

const ALLOWED_PLATFORMS: readonly Platform[] = [
  "x",
  "bluesky",
  "relaxy",
  "02"
] as const;

type RequestBody = {
  body_common?: string;
  images?: ImageItem[];
  target_platforms?: Platform[];
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ---- 入力検証 ----
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return badRequest("Invalid JSON");
  }

  if (!body.body_common || typeof body.body_common !== "string") {
    return badRequest("body_common is required (string)");
  }
  if (
    !body.target_platforms ||
    !Array.isArray(body.target_platforms) ||
    body.target_platforms.length === 0
  ) {
    return badRequest("target_platforms is required (non-empty array)");
  }
  for (const p of body.target_platforms) {
    if (!ALLOWED_PLATFORMS.includes(p)) {
      return badRequest(`invalid platform: ${p}`);
    }
  }
  // 重複除去（同じ platform に複数 target を作らない）
  const platforms: Platform[] = Array.from(new Set(body.target_platforms));

  const images: ImageItem[] = Array.isArray(body.images) ? body.images : [];

  // ---- posts INSERT ----
  const { data: post, error: postErr } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      body_common: body.body_common,
      images,
      status: "pending"
    })
    .select("id")
    .single();

  if (postErr || !post) {
    return NextResponse.json(
      { error: postErr?.message ?? "post create failed" },
      { status: 500 }
    );
  }

  // ---- post_targets INSERT (各 platform 1行) ----
  const targetRows = platforms.map((p) => ({
    post_id: post.id,
    platform: p,
    status: "pending" as const
  }));

  const { data: targets, error: targetsErr } = await supabase
    .from("post_targets")
    .insert(targetRows)
    .select("id, platform");

  if (targetsErr || !targets) {
    return NextResponse.json(
      { error: targetsErr?.message ?? "post_targets create failed" },
      { status: 500 }
    );
  }

  // ---- 即時投稿対象 (API 系) と 拡張系の振り分け ----
  const apiTargets = targets
    .filter((t) => isApiPlatform(t.platform as Platform))
    .map((t) => ({ id: t.id as string, platform: t.platform as Platform }));
  const extensionTargets = targets
    .filter((t) => !isApiPlatform(t.platform as Platform))
    .map((t) => ({ id: t.id as string, platform: t.platform as Platform }));

  // ---- API 系を並列投稿 ----
  const dispatchResults = await dispatchToApiPlatforms(
    user.id,
    body.body_common,
    images,
    apiTargets
  );

  // ---- post_targets 更新（API 系のみ） ----
  const nowIso = new Date().toISOString();
  for (const r of dispatchResults) {
    const update: {
      status: PostStatus;
      external_post_url?: string;
      posted_at?: string;
      error_message?: string;
    } = { status: r.status };
    if (r.status === "success") {
      update.external_post_url = r.external_post_url;
      update.posted_at = nowIso;
    } else {
      update.error_message = r.error_message ?? "unknown";
    }
    const { error: updErr } = await supabase
      .from("post_targets")
      .update(update)
      .eq("id", r.id);
    if (updErr) {
      // 更新失敗してもレスポンスは返す（記録できなかった点だけログ）
      console.error("post_targets update failed:", updErr);
    }
  }

  // ---- posts.status 集計 ----
  // 拡張系は pending のまま、API系の結果と合算
  const allStatuses: PostStatus[] = [
    ...dispatchResults.map((r) => r.status as PostStatus),
    ...extensionTargets.map(() => "pending" as PostStatus)
  ];

  let postStatus: PostStatus;
  if (allStatuses.every((s) => s === "success")) {
    postStatus = "success";
  } else if (allStatuses.some((s) => s === "failed")) {
    postStatus = "failed";
  } else {
    postStatus = "pending";
  }

  await supabase.from("posts").update({ status: postStatus }).eq("id", post.id);

  // ---- レスポンス ----
  const responseTargets = [
    ...dispatchResults.map((r) => ({
      id: r.id,
      platform: r.platform,
      status: r.status,
      external_post_url: r.external_post_url ?? null,
      error_message: r.error_message ?? null
    })),
    ...extensionTargets.map((t) => ({
      id: t.id,
      platform: t.platform,
      status: "pending" as PostStatus,
      external_post_url: null,
      error_message: null
    }))
  ];

  return NextResponse.json({
    post_id: post.id,
    status: postStatus,
    targets: responseTargets
  });
}
