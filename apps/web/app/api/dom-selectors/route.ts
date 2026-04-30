import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DomSelectorRow } from "@posting/shared";

export const dynamic = "force-dynamic";

// Phase 6-2 修正: Chrome MV3 拡張の Service Worker からは認証 Cookie が送れないため
// /api/dom-selectors は認証なしで読み取り可能とする。
// セレクタ情報は CSS パターン文字列のみで機密性が低い、書き込みは引き続き admin のみ。
// migration 0004_dom_selectors_anon_read.sql で RLS を anon にも開く。
export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("dom_selectors")
    .select("id, platform, field_name, selector, version, updated_at")
    .order("platform", { ascending: true })
    .order("field_name", { ascending: true })
    .order("version", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const latestByKey = new Map<string, Pick<DomSelectorRow, "id" | "platform" | "field_name" | "selector" | "version"> & { updated_at: string }>();
  for (const row of data ?? []) {
    const key = `${row.platform}/${row.field_name}`;
    if (!latestByKey.has(key)) {
      latestByKey.set(key, row);
    }
  }

  return NextResponse.json({
    selectors: Array.from(latestByKey.values())
  });
}
