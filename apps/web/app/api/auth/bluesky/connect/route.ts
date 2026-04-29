import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveBlueskyCredentials } from "@/lib/sns/bluesky";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { identifier?: string; app_password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const identifier = body.identifier?.trim();
  const appPassword = body.app_password?.trim();

  if (!identifier || !appPassword) {
    return NextResponse.json(
      { error: "identifier と app_password は必須です" },
      { status: 400 }
    );
  }

  try {
    const { handle } = await saveBlueskyCredentials(
      user.id,
      identifier,
      appPassword
    );
    return NextResponse.json({ ok: true, handle });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "connect failed";
    return NextResponse.json(
      { error: `Bluesky 連携失敗: ${msg}` },
      { status: 401 }
    );
  }
}
