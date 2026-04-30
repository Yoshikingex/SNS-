import { NextResponse } from "next/server";
import type { ImageItem, Platform, PostStatus } from "@posting/shared";
import { createClient } from "@/lib/supabase/server";
import {
  dispatchToApiPlatforms,
  isApiPlatform
} from "@/lib/sns/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const postId = params.id;
  if (!postId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // posts を取得（RLS により本人のみアクセス可）
  const { data: post, error: postErr } = await supabase
    .from("posts")
    .select("id, body_common, images, user_id")
    .eq("id", postId)
    .maybeSingle();

  if (postErr) {
    return NextResponse.json({ error: postErr.message }, { status: 500 });
  }
  if (!post) {
    return NextResponse.json(
      { error: "post not found or no permission" },
      { status: 404 }
    );
  }

  // failed の post_targets を取得
  const { data: failedTargets, error: tErr } = await supabase
    .from("post_targets")
    .select("id, platform, status")
    .eq("post_id", postId)
    .eq("status", "failed");

  if (tErr) {
    return NextResponse.json({ error: tErr.message }, { status: 500 });
  }
  if (!failedTargets || failedTargets.length === 0) {
    return NextResponse.json(
      { error: "no failed targets to retry" },
      { status: 400 }
    );
  }

  // 一旦 pending に戻す + error_message クリア
  const targetIds = failedTargets.map((t) => t.id as string);
  await supabase
    .from("post_targets")
    .update({ status: "pending", error_message: null })
    .in("id", targetIds);

  // API 系 (x/bluesky) のみ即時再投稿、拡張系 (relaxy/02) は pending のまま残す
  const apiTargets = failedTargets
    .filter((t) => isApiPlatform(t.platform as Platform))
    .map((t) => ({ id: t.id as string, platform: t.platform as Platform }));

  const images: ImageItem[] = Array.isArray(post.images) ? post.images : [];

  const results = await dispatchToApiPlatforms(
    post.user_id as string,
    post.body_common as string,
    images,
    apiTargets
  );

  // 結果を post_targets に反映
  const nowIso = new Date().toISOString();
  for (const r of results) {
    const update: {
      status: PostStatus;
      external_post_url?: string;
      posted_at?: string;
      error_message?: string | null;
    } = { status: r.status };
    if (r.status === "success") {
      update.external_post_url = r.external_post_url;
      update.posted_at = nowIso;
      update.error_message = null;
    } else {
      update.error_message = r.error_message ?? "unknown";
    }
    const { error: upErr } = await supabase
      .from("post_targets")
      .update(update)
      .eq("id", r.id);
    if (upErr) {
      console.error("retry: post_targets update failed:", upErr);
    }
  }

  // posts.status を再集計
  const { data: allTargets } = await supabase
    .from("post_targets")
    .select("status")
    .eq("post_id", postId);

  let newStatus: PostStatus;
  const statuses = allTargets?.map((t) => t.status as PostStatus) ?? [];
  if (statuses.length > 0 && statuses.every((s) => s === "success")) {
    newStatus = "success";
  } else if (statuses.some((s) => s === "failed")) {
    newStatus = "failed";
  } else {
    newStatus = "pending";
  }
  await supabase.from("posts").update({ status: newStatus }).eq("id", postId);

  return NextResponse.json({
    post_id: postId,
    retried_targets: failedTargets.length,
    api_results: results,
    extension_pending_count: failedTargets.length - results.length,
    new_status: newStatus
  });
}
