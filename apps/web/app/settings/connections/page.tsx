import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveBlueskyCredentials } from "@/lib/sns/bluesky";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage({
  searchParams
}: {
  searchParams: {
    error?: string;
    success?: string;
    bluesky_error?: string;
    bluesky_success?: string;
  };
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: accounts } = await supabase
    .from("sns_accounts")
    .select("id, platform, account_name, is_active")
    .eq("user_id", user.id);

  const xAccount = accounts?.find((a) => a.platform === "x");
  const blueskyAccount = accounts?.find((a) => a.platform === "bluesky");

  async function connectBluesky(formData: FormData) {
    "use server";
    const identifier = String(formData.get("identifier") ?? "").trim();
    const appPassword = String(formData.get("app_password") ?? "").trim();

    if (!identifier || !appPassword) {
      redirect(
        "/settings/connections?bluesky_error=" +
          encodeURIComponent("identifier と app_password は必須です")
      );
    }

    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      redirect("/login");
    }

    try {
      await saveBlueskyCredentials(user.id, identifier, appPassword);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "connect failed";
      redirect(
        `/settings/connections?bluesky_error=${encodeURIComponent(msg)}`
      );
    }

    redirect("/settings/connections?bluesky_success=1");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-8 rounded-md border p-6">
        <h1 className="text-2xl font-bold">SNS連携</h1>

        {searchParams.error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            X エラー: {searchParams.error}
          </p>
        )}
        {searchParams.success && (
          <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
            X 連携が完了しました
          </p>
        )}
        {searchParams.bluesky_error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            Bluesky エラー: {searchParams.bluesky_error}
          </p>
        )}
        {searchParams.bluesky_success && (
          <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
            Bluesky 連携が完了しました
          </p>
        )}

        {/* X (Twitter) */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">X (旧Twitter)</h2>
          {xAccount ? (
            <div className="space-y-2">
              <p className="text-sm">
                連携済み: <strong>@{xAccount.account_name}</strong>
              </p>
              <form action="/api/auth/x/disconnect" method="post">
                <button
                  type="submit"
                  className="rounded bg-gray-700 px-4 py-2 text-white"
                >
                  連携解除
                </button>
              </form>
            </div>
          ) : (
            <a
              href="/api/auth/x/start"
              className="inline-block rounded bg-black px-4 py-2 text-white"
            >
              Xと連携
            </a>
          )}
        </section>

        {/* Bluesky */}
        <section className="space-y-3 border-t pt-6">
          <h2 className="text-lg font-semibold">Bluesky</h2>
          {blueskyAccount ? (
            <div className="space-y-2">
              <p className="text-sm">
                連携済み: <strong>@{blueskyAccount.account_name}</strong>
              </p>
              <form action="/api/auth/bluesky/disconnect" method="post">
                <button
                  type="submit"
                  className="rounded bg-gray-700 px-4 py-2 text-white"
                >
                  連携解除
                </button>
              </form>
            </div>
          ) : (
            <form action={connectBluesky} className="space-y-3">
              <p className="text-xs text-gray-600">
                Bluesky アプリ → Settings → Privacy and Security → App Passwords で AppPassword を発行してから入力してください。
              </p>
              <label className="block">
                <span className="text-sm">Identifier (例: alice.bsky.social)</span>
                <input
                  type="text"
                  name="identifier"
                  required
                  autoComplete="username"
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-sm">AppPassword</span>
                <input
                  type="password"
                  name="app_password"
                  required
                  autoComplete="current-password"
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded bg-sky-600 px-4 py-2 text-white"
              >
                Blueskyと連携
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
