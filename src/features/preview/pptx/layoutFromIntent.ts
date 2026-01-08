import type { PptxIntentSpec } from '../../../shared/pptxIntent'
import type { PptxSpec } from '../../../shared/pptxSpec'

type SlideLayout = {
  widthIn: number
  heightIn: number
  marginIn: number
}

function getLayout(_layout: 'LAYOUT_WIDE'): SlideLayout {
  // PptxGenJS LAYOUT_WIDE is 13.333 x 7.5 in
  return { widthIn: 13.333, heightIn: 7.5, marginIn: 0.6 }
}

function clamp(min: number, value: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

export function buildPptxSpecFromIntent(intent: PptxIntentSpec): PptxSpec {
  const layout = getLayout(intent.meta?.layout ?? 'LAYOUT_WIDE')

  return {
    meta: {
      title: intent.meta?.title,
      author: intent.meta?.author,
      layout: intent.meta?.layout ?? 'LAYOUT_WIDE',
    },
    slides: intent.slides.map((slideIntent) => {
      const objects: PptxSpec['slides'][number]['objects'] = []

      const x = layout.marginIn
      const w = layout.widthIn - layout.marginIn * 2
      let y = layout.marginIn
      const bottom = layout.heightIn - layout.marginIn

      const hasRight = (slideIntent.bulletSections?.length ?? 0) > 0
      const colGap = 0.35
      const leftW = hasRight ? w * 0.62 - colGap / 2 : w
      const rightW = hasRight ? w - leftW - colGap : 0
      const leftX = x
      const rightX = x + leftW + colGap

      if (slideIntent.title) {
        const h = 0.7
        objects.push({
          kind: 'text',
          text: slideIntent.title,
          box: { x, y, w, h },
          options: { fontSize: 28, bold: true },
        })
        y += h + 0.2
      }

      const blocks: Array<
        | { kind: 'bullets'; bullets: string[] }
        | { kind: 'table'; title?: string; rows: string[][] }
        | { kind: 'chart'; title?: string; chartType: any; data: any }
        | { kind: 'image'; title?: string; dataUrl?: string; url?: string }
      > = []

      if (slideIntent.bullets?.length) blocks.push({ kind: 'bullets', bullets: slideIntent.bullets })
      for (const t of slideIntent.tables ?? []) blocks.push({ kind: 'table', title: t.title, rows: t.rows })
      for (const c of slideIntent.charts ?? []) blocks.push({ kind: 'chart', title: c.title, chartType: c.chartType, data: c.data })
      for (const i of slideIntent.images ?? []) blocks.push({ kind: 'image', title: i.title, dataUrl: i.dataUrl, url: i.url })

      const remainingLeft = clamp(1, bottom - y, bottom)
      const gap = 0.25
      const perBlock = blocks.length ? (remainingLeft - gap * (blocks.length - 1)) / blocks.length : 0

      for (const block of blocks) {
        const h = clamp(0.9, perBlock, remainingLeft)
        if (y + h > bottom + 0.001) break

        if (block.kind === 'bullets') {
          objects.push({
            kind: 'bullets',
            items: block.bullets,
            box: { x: leftX, y, w: leftW, h },
            options: { fontSize: 18 },
          })
        } else if (block.kind === 'table') {
          if (block.title) {
            const th = 0.35
            objects.push({
              kind: 'text',
              text: block.title,
              box: { x: leftX, y, w: leftW, h: th },
              options: { fontSize: 14, bold: true },
            })
            y += th + 0.1
          }

          const rows = (block.rows ?? []).map((r) => (Array.isArray(r) && r.length ? r : ['']))
          const safeRows = rows.length ? rows : [['']]

          objects.push({
            kind: 'table',
            rows: safeRows,
            box: { x: leftX, y, w: leftW, h: clamp(0.7, bottom - y, h) },
          })
        } else if (block.kind === 'chart') {
          objects.push({
            kind: 'chart',
            chartType: block.chartType,
            data: block.data,
            box: { x: leftX, y, w: leftW, h },
            options: block.title ? { title: block.title, showTitle: true } : undefined,
          })
        } else if (block.kind === 'image') {
          // We can't fetch remote urls in-browser safely here; dataUrl is preferred.
          if (block.dataUrl) {
            if (block.title) {
              const th = 0.35
              objects.push({
                kind: 'text',
                text: block.title,
                box: { x: leftX, y, w: leftW, h: th },
                options: { fontSize: 14, bold: true },
              })
              y += th + 0.1
            }

            objects.push({
              kind: 'image',
              dataUrl: block.dataUrl,
              box: { x: leftX, y, w: leftW, h: clamp(0.7, bottom - y, h) },
            })
          } else {
            objects.push({
              kind: 'text',
              text: block.url ? `Image: ${block.url}` : 'Image',
              box: { x: leftX, y, w: leftW, h },
              options: { fontSize: 14, italic: true },
            })
          }
        }

        y += h + gap
      }

      if (hasRight) {
        let ry = layout.marginIn
        if (slideIntent.title) {
          ry += 0.7 + 0.2
        }

        const sections = slideIntent.bulletSections ?? []
        const remainingRight = clamp(1, bottom - ry, bottom)
        const per = sections.length ? (remainingRight - gap * (sections.length - 1)) / sections.length : 0

        for (const sec of sections) {
          const h = clamp(0.9, per, remainingRight)
          if (ry + h > bottom + 0.001) break

          let innerY = ry
          if (sec.title) {
            const th = 0.32
            objects.push({
              kind: 'text',
              text: sec.title,
              box: { x: rightX, y: innerY, w: rightW, h: th },
              options: { fontSize: 14, bold: true },
            })
            innerY += th + 0.08
          }

          objects.push({
            kind: 'bullets',
            items: sec.items,
            box: { x: rightX, y: innerY, w: rightW, h: Math.max(0.4, ry + h - innerY) },
            options: { fontSize: 14 },
          })

          ry += h + gap
        }
      }

      if (objects.length === 0) {
        objects.push({
          kind: 'text',
          text: '',
          box: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
        })
      }

      return {
        title: slideIntent.title,
        backgroundColor: slideIntent.backgroundColor,
        objects,
      }
    }),
  }
}
