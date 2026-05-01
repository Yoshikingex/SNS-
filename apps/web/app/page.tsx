import Link from "next/link";

export default function Page() {
  return (
    <main className="mx-auto max-w-md min-h-screen px-4 py-12 space-y-6 text-center">
      <h1 className="text-4xl font-bold">Matomell</h1>
      <p className="text-sm text-gray-600">マルチSNS同時投稿システム</p>
      <p className="text-xs text-gray-500 leading-relaxed">
        X / Bluesky / リラクシィー / 02 への投稿を、ひとつの画面から一括で。
      </p>
      <div className="grid gap-3 pt-4">
        <Link
          href="/login"
          className="rounded bg-black px-4 py-3 text-white font-bold"
        >
          ログイン
        </Link>
        <Link
          href="/signup"
          className="rounded border px-4 py-3"
        >
          新規登録
        </Link>
      </div>
    </main>
  );
}
