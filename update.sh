#!/bin/bash
# يسحب الشعب من بانر، وإن تغيّرت (أو مرّ يوم على آخر فحص) يرفع sections.json إلى GitHub
cd "$(dirname "$0")" || exit 1
echo "== $(date '+%F %T')"
git pull --quiet --rebase --autostash || exit 1
python3 build_sections.py --fetch --only-if-changed -o sections.json || exit 1
if ! git diff --quiet sections.json; then
  git add sections.json
  git commit -qm "تحديث الشعب $(date +%F)"
  git push -q && echo "تم الرفع"
fi
