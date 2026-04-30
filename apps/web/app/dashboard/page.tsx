import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-md min-h-screen px-4 py-12 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-600">ログイン中: {user.email}</p>
      </header>

      <nav className="grid gap-3">
        <Link
          href="/dashboard/compose"
          className="rounded bg-black px-4 py-3 text-center text-white font-bold"
        >
          投稿を作成
        </Link>
        <Link
          href="/settings/connections"
          className="rounded border px-4 py-3 text-center"
        >
          SNS連携設定
        </Link>
      </nav>

      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="w-full rounded bg-gray-700 px-4 py-2 text-white"
        >
          ログアウト
        </button>
      </form>
    </main>
  );
}
