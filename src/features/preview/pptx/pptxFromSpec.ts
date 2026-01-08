import PptxGenJS from 'pptxgenjs'
import type { PptxSlideObject, PptxSpec } from '../../../shared/pptxSpec'

const PPT_W_IN = 13.333
const PPT_H_IN = 7.5

function chartTypeToPptx(pptx: any, chartType: string) {
  const map: Record<string, any> = {
    area: pptx.ChartType.area,
    bar: pptx.ChartType.bar,
    doughnut: pptx.ChartType.doughnut,
    line: pptx.ChartType.line,
    pie: pptx.ChartType.pie,
    radar: pptx.ChartType.radar,
    scatter: pptx.ChartType.scatter,
  }
  return map[chartType]
}

async function resolveImageData(obj: { dataUrl?: string; url?: string }): Promise<string> {
  if (obj.dataUrl) return obj.dataUrl
  if (!obj.url) throw new Error('image: dataUrl/url がありません')

  const res = await fetch(obj.url)
  if (!res.ok) throw new Error(`image fetch failed (${res.status})`)
  const blob = await res.blob()

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('image read failed'))
    reader.readAsDataURL(blob)
  })
  if (!dataUrl.startsWith('data:')) throw new Error('image: dataUrl変換に失敗しました')
  return dataUrl
}

function addObject(slide: any, pptx: any, obj: PptxSlideObject) {
  switch (obj.kind) {
    case 'text': {
      slide.addText(obj.text, { ...obj.box, ...(obj.options ?? {}) })
      return
    }
    case 'bullets': {
      const text = obj.items.join('\n')
      slide.addText(text, {
        ...obj.box,
        bullet: (obj.options?.bullet ?? true) as any,
        ...(obj.options ?? {}),
      })
      return
    }
    case 'table': {
      const rows = normalizeTableRows(obj.rows)
      try {
        slide.addTable(rows, { ...obj.box, ...(obj.options ?? {}), autoPage: obj.options?.autoPage ?? true })
      } catch (e) {
        // Some inputs still cause pptxgenjs table validation to fail at runtime.
        // Fallback: render as plain text so export doesn't get stuck.
        const text = rows.map((r) => r.join('\t')).join('\n')
        slide.addText(text, { ...obj.box, fontSize: 12 })
      }
      return
    }
    case 'chart': {
      const ct = chartTypeToPptx(pptx, obj.chartType)
      slide.addChart(ct, obj.data, { ...obj.box, ...(obj.options ?? {}) })
      return
    }
    default:
      return
  }
}

function normalizeTableRows(value: unknown): Array<Array<string>> {
  // PptxGenJS expects TableRow[] where each row is an array.
  if (!Array.isArray(value)) return [[String(value ?? '')]]

  // If it's a 1D array (string[]), treat it as a single row.
  const is2d = value.length === 0 ? false : Array.isArray(value[0])
  const rows2d: unknown[][] = is2d ? (value as unknown[][]) : [value as unknown[]]

  const normalized = rows2d.map((row) => {
    if (!Array.isArray(row)) return [String(row ?? '')]
    if (row.length === 0) return ['']
    return row.map((cell) => String(cell ?? ''))
  })

  return normalized.length === 0 ? [['']] : normalized
}

export async function buildPptxBlobFromSpec(spec: PptxSpec): Promise<Blob> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'

  if (spec.meta?.title) pptx.title = spec.meta.title
  if (spec.meta?.author) (pptx as any).author = spec.meta.author

  for (const slideSpec of spec.slides) {
    const slide = pptx.addSlide()

    if (slideSpec.backgroundColor) {
      ;(slide as any).background = { color: slideSpec.backgroundColor }
    }

    for (const obj of slideSpec.objects) {
      if (obj.kind === 'image') {
        const data = await resolveImageData(obj)
        slide.addImage({ data, ...obj.box })
        continue
      }
      addObject(slide, pptx, obj)
    }
  }

  const blob = (await (pptx as any).write('blob')) as Blob
  return blob
}

export const SLIDE_SIZE_IN = { w: PPT_W_IN, h: PPT_H_IN }
