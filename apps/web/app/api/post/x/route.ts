import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postToX } from "@/lib/sns/x";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { text?: string; image_url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.text || typeof body.text !== "string") {
    return NextResponse.json(
      { error: "text is required (string)" },
      { status: 400 }
    );
  }

  try {
    const images = body.image_url ? [{ url: body.image_url }] : undefined;
    const result = await postToX(user.id, body.text, images);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "post failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
