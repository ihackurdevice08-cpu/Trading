import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardClient from "./ui";

function defaults() {
  return {
    exchange_url: "",
    ddari_url: "",
    spotify_url: "",
    docs_url: "",
    sheets_url: "",
    checklist: [],
    emergency: { steps: ["1) 포지션 추가 진입 금지", "2) 10분 쿨다운", "3) 체크리스트 재확인"], quotes: ["No trade is also a trade."] },
  };
}

export default async function DashboardPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: settingsRow } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const settings = { ...defaults(), ...(settingsRow || {}) };

  return <DashboardClient email={user.email || ""} settings={settings} />;
}
