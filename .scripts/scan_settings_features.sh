#!/usr/bin/env bash
set -euo pipefail
cd ~/Documents/GitHub/Trading || exit 1

echo "== candidates: settings-related routes/components =="
ls -la app/api 2>/dev/null || true
echo ""

echo "== grep: keywords =="
grep -RIn --exclude-dir=node_modules --exclude-dir=.next \
  -e "exchange_url" \
  -e "ddari_url" \
  -e "spotify_url" \
  -e "checklist" \
  -e "overtrade" \
  -e "dashboard_rows" \
  -e "sync-now" \
  -e "exchange_accounts" \
  -e "bitget" \
  -e "manualSync" \
  -e "saveNow" \
  -e "user_settings" \
  app components lib | sed -n '1,220p' || true

echo ""
echo "DONE"
