import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default function SignupPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  async function signup(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const supabase = createClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });

    if (signUpError) {
      redirect(`/signup?error=${encodeURIComponent(signUpError.message)}`);
    }

    // Supabase Free プランは「Confirm email」を OFF にできないため、
    // Service Role Key で email_confirmed_at を即時付与してログイン可能にする。
    const userId = signUpData.user?.id;
    let confirmErrorMsg: string | null = null;
    if (userId) {
      try {
        const admin = createAdminClient();
        const { error: confirmError } = await admin.auth.admin.updateUserById(
          userId,
          { email_confirm: true }
        );
        if (confirmError) confirmErrorMsg = confirmError.message;
      } catch (e) {
        confirmErrorMsg = e instanceof Error ? e.message : "auto-confirm failed";
      }
    }
    if (confirmErrorMsg) {
      redirect(`/signup?error=${encodeURIComponent(confirmErrorMsg)}`);
    }

    // 確認済みになったので即ログインさせて Cookie を確立。
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (signInError) {
      redirect(`/signup?error=${encodeURIComponent(signInError.message)}`);
    }

    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        action={signup}
        className="w-full max-w-sm space-y-4 rounded-md border p-6"
      >
        <h1 className="text-2xl font-bold">サインアップ</h1>
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
          <span className="text-sm">パスワード（6文字以上）</span>
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
          アカウント作成
        </button>
        <p className="text-sm">
          すでにアカウントをお持ちですか？{" "}
          <Link href="/login" className="underline">
            ログイン
          </Link>
        </p>
      </form>
    </main>
  );
}
