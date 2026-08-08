import { i18n } from "../i18n"
import { FullSlug, getFileExtension, joinSegments, pathToRoot } from "../util/path"
import { CSSResourceToStyleElement, JSResourceToScriptElement } from "../util/resources"
import { googleFontHref, googleFontSubsetHref } from "../util/theme"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { unescapeHTML } from "../util/escape"

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
        {/* Правка поверх upstream. С cdnjs грузится только mermaid, и только на
            страницах, где есть диаграмма, — то есть почти никогда. Соединение же
            открывалось на каждой загрузке и отъедало у телефона DNS, TCP и TLS.
            А вот с jsdelivr на каждой странице приезжают d3 и pixi для графа
            (полмегабайта), и туда соединения как раз не было. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        {/* Правка поверх upstream. Первой строкой карточки мессенджер печатает
            og:site_name, и с pageTitle там оказывался ник «cosmdandy» — по нему
            непонятно, куда ведёт ссылка, и он же дублировал заголовок, отчего
            Telegram заголовок просто не показывал. Адрес на этом месте отвечает
            на вопрос «куда я иду», а заголовок остаётся заголовком.
            Заодно property вместо name: у Open Graph атрибут именно такой,
            name работал по снисходительности парсеров. */}
        <meta property="og:site_name" content={cfg.baseUrl ?? cfg.pageTitle}></meta>
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
