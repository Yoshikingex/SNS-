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

    // Supabase Free プランは確認メール送信が必須かつレート制限が厳しい（1h数通）。
    // 確認メールを完全にスキップするため、Admin API でユーザーを直接作成する。
    // email_confirm: true で作成された瞬間から確認済み状態になり、
    // メール送信も一切発生しない（= レート制限を消費しない）。
    let createErrorMsg: string | null = null;
    try {
      const admin = createAdminClient();
      const { error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      if (createError) createErrorMsg = createError.message;
    } catch (e) {
      createErrorMsg = e instanceof Error ? e.message : "createUser failed";
    }
    if (createErrorMsg) {
      redirect(`/signup?error=${encodeURIComponent(createErrorMsg)}`);
    }

    // 作成済みユーザーで即ログインして Cookie を確立。
    const supabase = createClient();
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
