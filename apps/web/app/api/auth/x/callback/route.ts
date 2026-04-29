import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@posting/shared";
import { exchangeCodeForToken } from "@/lib/sns/x";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/settings/connections?error=${encodeURIComponent(error)}`,
        request.url
      )
    );
  }

  const cookieStore = cookies();
  const savedState = cookieStore.get("x_oauth_state")?.value;
  const codeVerifier = cookieStore.get("x_oauth_verifier")?.value;
  cookieStore.delete("x_oauth_state");
  cookieStore.delete("x_oauth_verifier");

  if (!code || !state || !savedState || !codeVerifier || state !== savedState) {
    return NextResponse.redirect(
      new URL("/settings/connections?error=invalid_state", request.url)
    );
  }

  try {
    const creds = await exchangeCodeForToken({ code, codeVerifier });
    const encrypted = encrypt(JSON.stringify(creds));

    const { data: existing } = await supabase
      .from("sns_accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("platform", "x")
      .maybeSingle();

    if (existing) {
      const { error: upErr } = await supabase
        .from("sns_accounts")
        .update({
          account_name: creds.x_username,
          encrypted_credentials: encrypted,
          is_active: true
        })
        .eq("id", existing.id);
      if (upErr) throw new Error(upErr.message);
    } else {
      const { error: insErr } = await supabase.from("sns_accounts").insert({
        user_id: user.id,
        platform: "x",
        account_name: creds.x_username,
        encrypted_credentials: encrypted,
        is_active: true
      });
      if (insErr) throw new Error(insErr.message);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "token_exchange_failed";
    return NextResponse.redirect(
      new URL(`/settings/connections?error=${encodeURIComponent(msg)}`, request.url)
    );
  }

  return NextResponse.redirect(
    new URL("/settings/connections?success=1", request.url)
  );
}
