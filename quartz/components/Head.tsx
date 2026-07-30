import { i18n } from "../i18n"
import { FullSlug, getFileExtension, joinSegments, pathToRoot } from "../util/path"
import { CSSResourceToStyleElement, JSResourceToScriptElement } from "../util/resources"
import { googleFontHref, googleFontSubsetHref } from "../util/theme"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { unescapeHTML } from "../util/escape"

// Правка поверх upstream: срок жизни ручного выбора темы.
//
// Плагин darkmode хранит выбор в localStorage['theme'] навсегда, и выбранная
// днём светлая тема встречает ночью, когда система давно ушла в тёмную. Здесь
// рядом с выбором заводится отметка — когда его сделали и какая тема была
// тогда у системы, — и выбор снимается, если система с тех пор передумала или
// если он просто отлежал свои часы. Пустое хранилище плагин понимает как
// «следуй за системой», так что снятого выбора достаточно.
//
// Скрипт обязан стоять выше prescript.js: тот читает localStorage ещё до
// отрисовки. Поэтому он тут, а не среди beforeDOMLoaded-ресурсов, где порядок
// зависит от порядка плагинов.
const themeLifetimeScript = `
(function () {
  var LIFE = 4 * 60 * 60 * 1000;
  function system() {
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  try {
    if (!(+localStorage.getItem('theme-at') > Date.now() - LIFE)
        || localStorage.getItem('theme-sys') !== system()) {
      ['theme', 'theme-at', 'theme-sys'].forEach(function (k) { localStorage.removeItem(k); });
    }
  } catch (e) {}
  // Отметку ведём сами: плагин про неё не знает, зато каждая смена темы видна
  // по атрибуту saved-theme на <html>. Наблюдателя вешаем после того, как
  // плагин выставил тему при загрузке, иначе этот первый вызов сошёл бы за
  // ручной выбор и продлил срок на ровном месте.
  document.addEventListener('DOMContentLoaded', function () {
    new MutationObserver(function () {
      try {
        localStorage.setItem('theme-at', String(Date.now()));
        localStorage.setItem('theme-sys', system());
      } catch (e) {}
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['saved-theme'] });
  });
})();
`

export default (() => {
  const Head: QuartzComponent = ({
    cfg,
    fileData,
    externalResources,
    ctx,
  }: QuartzComponentProps) => {
    const titleSuffix = cfg.pageTitleSuffix ?? ""
    const title =
      (fileData.frontmatter?.title ?? i18n(cfg.locale).propertyDefaults.title) + titleSuffix
    const description =
      fileData.frontmatter?.socialDescription ??
      fileData.frontmatter?.description ??
      unescapeHTML(fileData.description?.trim() ?? i18n(cfg.locale).propertyDefaults.description)

    const { css, js, additionalHead } = externalResources

    const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
    const path = url.pathname as FullSlug
    const baseDir = fileData.slug === "404" ? path : pathToRoot(fileData.slug!)
    const iconPath = joinSegments(baseDir, "static/icon.png")

    // Url of current page
    // Правка поверх upstream: для главной joinSegments даёт .../index — адрес,
    // отдающий ту же страницу, что и корень. Как canonical он отправлял бы
    // поисковик по кругу, как og:url — подсовывал бы соцсетям дубликат.
    // Правим здесь, а не в трёх местах ниже, чтобы не трогать JSX ядра.
    const socialUrl =
      fileData.slug === "404" || fileData.slug === "index"
        ? url.toString()
        : joinSegments(url.toString(), fileData.slug!)

    const usesCustomOgImage = ctx.cfg.plugins.emitters.some((e) => e.name === "CustomOgImages")
    const ogImageDefaultPath = `https://${cfg.baseUrl}/static/og-image.png`

    const coreStylesheet = css[0]?.content
    const coreScript = js.find(
      (r) => r.loadTime === "beforeDOMReady" && r.contentType === "external",
    )

    return (
      <head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        <script dangerouslySetInnerHTML={{ __html: themeLifetimeScript }} />
        {coreStylesheet && <link rel="preload" href={coreStylesheet} as="style" />}
        {coreScript && coreScript.contentType === "external" && (
          <link rel="preload" href={coreScript.src} as="script" />
        )}
        {cfg.theme.cdnCaching && cfg.theme.fontOrigin === "googleFonts" && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" />
            <link rel="stylesheet" href={googleFontHref(cfg.theme)} />
            {cfg.theme.typography.title && (
              <link rel="stylesheet" href={googleFontSubsetHref(cfg.theme, cfg.pageTitle)} />
            )}
          </>
        )}
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <meta name="og:site_name" content={cfg.pageTitle}></meta>
        <meta property="og:title" content={title} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta property="og:description" content={description} />
        <meta property="og:image:alt" content={description} />

        {!usesCustomOgImage && (
          <>
            <meta property="og:image" content={ogImageDefaultPath} />
            <meta property="og:image:url" content={ogImageDefaultPath} />
            <meta name="twitter:image" content={ogImageDefaultPath} />
            <meta
              property="og:image:type"
              content={`image/${getFileExtension(ogImageDefaultPath) ?? "png"}`}
            />
          </>
        )}

        {cfg.baseUrl && (
          <>
            <meta property="twitter:domain" content={cfg.baseUrl}></meta>
            <meta property="og:url" content={socialUrl}></meta>
            <meta property="twitter:url" content={socialUrl}></meta>
          </>
        )}

        <link rel="icon" href={iconPath} />
        <meta name="description" content={description} />
        <meta name="generator" content="Quartz" />

        {/* Правка поверх upstream. Canonical нужен, чтобы страница со слэшем и
            без него не считались разными; JSON-LD связывает сайт с ником
            cosmdandy и остальными профилями — по брендовому запросу это то,
            чем поисковик сшивает сущность воедино. */}
        {/* На 404 canonical не ставим: она отдаётся с кодом 404 и
            указывала бы на главную, то есть на чужой адрес. */}
        {fileData.slug !== "404" && <link rel="canonical" href={socialUrl} />}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              // Один и тот же @id на всех трёх сайтах. Без него получаются три
              // независимых Person с похожими полями, и поисковику не за что их
              // сшить; с ним это одна сущность, у которой три адреса.
              "@id": "https://cosmdandy.dev/#person",
              name: "Timofey Kondrashin",
              alternateName: "cosmdandy",
              jobTitle: "DevOps Engineer",
              url: `https://${cfg.baseUrl}`,
              email: "i@cosmdandy.dev",
              sameAs: [
                "https://cosmdandy.dev",
                "https://cv.cosmdandy.dev",
                "https://github.com/CosmDandy",
                "https://www.linkedin.com/in/cosmdandy",
                "https://t.me/cosmdandy",
              ],
            }),
          }}
        />

        {css.map((resource) => CSSResourceToStyleElement(resource, true))}
        {js
          .filter((resource) => resource.loadTime === "beforeDOMReady")
          .map((res) => JSResourceToScriptElement(res, true))}
        {additionalHead.map((resource) => {
          if (typeof resource === "function") {
            return resource(fileData)
          } else {
            return resource
          }
        })}
      </head>
    )
  }

  return Head
}) satisfies QuartzComponentConstructor
