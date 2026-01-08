function normalizeCssForSlide(css: string) {
  // ざっくり: html/body を .pptx-root に寄せる（完全なCSSパーサではない）
  return css
    .replace(/(^|[,{])\s*html\b/gm, '$1 .pptx-root')
    .replace(/(^|[,{])\s*body\b/gm, '$1 .pptx-root')
}

export function extractSlideHtml(htmlDocument: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlDocument, 'text/html')

  // scriptsは実行したくないので除去
  doc.querySelectorAll('script').forEach((n) => n.remove())

  const styles = Array.from(doc.querySelectorAll('style'))
    .map((s) => normalizeCssForSlide(s.textContent ?? ''))
    .filter((t) => t.trim().length > 0)

  const styleTag = styles.length > 0 ? `<style>${styles.join('\n\n')}</style>` : ''

  const bodyHtml = doc.body?.innerHTML ?? ''

  // body内にstyleがあるケースもあるのでそのまま残るが、上でstyle抽出済み
  return `${styleTag}\n<div class="pptx-root-inner">${bodyHtml}</div>`
}
