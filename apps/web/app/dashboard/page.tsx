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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-sm text-gray-600">ログイン中: {user.email}</p>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="rounded bg-gray-700 px-4 py-2 text-white"
        >
          ログアウト
        </button>
      </form>
    </main>
  );
}
