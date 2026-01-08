import { z } from 'zod'

// PptxGenJSはLAYOUT_WIDE(13.333 x 7.5 inch) を前提にし、座標/サイズはインチで指定する

const HexColor = z
  .string()
  .regex(/^[0-9A-Fa-f]{6}$/)
  .describe('6桁HEX（#なし）例: FFFFFF')

const SlidePos = z
  .number()
  .min(0)
  .max(100)
  .describe('インチ単位（0以上）')

const SlideBox = z.object({
  x: SlidePos,
  y: SlidePos,
  w: SlidePos,
  h: SlidePos,
})

const TextOptions = z
  .object({
    fontFace: z.string().optional(),
    fontSize: z.number().min(6).max(96).optional().describe('pt'),
    color: HexColor.optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    valign: z.enum(['top', 'middle', 'bottom']).optional(),
    // PptxGenJSのbullet: true | {type|code|style}
    bullet: z
      .union([
        z.boolean(),
        z.object({
          type: z.enum(['number']).optional(),
          code: z.string().optional(),
          style: z.string().optional(),
        }),
      ])
      .optional(),
    indentLevel: z.number().int().min(0).max(32).optional(),
    lineSpacing: z.number().min(0).max(200).optional(),
    paraSpaceAfter: z.number().min(0).max(200).optional(),
  })
  .strict()

const PptxTextObject = z
  .object({
    kind: z.literal('text'),
    id: z.string().optional(),
    text: z.string(),
    box: SlideBox,
    options: TextOptions.optional(),
  })
  .strict()

const PptxBulletsObject = z
  .object({
    kind: z.literal('bullets'),
    id: z.string().optional(),
    items: z.array(z.string().min(1)).min(1),
    box: SlideBox,
    options: TextOptions.optional(),
  })
  .strict()

const PptxImageObject = z
  .object({
    kind: z.literal('image'),
    id: z.string().optional(),
    // どちらか
    dataUrl: z.string().optional().describe('data:image/...;base64,...'),
    url: z.string().url().optional(),
    box: SlideBox,
  })
  .strict()

const PptxTableObject = z
  .object({
    kind: z.literal('table'),
    id: z.string().optional(),
    rows: z.array(z.array(z.string())).min(1),
    box: SlideBox,
    options: z
      .object({
        fontFace: z.string().optional(),
        fontSize: z.number().min(6).max(48).optional(),
        color: HexColor.optional(),
        fill: HexColor.optional(),
        align: z.enum(['left', 'center', 'right']).optional(),
        valign: z.enum(['top', 'middle', 'bottom', 't', 'm', 'b']).optional(),
        border: z
          .object({
            type: z.enum(['none', 'solid', 'dash']).optional(),
            pt: z.string().optional(),
            color: HexColor.optional(),
          })
          .optional(),
        autoPage: z.boolean().optional(),
        autoPageRepeatHeader: z.boolean().optional(),
        autoPageHeaderRows: z.number().int().min(0).max(10).optional(),
        newSlideStartY: z.number().optional(),
      })
      .optional(),
  })
  .strict()

const ChartSeries = z
  .object({
    name: z.string().min(1),
    labels: z.array(z.string().min(1)).min(1),
    values: z.array(z.number()).min(1),
  })
  .strict()

const PptxChartObject = z
  .object({
    kind: z.literal('chart'),
    id: z.string().optional(),
    chartType: z.enum(['bar', 'line', 'pie', 'doughnut', 'area', 'scatter', 'radar']),
    data: z.array(ChartSeries).min(1),
    box: SlideBox,
    options: z
      .object({
        title: z.string().optional(),
        showTitle: z.boolean().optional(),
        showLegend: z.boolean().optional(),
        legendPos: z.enum(['b', 'tr', 'l', 'r', 't']).optional(),
        showValue: z.boolean().optional(),
        showPercent: z.boolean().optional(),
        chartColors: z.array(HexColor).optional(),
      })
      .optional(),
  })
  .strict()

export const PptxSlideObjectSchema = z.discriminatedUnion('kind', [
  PptxTextObject,
  PptxBulletsObject,
  PptxImageObject,
  PptxTableObject,
  PptxChartObject,
])

export const PptxSlideSpecSchema = z
  .object({
    title: z.string().optional(),
    backgroundColor: HexColor.optional(),
    objects: z.array(PptxSlideObjectSchema).min(1),
  })
  .strict()

export const PptxSpecSchema = z
  .object({
    meta: z
      .object({
        title: z.string().optional(),
        author: z.string().optional(),
        layout: z.literal('LAYOUT_WIDE').default('LAYOUT_WIDE'),
      })
      .strict()
      .optional(),
    slides: z.array(PptxSlideSpecSchema).min(1),
  })
  .strict()

export type PptxSpec = z.infer<typeof PptxSpecSchema>
export type PptxSlideSpec = z.infer<typeof PptxSlideSpecSchema>
export type PptxSlideObject = z.infer<typeof PptxSlideObjectSchema>
