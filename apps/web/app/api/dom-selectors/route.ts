import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DomSelectorRow } from "@posting/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

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
