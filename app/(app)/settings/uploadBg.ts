import { supabaseBrowser } from "@/lib/supabase/browser";

export async function uploadBackground(file: File) {
  const sb = supabaseBrowser();

  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `bg/${Date.now()}.${ext}`;

  const { error } = await sb.storage
    .from("mancave-media")
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data } = sb.storage.from("mancave-media").getPublicUrl(path);
  return data.publicUrl;
}
