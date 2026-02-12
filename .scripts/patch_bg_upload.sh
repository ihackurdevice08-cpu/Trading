#!/usr/bin/env bash
set -euo pipefail
set +H

cd "$HOME/Documents/GitHub/Trading" || exit 1

echo "== create upload helper =="

mkdir -p "app/(app)/settings"

cat > "app/(app)/settings/uploadBg.ts" <<'TS'
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
TS

echo "== ensure import =="

node <<'NODE'
const fs = require("fs");
const f = "app/(app)/settings/page.tsx";
let s = fs.readFileSync(f,"utf8");

if (!s.includes('uploadBackground')) {
  s = s.replace(
    /(^import[^\n]*\n)/m,
    `$1import { uploadBackground } from "./uploadBg";\n`
  );
}

fs.writeFileSync(f,s);
console.log("OK import");
NODE

echo "== replace old calls =="

perl -pi -e 's/uploadAndSaveBackground\(file\)/const url = await uploadBackground(file); patchAppearance({ bg: { ...(appearance.bg||{}), url, enabled:true } } as any)/g' "app/(app)/settings/page.tsx"

echo "== build =="

rm -rf .next || true
npm run build

echo "== commit & deploy =="

git add "app/(app)/settings/uploadBg.ts" "app/(app)/settings/page.tsx"
git commit -m "fix: background upload wired correctly" || true
git push
vercel --prod

echo "DONE"
