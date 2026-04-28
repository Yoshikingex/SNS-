import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default function LoginPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        action={login}
        className="w-full max-w-sm space-y-4 rounded-md border p-6"
      >
        <h1 className="text-2xl font-bold">ログイン</h1>
        {searchParams.error && (
          <p className="text-sm text-red-600">{searchParams.error}</p>
        )}
        <label className="block">
          <span className="text-sm">メールアドレス</span>
          <input
            type="email"
            name="email"
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm">パスワード</span>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded bg-black px-4 py-2 text-white"
        >
          ログイン
        </button>
        <p className="text-sm">
          アカウント未作成？{" "}
          <Link href="/signup" className="underline">
            サインアップ
          </Link>
        </p>
      </form>
    </main>
  );
}
