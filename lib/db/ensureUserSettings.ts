export async function ensureUserSettings(sb: any, userId: string) {
  const { data } = await sb
    .from("user_settings")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    await sb.from("user_settings").insert({
      user_id: userId,
      appearance: {},
    });
  }
}
