#!/usr/bin/env bash
set -euo pipefail

# 사용법:
# 1) 스크립트를 .scripts/task.sh 로 저장
# 2) bash .scripts/run.sh .scripts/task.sh
#
# 장점: zsh 파싱 이슈/괄호 이슈/따옴표 이슈 거의 제거

FILE="${1:-}"
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: bash .scripts/run.sh .scripts/task.sh"
  exit 1
fi

bash "$FILE"
