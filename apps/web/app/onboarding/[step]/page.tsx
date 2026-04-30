import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingClient } from "./OnboardingClient";

export const dynamic = "force-dynamic";

const VALID_STEPS = [1, 2, 3, 4, 5] as const;
type Step = (typeof VALID_STEPS)[number];

export default async function OnboardingStepPage({
  params
}: {
  params: { step: string };
}) {
  const stepNum = Number.parseInt(params.step, 10);
  if (Number.isNaN(stepNum) || !VALID_STEPS.includes(stepNum as Step)) {
    notFound();
  }
  const step = stepNum as Step;

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accounts } = await supabase
    .from("sns_accounts")
    .select("platform, account_name, is_active")
    .eq("user_id", user.id);

  const connections = {
    x: !!accounts?.find((a) => a.platform === "x" && a.is_active),
    bluesky: !!accounts?.find((a) => a.platform === "bluesky" && a.is_active)
  };

  const xAccountName =
    accounts?.find((a) => a.platform === "x")?.account_name ?? null;
  const blueskyAccountName =
    accounts?.find((a) => a.platform === "bluesky")?.account_name ?? null;

  return (
    <OnboardingClient
      step={step}
      xConnected={connections.x}
      blueskyConnected={connections.bluesky}
      xAccountName={xAccountName}
      blueskyAccountName={blueskyAccountName}
    />
  );
}
