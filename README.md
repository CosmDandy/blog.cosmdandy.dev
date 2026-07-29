# blog.cosmdandy.dev

Блог на [Quartz 5](https://github.com/jackyzha0/quartz): markdown из `content/`
превращается в статический сайт, который отдаётся с Cloudflare Workers.

## Как устроено

| Слой    | Чем сделано                                                    |
| ------- | -------------------------------------------------------------- |
| Контент | markdown в `content/`, пишется в Obsidian                      |
| Движок  | Quartz 5, ядро в `quartz/`, настройки в `quartz.config.yaml`   |
| Сборка  | GitHub Actions, `.github/workflows/deploy.yaml`                |
| Хостинг | Cloudflare Workers (static assets), `wrangler.jsonc`           |
| Домен   | `blog.cosmdandy.dev`, DNS и сертификат — на стороне Cloudflare |

Сборка и деплой разнесены по отдельным job'ам: сборка исполняет код полусотни
npm-плагинов и потому не должна видеть токен Cloudflare.

## Локально

```bash
make install   # npm ci
make dev       # localhost:8080 с автоперезагрузкой
make build     # собрать в public/
make check     # форматирование
```

`make types` (tsc) сейчас падает на баге самого Quartz: в ветке v5 модуль
`.quartz/plugins` создаётся только при установке плагинов из git, а у нас они
приходят из npm. На сборку это не влияет.

Node — версии из `.node-version` (24). В devcontainer уже есть.

## Как писать

Заметки лежат в `content/`, Obsidian открывает эту папку как хранилище.

```yaml
---
title: Заголовок
description: Одно предложение — уйдёт в meta и в превью при наведении
date: 2026-07-29
tags:
  - infra
draft: true
---
```

- `draft: true` — заметка не собирается вовсе. Публикация = снятие флага.
- Без `date` дата берётся из git-истории.
- Шаблон новой заметки — `content/templates/note.md`, сама папка `templates/`
  в сборку не попадает.
- Работают вики-ссылки `[[...]]`, коллауты, `==выделение==`, теги, LaTeX,
  Canvas и Bases — то есть обычная обсидиановская разметка.

Пуш в `master` — и через минуту это на сайте. На pull request собирается
превью-версия, ссылка появляется в summary прогона.

## Обновление Quartz

Ядро влито одним коммитом, истории upstream в репозитории нет — иначе в логе
блога лежали бы две тысячи чужих коммитов. Версия зафиксирована в
`.quartz-upstream`.

```bash
make upgrade   # дифф между зафиксированным SHA и upstream/v5, применённый поверх
npm ci         # зависимости могли поменяться
make build     # проверить, что собирается
```

Общей точки истории с upstream нет, поэтому git не сливает обновление сам:
`make upgrade` применяет патч и при конфликте останавливается, оставляя
разметку от `git apply -3`. Разбирать конфликт придётся руками — это цена
чистого лога.

Всё своё лежит в файлах, которых у upstream нет (`quartz.config.yaml`,
`content/`, `wrangler.jsonc`, `deploy.yaml`) либо в явном списке исключений
внутри `scripts/upgrade-quartz.sh`. Реально конфликтовать могут два места:
`quartz/styles/custom.scss` и иконки в `quartz/static/`.

## Что настроено руками в Cloudflare

Не хранится в коде и повторяется при переезде:

1. API-токен с правами `Workers Scripts: Edit` и `Workers Routes: Edit` для
   зоны `cosmdandy.dev`; он и account ID лежат в секретах репозитория как
   `CLOUDFLARE_API_TOKEN` и `CLOUDFLARE_ACCOUNT_ID`.
2. Домен `blog.cosmdandy.dev` привязан к воркеру: Workers & Pages → Domains &
   Routes. DNS-запись создаёт сам Cloudflare.
3. Cloudflare Web Analytics включена для домена — скрипт подставляется на edge,
   в HTML аналитики нет.
