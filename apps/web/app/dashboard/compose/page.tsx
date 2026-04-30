import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ComposeClient } from "./ComposeClient";

export const dynamic = "force-dynamic";

export default async function ComposePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: accounts } = await supabase
    .from("sns_accounts")
    .select("platform, account_name, is_active")
    .eq("user_id", user.id);

  // 連携状態を bool で平坦化
  const connections = {
    x: !!accounts?.find((a) => a.platform === "x" && a.is_active),
    bluesky: !!accounts?.find((a) => a.platform === "bluesky" && a.is_active),
    relaxy: !!accounts?.find((a) => a.platform === "relaxy" && a.is_active),
    "02": !!accounts?.find((a) => a.platform === "02" && a.is_active)
  };

  return <ComposeClient connections={connections} />;
}
