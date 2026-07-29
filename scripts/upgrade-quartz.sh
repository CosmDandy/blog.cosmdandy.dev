#!/usr/bin/env bash
#
# Обновление ядра Quartz из upstream.
#
# Истории upstream в репозитории нет — ядро влито одним коммитом, чтобы в логе
# блога не лежали две тысячи чужих коммитов. Из-за этого git не знает общей
# точки и слить обновление сам не может: вместо merge мы берём дифф между
# зафиксированным SHA и новым и применяем его поверх своего дерева.
#
# Что это значит на практике: git разрешает конфликты по трём версиям ФАЙЛА
# (наша, старая upstream, новая upstream), а не по трём версиям дерева. Файлы,
# которых у нас нет или которые мы переписали, он не поймёт — они исключены
# ниже явным списком.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION_FILE=.quartz-upstream
PATCH=.quartz-upgrade.patch

# Пути, которые обновлять не надо:
#   docs, .github, Dockerfile, CODE_OF_CONDUCT — удалены как обвязка upstream
#   README, .gitignore, .node-version, content  — переписаны под блог
EXCLUDES=(
  ':(exclude)docs'
  ':(exclude).github'
  ':(exclude)Dockerfile'
  ':(exclude)CODE_OF_CONDUCT.md'
  ':(exclude)README.md'
  ':(exclude).gitignore'
  ':(exclude).node-version'
  ':(exclude)content'
  ':(exclude).turbo'
)

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Рабочее дерево грязное. Патч ляжет поверх незакоммиченного — сначала коммить или спрячь." >&2
  exit 1
fi

OLD=$(grep -v '^#' "$VERSION_FILE" | tr -d '[:space:]')
git fetch upstream v5
NEW=$(git rev-parse upstream/v5)

if [[ "$OLD" == "$NEW" ]]; then
  echo "Ядро уже на $NEW — обновлять нечего."
  exit 0
fi

echo "Обновление ядра: ${OLD:0:8} → ${NEW:0:8}"
echo "Коммитов в upstream за это время: $(git rev-list --count "$OLD..$NEW")"
echo
echo "Что менялось:"
git log --oneline "$OLD..$NEW" | head -20
echo

git diff "$OLD..$NEW" -- . "${EXCLUDES[@]}" >"$PATCH"

if [[ ! -s "$PATCH" ]]; then
  echo "В отслеживаемых путях изменений нет — двигаем только отметку версии."
else
  echo "Применяю патч ($(wc -l <"$PATCH") строк)…"
  if ! git apply -3 "$PATCH"; then
    echo >&2
    echo "Патч лёг не полностью. Конфликты разметил git — разбери их," >&2
    echo "потом обнови SHA в $VERSION_FILE вручную и закоммить." >&2
    echo "Патч оставлен в $PATCH, откат: git checkout -- . && rm $PATCH" >&2
    exit 1
  fi
fi

rm -f "$PATCH"
sed -i "s/^${OLD}$/${NEW}/" "$VERSION_FILE"

echo
echo "Готово. Дальше руками:"
echo "  npm ci               # зависимости могли поменяться"
echo "  make build           # проверить, что собирается"
echo "  git add -A && git commit -m \"chore(quartz): обновление ядра до ${NEW:0:8}\""
