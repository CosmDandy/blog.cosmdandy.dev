.PHONY: help install dev build check format clean upgrade

help: ## Показать эту справку
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Поставить зависимости из lock-файла
	npm ci

dev: ## Локальный просмотр с автоперезагрузкой на localhost:8080
	npx quartz build --serve

build: ## Собрать сайт в public/
	npx quartz build

check: ## Форматирование
	npx prettier . --check

# Сейчас падает с TS2307 на '../../.quartz/plugins' — и падает точно так же в
# чистом клоне upstream. В ветке v5 этот модуль создаётся только когда плагины
# ставятся из git; у нас они приходят обычными npm-зависимостями, папка
# .quartz/plugins остаётся пустой, и типов для неё нет. На сборку не влияет:
# esbuild типы не проверяет. Вернуть в check, когда почините выше по течению.
types: ## Проверка типов (известно, что падает на баге upstream)
	npx tsc --noEmit

format: ## Отформатировать
	npx prettier . --write

clean: ## Убрать сборку и кэш
	rm -rf public .quartz-cache

upgrade: ## Подтянуть обновления ядра Quartz из upstream
	./scripts/upgrade-quartz.sh
