import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { generateAuthLink } from "@/lib/sns/x";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let url: string;
  let codeVerifier: string;
  let state: string;
  try {
    ({ url, codeVerifier, state } = generateAuthLink());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(
      new URL(`/settings/connections?error=${encodeURIComponent(msg)}`, request.url)
    );
  }

  const cookieStore = cookies();
  const isProd = process.env.NODE_ENV === "production";
  cookieStore.set("x_oauth_state", state, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 600,
    path: "/"
  });
  cookieStore.set("x_oauth_verifier", codeVerifier, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 600,
    path: "/"
  });

  return NextResponse.redirect(url);
}
