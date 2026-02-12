#!/usr/bin/env bash
set -euo pipefail
cd "$HOME/Documents/GitHub/Trading" || exit 1

echo "== sanity: shell =="
echo "$SHELL"

echo "== (A) show last lines around the error candidate =="
tail -n 20 components/providers/AppearanceProvider.tsx || true

echo ""
echo "== (B) run build =="
rm -rf .next >/dev/null 2>&1 || true
npm run build
