import type { DeckBullet, DeckSpec } from '../../../shared/deckSpec'
import type { PptxSlideObject, PptxSpec } from '../../../shared/pptxSpec'

type SlideLayout = {
  widthIn: number
  heightIn: number
  marginIn: number
}

function getLayout(_layout: 'LAYOUT_WIDE'): SlideLayout {
  return { widthIn: 13.333, heightIn: 7.5, marginIn: 0.6 }
}

function clamp(min: number, value: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

function bulletsToLines(bullets: DeckBullet[] | undefined): string[] {
  if (!bullets?.length) return []
  return bullets
    .filter((b) => typeof b?.text === 'string' && b.text.trim())
    .map((b) => {
      const level = clamp(0, Number(b.level ?? 0), 4)
      const indent = '  '.repeat(level)
      return `${indent}${b.text.trim()}`
    })
}

function resolveImageSrc(deck: DeckSpec, image: { asset_id?: string; src?: string } | undefined): { dataUrl?: string; url?: string } | null {
  if (!image) return null

  const direct = image.src?.trim()
  if (direct) {
    if (direct.startsWith('data:')) return { dataUrl: direct }
    if (/^https?:\/\//i.test(direct)) return { url: direct }
    // ローカルパスはブラウザから安全に読めないので、ここでは解決しない
    return null
  }

  const id = image.asset_id?.trim()
  if (!id) return null

  const src = deck.assets?.images?.find((x) => x.id === id)?.src?.trim()
  if (!src) return null
  if (src.startsWith('data:')) return { dataUrl: src }
  if (/^https?:\/\//i.test(src)) return { url: src }
  return null
}

export function buildPptxSpecFromDeck(deck: DeckSpec): PptxSpec {
  const layout = getLayout(deck.theme.layout)

  const x = layout.marginIn
  const w = layout.widthIn - layout.marginIn * 2
  const top = layout.marginIn
  const bottom = layout.heightIn - layout.marginIn

  return {
    meta: {
      title: deck.meta.title,
      author: undefined,
      layout: 'LAYOUT_WIDE',
    },
    slides: deck.slides.map((s) => {
      const objects: PptxSlideObject[] = []

      // title box
      const titleH = 0.7
      const titleGap = 0.2

      if (s.layout_type === 'image_full_bleed') {
        const img = resolveImageSrc(deck, s.image)
        if (img?.dataUrl || img?.url) {
          const imageObj: PptxSlideObject = img.dataUrl
            ? { kind: 'image', dataUrl: img.dataUrl, box: { x: 0, y: 0, w: layout.widthIn, h: layout.heightIn } }
            : { kind: 'image', url: img.url!, box: { x: 0, y: 0, w: layout.widthIn, h: layout.heightIn } }
          objects.push(imageObj)
        } else {
          objects.push({
            kind: 'text',
            text: s.image?.asset_id ? `Image: ${s.image.asset_id}` : 'Image',
            box: { x, y: top, w, h: titleH },
            options: { fontSize: 14, italic: true },
          })
        }

        objects.push({
          kind: 'text',
          text: s.title,
          box: { x, y: top, w, h: titleH },
          options: { fontSize: 28, bold: true, color: deck.theme.colors?.text ?? 'FFFFFF' },
        })

        if (s.subtitle) {
          objects.push({
            kind: 'text',
            text: s.subtitle,
            box: { x, y: top + titleH, w, h: 0.5 },
            options: { fontSize: 16, color: deck.theme.colors?.text ?? 'FFFFFF' },
          })
        }

        return {
          title: s.title,
          backgroundColor: deck.theme.colors?.bg,
          objects: objects.length ? objects : [{ kind: 'text', text: '', box: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 } }],
        }
      }

      let y = top

      // 共通: タイトル
      objects.push({
        kind: 'text',
        text: s.title,
        box: { x, y, w, h: titleH },
        options: { fontSize: 28, bold: true, color: deck.theme.colors?.text },
      })
      y += titleH + titleGap

      if (s.layout_type === 'title' && s.subtitle) {
        objects.push({
          kind: 'text',
          text: s.subtitle,
          box: { x, y, w, h: 0.6 },
          options: { fontSize: 18, color: deck.theme.colors?.text },
        })
        y += 0.6
      }

      if (s.layout_type === 'title_bullets') {
        const lines = bulletsToLines(s.bullets)
        if (lines.length) {
          objects.push({
            kind: 'bullets',
            items: lines,
            box: { x, y, w, h: bottom - y },
            options: { fontSize: 18 },
          })
        }
      }

      if (s.layout_type === 'two_column_bullets') {
        const colGap = 0.35
        const leftW = w * 0.5 - colGap / 2
        const rightW = w - leftW - colGap
        const leftX = x
        const rightX = x + leftW + colGap

        const headerH = 0.32
        const headerGap = 0.1

        let leftY = y
        if (s.left?.heading) {
          objects.push({
            kind: 'text',
            text: s.left.heading,
            box: { x: leftX, y: leftY, w: leftW, h: headerH },
            options: { fontSize: 14, bold: true },
          })
          leftY += headerH + headerGap
        }

        const leftLines = bulletsToLines(s.left?.bullets)
        if (leftLines.length) {
          objects.push({
            kind: 'bullets',
            items: leftLines,
            box: { x: leftX, y: leftY, w: leftW, h: bottom - leftY },
            options: { fontSize: 14 },
          })
        }

        let rightY = y
        if (s.right?.heading) {
          objects.push({
            kind: 'text',
            text: s.right.heading,
            box: { x: rightX, y: rightY, w: rightW, h: headerH },
            options: { fontSize: 14, bold: true },
          })
          rightY += headerH + headerGap
        }

        const rightLines = bulletsToLines(s.right?.bullets)
        if (rightLines.length) {
          objects.push({
            kind: 'bullets',
            items: rightLines,
            box: { x: rightX, y: rightY, w: rightW, h: bottom - rightY },
            options: { fontSize: 14 },
          })
        }
      }

      if (s.layout_type === 'image_left_bullets_right') {
        const colGap = 0.35
        const leftW = w * 0.5 - colGap / 2
        const rightW = w - leftW - colGap
        const leftX = x
        const rightX = x + leftW + colGap

        const img = resolveImageSrc(deck, s.image)
        if (img?.dataUrl || img?.url) {
          const imageObj: PptxSlideObject = img.dataUrl
            ? { kind: 'image', dataUrl: img.dataUrl, box: { x: leftX, y, w: leftW, h: bottom - y } }
            : { kind: 'image', url: img.url!, box: { x: leftX, y, w: leftW, h: bottom - y } }
          objects.push(imageObj)
        } else {
          objects.push({
            kind: 'text',
            text: s.image?.asset_id ? `Image: ${s.image.asset_id}` : 'Image',
            box: { x: leftX, y, w: leftW, h: bottom - y },
            options: { fontSize: 14, italic: true },
          })
        }

        const lines = bulletsToLines(s.bullets)
        if (lines.length) {
          objects.push({
            kind: 'bullets',
            items: lines,
            box: { x: rightX, y, w: rightW, h: bottom - y },
            options: { fontSize: 16 },
          })
        }
      }

      if (s.layout_type === 'table') {
        const rows: string[][] = []
        if (s.table?.columns?.length) rows.push(s.table.columns)
        for (const r of s.table?.rows ?? []) rows.push(r.map((c) => String(c ?? '')))
        const safeRows = rows.length ? rows : [['']]

        objects.push({
          kind: 'table',
          rows: safeRows,
          box: { x, y, w, h: bottom - y },
          options: { fontSize: 12, autoPage: true, autoPageRepeatHeader: true, autoPageHeaderRows: 1 },
        })
      }

      if (s.layout_type === 'chart') {
        const categories = s.chart?.categories
        const maxLen = Math.max(0, ...(s.chart?.series ?? []).map((ss) => ss.values.length))
        const labels = categories?.length ? categories : Array.from({ length: maxLen }, (_, i) => String(i + 1))

        const data = (s.chart?.series ?? []).map((ss) => ({
          name: ss.name,
          labels,
          values: ss.values,
        }))

        objects.push({
          kind: 'chart',
          chartType: s.chart?.chart_type ?? 'bar',
          data,
          box: { x, y, w, h: bottom - y },
          options: { showLegend: true },
        })
      }

      // 最低1オブジェクト保証
      if (objects.length === 0) {
        objects.push({ kind: 'text', text: '', box: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 } })
      }

      return {
        title: s.title,
        backgroundColor: deck.theme.colors?.bg,
        objects,
      }
    }),
  }
}
