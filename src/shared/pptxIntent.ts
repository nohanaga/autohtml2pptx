import { z } from 'zod'

const HexColor = z
  .string()
  .regex(/^[0-9A-Fa-f]{6}$/)
  .describe('6桁HEX（#なし）例: FFFFFF')

const ChartSeries = z
  .object({
    name: z.string().min(1),
    labels: z.array(z.string().min(1)).min(1),
    values: z.array(z.number()).min(1),
  })
  .strict()

export const PptxIntentChartSchema = z
  .object({
    title: z.string().optional(),
    chartType: z.enum(['bar', 'line', 'pie', 'doughnut', 'area', 'scatter', 'radar']),
    data: z.array(ChartSeries).min(1),
    options: z
      .object({
        showLegend: z.boolean().optional(),
        legendPos: z.enum(['b', 'tr', 'l', 'r', 't']).optional(),
        showValue: z.boolean().optional(),
        showPercent: z.boolean().optional(),
        chartColors: z.array(HexColor).optional(),
      })
      .optional(),
  })
  .strict()

export const PptxIntentTableSchema = z
  .object({
    title: z.string().optional(),
    rows: z.array(z.array(z.string())).min(1),
    options: z
      .object({
        headerRows: z.number().int().min(0).max(10).optional(),
      })
      .optional(),
  })
  .strict()

export const PptxIntentImageSchema = z
  .object({
    title: z.string().optional(),
    // ブラウザ完結なので、dataUrl か url を許可（urlはCORSで失敗し得る）
    dataUrl: z.string().optional(),
    url: z.string().url().optional(),
  })
  .strict()
  .refine((v) => Boolean(v.dataUrl || v.url), {
    message: 'image: dataUrl または url が必要です',
    path: ['dataUrl'],
  })

export const PptxIntentSlideSchema = z
  .object({
    title: z.string().optional(),
    backgroundColor: HexColor.optional(),

    // 代表的な構造（座標はレンダラが決める）
    bullets: z.array(z.string().min(1)).optional(),
    bulletSections: z
      .array(
        z
          .object({
            title: z.string().optional(),
            items: z.array(z.string().min(1)).min(1),
          })
          .strict(),
      )
      .optional(),
    tables: z.array(PptxIntentTableSchema).optional(),
    charts: z.array(PptxIntentChartSchema).optional(),
    images: z.array(PptxIntentImageSchema).optional(),

    speakerNotes: z.string().optional(),
  })
  .strict()

export const PptxIntentSpecSchema = z
  .object({
    meta: z
      .object({
        title: z.string().optional(),
        author: z.string().optional(),
        layout: z.literal('LAYOUT_WIDE').default('LAYOUT_WIDE'),
      })
      .strict()
      .optional(),
    slides: z.array(PptxIntentSlideSchema).min(1),
  })
  .strict()

export type PptxIntentSpec = z.infer<typeof PptxIntentSpecSchema>
export type PptxIntentSlide = z.infer<typeof PptxIntentSlideSchema>
