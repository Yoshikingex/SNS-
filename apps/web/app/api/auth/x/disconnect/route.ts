import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }

  await supabase
    .from("sns_accounts")
    .delete()
    .eq("user_id", user.id)
    .eq("platform", "x");

  return NextResponse.redirect(
    new URL("/settings/connections", request.url),
    { status: 303 }
  );
}
