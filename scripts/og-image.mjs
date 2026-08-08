// Картинка превью: SVG → PNG.
//
// Открывается, когда ссылку на блог кидают в мессенджер. Правится SVG рядом с
// собой (quartz/static/og-image.svg), а этот скрипт снимает с него растр — тот
// самый файл, на который смотрит og:image.
//
//   npm run og
//
// Зачем браузер вместо ImageMagick или resvg: в SVG вшит Inter, шрифт задан
// через @font-face с base64, и разбирает такое только полноценный движок.
// Системных шрифтов в сборочном контейнере нет вовсе — resvg нарисовал бы
// пустое место вместо строк.
import { createRequire } from 'node:module'
import { existsSync, globSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(ROOT, 'quartz/static/og-image.svg')
const OUT = resolve(ROOT, 'quartz/static/og-image.png')

// playwright лежит рядом с рабочей копией, а не в зависимостях блога: он нужен
// только здесь, а тянуть браузер в сборку сайта незачем.
const require = createRequire('/workspaces/.pw/')
const { chromium } = require('playwright')

// Chromium из nix store: свой playwright не качает бинарь в этом окружении.
const CHROME = globSync('/nix/store/*chromium-1[0-9][0-9]*/bin/chromium')[0]
if (!CHROME) throw new Error('не найден chromium в /nix/store')
if (!existsSync(SRC)) throw new Error(`нет исходника: ${SRC}`)

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.goto('file://' + SRC)
// Ждём разбор вшитого woff2: без паузы страница успевает сняться со шрифтом по
// умолчанию, и буквы уезжают по ширине.
await page.waitForTimeout(1500)
await page.screenshot({ path: OUT })
await browser.close()
console.log('готово:', OUT.replace(ROOT + '/', ''))
