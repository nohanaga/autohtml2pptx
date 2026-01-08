import { z } from 'zod'

// NewDesign2: PptxGenJSで確実にレンダリングできることを優先した、座標なしのDeckSpec。
// 既存のPptxSpec(mode1)とは別のDSLとして扱う。

const HexColor = z
  .string()
  .regex(/^[0-9A-Fa-f]{6}$/)
  .describe('6桁HEX（#なし）例: FFFFFF')

export const DeckBulletSchema = z
  .object({
    text: z.string().min(1),
    level: z.number().int().min(0).max(4).optional(),
    emphasis: z.enum(['none', 'strong']).optional(),
  })
  .strict()

export type DeckBullet = z.infer<typeof DeckBulletSchema>

const DeckImageAssetSchema = z
  .object({
    id: z.string().min(1),
    src: z.string().min(1).describe('URL / file path / data URI'),
    alt: z.string().optional(),
    credit: z.string().optional(),
  })
  .strict()

export const DeckThemeSchema = z
  .object({
    // 既存実装はWIDE前提なので、まずはWIDEのみ許可（必要なら拡張）
    layout: z.literal('LAYOUT_WIDE').default('LAYOUT_WIDE'),
    fonts: z
      .object({
        head: z.string().min(1),
        body: z.string().min(1),
      })
      .strict(),
    colors: z
      .object({
        bg: HexColor.optional(),
        text: HexColor.optional(),
        accent: HexColor.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export type DeckTheme = z.infer<typeof DeckThemeSchema>

export const DeckMetaSchema = z
  .object({
    title: z.string().min(1),
    subtitle: z.string().optional(),
    lang: z.enum(['ja', 'en']).default('ja'),
    audience: z.string().optional(),
    purpose: z.string().optional(),
  })
  .strict()

export type DeckMeta = z.infer<typeof DeckMetaSchema>

const DeckImageRefSchema = z
  .object({
    asset_id: z.string().optional(),
    // LLMがassetsを作らずに直接URLを入れることがあるため、許容して正規化する
    src: z.string().optional(),
    caption: z.string().optional(),
  })
  .strict()
  .refine((v) => Boolean(v.asset_id || v.src), {
    message: 'image: asset_id または src が必要です',
    path: ['asset_id'],
  })

const DeckTableSchema = z
  .object({
    columns: z.array(z.string().min(1)).min(1),
    rows: z.array(z.array(z.string())).min(1),
    note: z.string().optional(),
  })
  .strict()

const DeckChartSeriesSchema = z
  .object({
    name: z.string().min(1),
    values: z.array(z.number()).min(1),
  })
  .strict()

const DeckChartSchema = z
  .object({
    chart_type: z.enum(['bar', 'line', 'pie']),
    categories: z.array(z.string().min(1)).optional(),
    series: z.array(DeckChartSeriesSchema).min(1),
    note: z.string().optional(),
  })
  .strict()

const SlideLeftRightSchema = z
  .object({
    heading: z.string().optional(),
    bullets: z.array(DeckBulletSchema).optional(),
  })
  .strict()

export const DeckSlideSchema = z
  .object({
    id: z.string().min(1),
    layout_type: z.enum([
      'title',
      'title_bullets',
      'two_column_bullets',
      'image_left_bullets_right',
      'image_full_bleed',
      'table',
      'chart',
    ]),
    title: z.string().min(1),
    subtitle: z.string().optional(),

    bullets: z.array(DeckBulletSchema).optional(),

    left: SlideLeftRightSchema.optional(),
    right: SlideLeftRightSchema.optional(),

    image: DeckImageRefSchema.optional(),
    table: DeckTableSchema.optional(),
    chart: DeckChartSchema.optional(),

    speaker_notes: z.string().optional(),
    overrides: z.record(z.string(), z.any()).optional(),
  })
  .strict()

export type DeckSlide = z.infer<typeof DeckSlideSchema>

export const DeckSpecSchema = z
  .object({
    meta: DeckMetaSchema,
    theme: DeckThemeSchema,
    assets: z
      .object({
        images: z.array(DeckImageAssetSchema).optional(),
      })
      .strict()
      .optional(),
    slides: z.array(DeckSlideSchema).min(1),
  })
  .strict()

export type DeckSpec = z.infer<typeof DeckSpecSchema>
