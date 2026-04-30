// Phase 5-2 #ops: Chrome 拡張機能から post_targets のステータスを更新する PATCH エンドポイント
// RLS により本人の posts に紐付く post_targets のみ更新可能

import { NextResponse } from "next/server";
import type { PostStatus } from "@posting/shared";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS: readonly PostStatus[] = [
  "pending",
  "success",
  "failed"
] as const;

type RequestBody = {
  status?: PostStatus;
  external_post_url?: string | null;
  error_message?: string | null;
};

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: {
    status?: PostStatus;
    external_post_url?: string | null;
    error_message?: string | null;
    posted_at?: string;
  } = {};

  if (body.status !== undefined) {
    if (!ALLOWED_STATUS.includes(body.status)) {
      return NextResponse.json(
        { error: `invalid status: ${body.status}` },
        { status: 400 }
      );
    }
    update.status = body.status;
    if (body.status === "success") {
      update.posted_at = new Date().toISOString();
    }
  }
  if (body.external_post_url !== undefined) {
    update.external_post_url = body.external_post_url;
  }
  if (body.error_message !== undefined) {
    update.error_message = body.error_message;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "no fields to update" },
      { status: 400 }
    );
  }

  // RLS により本人の posts に紐付く post_targets のみ更新される
  const { data, error } = await supabase
    .from("post_targets")
    .update(update)
    .eq("id", id)
    .select("id, status, external_post_url, error_message, posted_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "post_target not found or no permission" },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
