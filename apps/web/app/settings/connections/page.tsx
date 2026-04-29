import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage({
  searchParams
}: {
  searchParams: { error?: string; success?: string };
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

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-md border p-6">
        <h1 className="text-2xl font-bold">SNS連携</h1>

        {searchParams.error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            エラー: {searchParams.error}
          </p>
        )}
        {searchParams.success && (
          <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
            連携が完了しました
          </p>
        )}

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
      </div>
    </main>
  );
}
