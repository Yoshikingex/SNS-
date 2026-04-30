import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HistoryClient, type PostWithTargets } from "./HistoryClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const DAYS_RANGE = 30;

type SearchParams = { page?: string };

export default async function HistoryPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const pageNum = Math.max(
    1,
    Number.parseInt(searchParams.page ?? "1", 10) || 1
  );
  const offset = (pageNum - 1) * PAGE_SIZE;

  const sinceIso = new Date(
    Date.now() - DAYS_RANGE * 24 * 60 * 60 * 1000
  ).toISOString();

  // posts と post_targets を embed クエリで一括取得（RLS により本人のみ）
  const {
    data: posts,
    count,
    error
  } = await supabase
    .from("posts")
    .select(
      `id, body_common, images, status, created_at,
       post_targets (
         id, platform, status, external_post_url, error_message, posted_at
       )`,
      { count: "exact" }
    )
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">投稿履歴</h1>
        <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">
          エラー: {error.message}
        </p>
      </main>
    );
  }

  return (
    <HistoryClient
      posts={(posts ?? []) as PostWithTargets[]}
      totalCount={count ?? 0}
      currentPage={pageNum}
      pageSize={PAGE_SIZE}
    />
  );
}
