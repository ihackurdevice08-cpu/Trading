import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import JournalClient from "./ui";

export default async function JournalPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: rows } = await supabase
    .from("journal_entries")
    .select("id, content, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return <JournalClient initial={rows || []} />;
}
