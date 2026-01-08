import express from 'express'
import dotenv from 'dotenv'
import { z } from 'zod'
import { PptxSpecSchema } from '../src/shared/pptxSpec'
import { PptxIntentSpecSchema } from '../src/shared/pptxIntent'
import { DeckSpecSchema } from '../src/shared/deckSpec'

dotenv.config()

type OpenAiDebugEntry = {
  at: string
  kind: 'generate-html' | 'generate-pptx-spec' | 'generate-pptx-intent' | 'generate-deck-spec'
  requestUrl: string
  requestBody: unknown
  responseStatus: number
  responseText: string
  responseJson: unknown
}

const OPENAI_DEBUG_ENABLED = process.env.DEBUG_OPENAI === '1' || process.env.NODE_ENV !== 'production'
let lastOpenAiDebug: OpenAiDebugEntry | null = null

function setLastOpenAiDebug(next: OpenAiDebugEntry) {
  // Keep it bounded to avoid blowing up memory if HTML is huge.
  const maxText = 60_000
  lastOpenAiDebug = {
    ...next,
    responseText: next.responseText.length > maxText ? `${next.responseText.slice(0, maxText)}\n...[truncated]` : next.responseText,
  }
}

const EnvSchema = z.object({
  AZURE_OPENAI_ENDPOINT: z.string().url(),
  AZURE_OPENAI_API_KEY: z.string().min(1),
  AZURE_OPENAI_DEPLOYMENT_NAME: z.string().min(1),
  OPENAI_API_VERSION: z.string().optional().default('2024-10-21'),
  PORT: z.string().optional().default('8787'),
})

const envResult = EnvSchema.safeParse(process.env)
const env = envResult.success ? envResult.data : null
if (!env) {
  console.warn(
    '[api] Azure OpenAI is not configured. Copy .env.example to .env and set AZURE_OPENAI_* variables.',
  )
}

const app = express()
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, configured: Boolean(env) })
})

app.get('/api/debug/openai-last', (_req, res) => {
  if (!OPENAI_DEBUG_ENABLED) {
    res.status(404).json({ error: 'debug disabled' })
    return
  }
  res.json({ enabled: true, last: lastOpenAiDebug })
})

const GenerateHtmlRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1),
    }),
  ),
  currentHtml: z.string().optional(),
})

app.post('/api/generate-html', async (req, res) => {
  const parsed = GenerateHtmlRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  if (!env) {
    res
      .status(503)
      .send(
        'Azure OpenAI is not configured. Create a .env file (see .env.example) and set AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY / AZURE_OPENAI_DEPLOYMENT_NAME.',
      )
    return
  }

  try {
    const html = await callAzureOpenAIToGenerateHtml(env, parsed.data)
    res.json({ html })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).send(message)
  }
})

const GeneratePptxSpecRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1),
    }),
  ),
  currentHtml: z.string().optional(),
})

app.post('/api/generate-pptx-spec', async (req, res) => {
  const parsed = GeneratePptxSpecRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  if (!env) {
    res
      .status(503)
      .send(
        'Azure OpenAI is not configured. Create a .env file (see .env.example) and set AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY / AZURE_OPENAI_DEPLOYMENT_NAME.',
      )
    return
  }

  try {
    const spec = await callAzureOpenAIToGeneratePptxSpec(env, parsed.data)
    res.json({ spec })
  } catch (e) {
    const err = toHttpError(e)
    console.error('[api] generate-pptx-spec failed:', err)
    res.status(err.status).json({ error: err.message })
  }
})

app.post('/api/generate-pptx-intent', async (req, res) => {
  const parsed = GeneratePptxSpecRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  if (!env) {
    res
      .status(503)
      .send(
        'Azure OpenAI is not configured. Create a .env file (see .env.example) and set AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY / AZURE_OPENAI_DEPLOYMENT_NAME.',
      )
    return
  }

  try {
    const intent = await callAzureOpenAIToGeneratePptxIntent(env, parsed.data)
    res.json({ intent })
  } catch (e) {
    const err = toHttpError(e)
    console.error('[api] generate-pptx-intent failed:', err)
    res.status(err.status).json({ error: err.message })
  }
})

app.post('/api/generate-deck-spec', async (req, res) => {
  const parsed = GeneratePptxSpecRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  if (!env) {
    res
      .status(503)
      .send(
        'Azure OpenAI is not configured. Create a .env file (see .env.example) and set AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY / AZURE_OPENAI_DEPLOYMENT_NAME.',
      )
    return
  }

  try {
    const deck = await callAzureOpenAIToGenerateDeckSpec(env, parsed.data)
    res.json({ deck })
  } catch (e) {
    const err = toHttpError(e)
    console.error('[api] generate-deck-spec failed:', err)
    res.status(err.status).json({ error: err.message })
  }
})

function toHttpError(e: unknown): { status: number; message: string } {
  const message = e instanceof Error ? e.message : 'Unknown error'

  // If upstream Azure OpenAI returned an HTTP error, preserve its status code if present.
  const m = message.match(/^Azure OpenAI error \((\d+)\):/)
  if (m?.[1]) {
    const status = Number(m[1])
    if (Number.isFinite(status) && status >= 400 && status <= 599) {
      return { status, message }
    }
  }

  // Validation errors are client-visible but still originate server-side.
  if (
    message.startsWith('Invalid PPTX spec:') ||
    message.startsWith('Invalid PPTX intent:') ||
    message.startsWith('Invalid Deck spec:')
  ) {
    return { status: 422, message }
  }

  return { status: 500, message }
}

const port = Number((env?.PORT ?? '8787').toString())
app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`)
})

async function callAzureOpenAIToGenerateHtml(
  env: z.infer<typeof EnvSchema>,
  input: { messages: Array<{ role: 'user' | 'assistant'; content: string }>; currentHtml?: string },
) {
  const endpoint = env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, '')
  const deployment = encodeURIComponent(env.AZURE_OPENAI_DEPLOYMENT_NAME)
  const apiVersion = encodeURIComponent(env.OPENAI_API_VERSION)

  // Microsoft Learn: /openai/deployments/{deployment-id}/chat/completions?api-version=...
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content:
        'You generate production-ready HTML. Return ONLY a single complete HTML document. No Markdown, no code fences. Use inline CSS. Prefer Bootstrap 5 classes when helpful, but do not link external assets unless explicitly requested.',
    },
  ]

  if (input.currentHtml) {
    messages.push({
      role: 'user',
      content: `コンテキスト: 現在のHTMLは以下です。\n\n---\n${input.currentHtml}\n---\n\n以降の会話の要件に沿って、HTML全体を更新してください。`,
    })
  }

  // 厳密: フロントから来た user/assistant の履歴をそのまま渡す
  for (const m of input.messages) {
    messages.push({ role: m.role, content: m.content })
  }

  const requestBody = {
    messages,
    temperature: 0.3,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': env.AZURE_OPENAI_API_KEY,
    },
    body: JSON.stringify(requestBody),
  })

  const jsonText = await response.text()
  if (OPENAI_DEBUG_ENABLED) {
    setLastOpenAiDebug({
      at: new Date().toISOString(),
      kind: 'generate-html',
      requestUrl: url,
      requestBody,
      responseStatus: response.status,
      responseText: jsonText,
      responseJson: safeJsonParse(jsonText),
    })
  }
  if (!response.ok) {
    throw new Error(`Azure OpenAI error (${response.status}): ${jsonText.slice(0, 1500)}`)
  }

  const data = safeJsonParse(jsonText)
  const content = extractMessageContent(data)

  if (!content.trim()) {
    throw new Error('Azure OpenAI returned empty content')
  }

  return normalizeHtml(content)
}

async function callAzureOpenAIToGeneratePptxSpec(
  env: z.infer<typeof EnvSchema>,
  input: { messages: Array<{ role: 'user' | 'assistant'; content: string }>; currentHtml?: string },
) {
  const endpoint = env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, '')
  const deployment = encodeURIComponent(env.AZURE_OPENAI_DEPLOYMENT_NAME)
  const apiVersion = encodeURIComponent(env.OPENAI_API_VERSION)

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`

  const baseMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content:
        'You convert user requirements into a PPTX specification JSON for PptxGenJS. Output ONLY valid JSON. No Markdown, no code fences. The slide size is LAYOUT_WIDE (13.333 x 7.5 inches). Use inches for x/y/w/h. IMPORTANT: object position/size must be nested under a "box" object: {"box":{"x":..,"y":..,"w":..,"h":..}}. IMPORTANT: styling must be nested under "options" (NOT "style"). Use 6-hex colors WITHOUT # (e.g., FFFFFF). Supported object kinds: text, bullets, image, table, chart. For bullets, provide items[]. For table, provide rows[][] as strings. For chart, provide chartType and data[] with name/labels/values. Keep content concise, avoid overlap, keep margins (~0.5in).',
    },
  ]

  if (input.currentHtml) {
    baseMessages.push({
      role: 'user',
      content: `Context: current HTML (may describe desired content/layout).\n---\n${input.currentHtml}\n---`,
    })
  }

  for (const m of input.messages) {
    baseMessages.push({ role: m.role, content: m.content })
  }

  baseMessages.push({
    role: 'user',
    content:
      'Return a JSON object that matches this shape exactly: {"meta": {"title"?: string, "author"?: string, "layout": "LAYOUT_WIDE"}, "slides": [{"title"?: string, "backgroundColor"?: "RRGGBB", "objects": [ ... ]}]}. No extra keys at the top-level.',
  })

  let lastContent = ''
  let lastError = ''

  for (let attempt = 0; attempt < 2; attempt++) {
    const messages = [...baseMessages]
    if (attempt === 1) {
      messages.push({
        role: 'user',
        content:
          `Your previous JSON failed validation. Fix the JSON and output ONLY the corrected JSON.\nValidation errors: ${lastError}\nPrevious JSON: ${lastContent}`,
      })
    }

    const requestBody = {
      messages,
      temperature: attempt === 0 ? 0.2 : 0.0,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify(requestBody),
    })

    const jsonText = await response.text()
    if (OPENAI_DEBUG_ENABLED) {
      setLastOpenAiDebug({
        at: new Date().toISOString(),
        kind: 'generate-pptx-spec',
        requestUrl: url,
        requestBody,
        responseStatus: response.status,
        responseText: jsonText,
        responseJson: safeJsonParse(jsonText),
      })
    }
    if (!response.ok) {
      throw new Error(`Azure OpenAI error (${response.status}): ${jsonText.slice(0, 1500)}`)
    }

    const data = safeJsonParse(jsonText)
    const content = extractMessageContent(data)
    lastContent = normalizeJson(content)

    const raw = safeJsonParse(lastContent)
    const normalized = normalizePptxSpecJson(raw)
    const parsed = PptxSpecSchema.safeParse(normalized)
    if (parsed.success) return parsed.data

    lastError = JSON.stringify(parsed.error.flatten())
  }

  throw new Error(`Invalid PPTX spec: ${lastError.slice(0, 1500)}`)
}

async function callAzureOpenAIToGeneratePptxIntent(
  env: z.infer<typeof EnvSchema>,
  input: { messages: Array<{ role: 'user' | 'assistant'; content: string }>; currentHtml?: string },
) {
  const endpoint = env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, '')
  const deployment = encodeURIComponent(env.AZURE_OPENAI_DEPLOYMENT_NAME)
  const apiVersion = encodeURIComponent(env.OPENAI_API_VERSION)
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`

  const baseMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: `You convert user requirements (and provided HTML) into a PPTX INTENT JSON for PptxGenJS. Output ONLY valid JSON. No Markdown, no code fences. Do NOT output x/y/w/h/box. Do NOT output low-level styling unless necessary. Focus on semantic structure: slides with title/bullets/tables/charts/images.

IMPORTANT: Capture ALL meaningful content from the HTML, including right-side panels/aside sections (e.g., "目的", "備考"). When there are multiple bullet groups with headings, use bulletSections: [{"title": string?, "items": string[]}]. Keep bullets separate per section rather than merging.

For tables: rows[][] strings. For charts: chartType + data[] with name/labels/values. Use 6-hex colors WITHOUT # (e.g., FFFFFF) only when explicitly requested. It is OK to split content across multiple slides to avoid dropping content.`,
    },
  ]

  if (input.currentHtml) {
    baseMessages.push({
      role: 'user',
      content: `Context: current HTML (may describe desired content/layout).\n---\n${input.currentHtml}\n---`,
    })
  }

  for (const m of input.messages) {
    baseMessages.push({ role: m.role, content: m.content })
  }

  baseMessages.push({
    role: 'user',
    content:
      'Return JSON matching: {"meta"?: {"title"?: string, "author"?: string, "layout": "LAYOUT_WIDE"}, "slides": [{"title"?: string, "backgroundColor"?: "RRGGBB", "bullets"?: string[], "bulletSections"?: [{"title"?: string, "items": string[]}], "tables"?: [{"title"?:string,"rows":string[][]}], "charts"?: [{"title"?:string,"chartType":string,"data":any[]}], "images"?: [{"title"?:string,"dataUrl"?:string,"url"?:string}], "speakerNotes"?: string}]}.',
  })

  let lastContent = ''
  let lastError = ''

  for (let attempt = 0; attempt < 2; attempt++) {
    const messages = [...baseMessages]
    if (attempt === 1) {
      messages.push({
        role: 'user',
        content:
          `Your previous JSON failed validation. Fix the JSON and output ONLY the corrected JSON.\nValidation errors: ${lastError}\nPrevious JSON: ${lastContent}`,
      })
    }

    const requestBody = {
      messages,
      temperature: attempt === 0 ? 0.2 : 0.0,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify(requestBody),
    })

    const jsonText = await response.text()
    if (OPENAI_DEBUG_ENABLED) {
      setLastOpenAiDebug({
        at: new Date().toISOString(),
        kind: 'generate-pptx-intent',
        requestUrl: url,
        requestBody,
        responseStatus: response.status,
        responseText: jsonText,
        responseJson: safeJsonParse(jsonText),
      })
    }
    if (!response.ok) {
      throw new Error(`Azure OpenAI error (${response.status}): ${jsonText.slice(0, 1500)}`)
    }

    const data = safeJsonParse(jsonText)
    const content = extractMessageContent(data)
    lastContent = normalizeJson(content)
    const raw = safeJsonParse(lastContent)
    const normalized = normalizePptxIntentJson(raw)
    const parsed = PptxIntentSpecSchema.safeParse(normalized)
    if (parsed.success) return parsed.data
    lastError = JSON.stringify(parsed.error.flatten())
  }

  throw new Error(`Invalid PPTX intent: ${lastError.slice(0, 1500)}`)
}

async function callAzureOpenAIToGenerateDeckSpec(
  env: z.infer<typeof EnvSchema>,
  input: { messages: Array<{ role: 'user' | 'assistant'; content: string }>; currentHtml?: string },
) {
  const endpoint = env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, '')
  const deployment = encodeURIComponent(env.AZURE_OPENAI_DEPLOYMENT_NAME)
  const apiVersion = encodeURIComponent(env.OPENAI_API_VERSION)
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`

  const baseMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: `You convert user requirements AND the provided HTML into a DeckSpec JSON for PptxGenJS rendering.

Output ONLY valid JSON. No Markdown, no code fences.
Do NOT output x/y/w/h/box.

CRITICAL RULES (follow strictly):
- Treat the provided HTML as the SOURCE OF TRUTH.
- Do NOT invent content that is not present in the HTML or the conversation.
- Do NOT paraphrase. Prefer copying text verbatim from the HTML (Japanese stays Japanese).
- Capture ALL meaningful content from the HTML, including right-side panels/aside sections (e.g., "目的", "備考").
- If the HTML looks like a single slide, output exactly 1 slide.

Design rules:
- Prefer a SMALL set of layout_type values and fill only the fields required by that layout.
- Keep slides concise BUT do not drop important content; split into multiple slides only when necessary.
- Use theme.layout = "LAYOUT_WIDE".

Layout selection guidance:
- Cover/表紙: use layout_type "title" (use subtitle when present).
- Title + bullet list: use "title_bullets".
- Two groups of bullets: use "two_column_bullets" with left/right.
- Image + bullets: use "image_left_bullets_right".

DeckSpec shape (no extra top-level keys):
{
  "meta": {"title": string, "subtitle"?: string, "lang": "ja"|"en", "audience"?: string, "purpose"?: string},
  "theme": {"layout": "LAYOUT_WIDE", "fonts": {"head": string, "body": string}, "colors"?: {"bg"?:"RRGGBB","text"?:"RRGGBB","accent"?:"RRGGBB"}},
  "assets"?: {"images"?: [{"id": string, "src": string, "alt"?: string, "credit"?: string}]},
  "slides": [{
    "id": string,
    "layout_type": "title"|"title_bullets"|"two_column_bullets"|"image_left_bullets_right"|"image_full_bleed"|"table"|"chart",
    "title": string,
    "subtitle"?: string,
    "bullets"?: [{"text": string, "level"?: number, "emphasis"?: "none"|"strong"}],
    "left"?: {"heading"?: string, "bullets"?: [{"text": string, "level"?: number}]},
    "right"?: {"heading"?: string, "bullets"?: [{"text": string, "level"?: number}]},
    "image"?: {"asset_id"?: string, "src"?: string, "caption"?: string},
    "table"?: {"columns": string[], "rows": string[][], "note"?: string},
    "chart"?: {"chart_type": "bar"|"line"|"pie", "categories"?: string[], "series": [{"name": string, "values": number[]}], "note"?: string},
    "speaker_notes"?: string
  }]
}

Notes:
- For images, prefer referencing assets.images via asset_id; if unavailable, you may put a direct URL in image.src.
- Colors must be 6-hex WITHOUT # (e.g., FFFFFF) only when explicitly requested or obvious from context.
`,
    },
  ]

  if (input.currentHtml) {
    baseMessages.push({
      role: 'user',
      content: `Context: current HTML (may describe desired content/layout).\n---\n${input.currentHtml}\n---`,
    })
  }

  for (const m of input.messages) {
    baseMessages.push({ role: m.role, content: m.content })
  }

  baseMessages.push({
    role: 'user',
    content: 'Return ONLY the DeckSpec JSON object. No extra wrapper keys.',
  })

  let lastContent = ''
  let lastError = ''

  for (let attempt = 0; attempt < 2; attempt++) {
    const messages = [...baseMessages]
    if (attempt === 1) {
      messages.push({
        role: 'user',
        content:
          `Your previous JSON failed validation. Fix the JSON and output ONLY the corrected JSON.\nValidation errors: ${lastError}\nPrevious JSON: ${lastContent}`,
      })
    }

    const requestBody = {
      messages,
      temperature: attempt === 0 ? 0.2 : 0.0,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify(requestBody),
    })

    const jsonText = await response.text()
    if (OPENAI_DEBUG_ENABLED) {
      setLastOpenAiDebug({
        at: new Date().toISOString(),
        kind: 'generate-deck-spec',
        requestUrl: url,
        requestBody,
        responseStatus: response.status,
        responseText: jsonText,
        responseJson: safeJsonParse(jsonText),
      })
    }
    if (!response.ok) {
      throw new Error(`Azure OpenAI error (${response.status}): ${jsonText.slice(0, 1500)}`)
    }

    const data = safeJsonParse(jsonText)
    const content = extractMessageContent(data)
    lastContent = normalizeJson(content)
    const raw = safeJsonParse(lastContent)
    const normalized = normalizeDeckSpecJson(raw)
    const parsed = DeckSpecSchema.safeParse(normalized)
    if (parsed.success) return parsed.data
    lastError = JSON.stringify(parsed.error.flatten())
  }

  throw new Error(`Invalid Deck spec: ${lastError.slice(0, 1500)}`)
}

const ChatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z
          .object({
            content: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
})

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function extractMessageContent(data: unknown): string {
  const parsed = ChatCompletionResponseSchema.safeParse(data)
  if (!parsed.success) return ''
  return parsed.data.choices?.[0]?.message?.content ?? ''
}

function normalizeHtml(content: string) {
  let html = content.trim()

  // In case the model returns fences despite the system message.
  html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '')
  html = html.replace(/\s*```\s*$/i, '')

  if (!/^<!doctype html>/i.test(html)) {
    // If the model returned a fragment, wrap it.
    if (!/<html[\s>]/i.test(html)) {
      html = `<!doctype html>\n<html lang="ja">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>GenHTML2PPTX</title>\n  </head>\n  <body>\n${html}\n  </body>\n</html>`
    } else {
      html = `<!doctype html>\n${html}`
    }
  }

  return html
}

function normalizeJson(content: string) {
  let text = content.trim()
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '')
  text = text.replace(/\s*```\s*$/i, '')
  return text.trim()
}

function normalizePptxSpecJson(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const root = value as any

  if (!root.slides && Array.isArray(root.pages)) root.slides = root.pages
  if (!Array.isArray(root.slides) && Array.isArray(root.Slides)) root.slides = root.Slides

  if (Array.isArray(root.slides)) {
    root.slides = root.slides.map((s: any) => normalizeSlideSpecJson(s))
  }

  return root
}

function normalizePptxIntentJson(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const root: any = value

  if (!root.slides && Array.isArray(root.pages)) root.slides = root.pages
  if (Array.isArray(root.slides)) {
    root.slides = root.slides.map((s: any) => {
      if (!s || typeof s !== 'object') return s
      const slide: any = { ...s }
      if (!slide.bullets && Array.isArray(slide.bulletPoints)) slide.bullets = slide.bulletPoints
      if (!slide.bulletSections && Array.isArray(slide.sections)) slide.bulletSections = slide.sections
      if (!slide.bulletSections && Array.isArray(slide.panels)) slide.bulletSections = slide.panels
      if (Array.isArray(slide.bulletSections)) {
        slide.bulletSections = slide.bulletSections
          .map((sec: any) => {
            if (!sec || typeof sec !== 'object') return null
            const out: any = { ...sec }
            if (!out.items && Array.isArray(out.bullets)) out.items = out.bullets
            if (!out.items && Array.isArray(out.bulletPoints)) out.items = out.bulletPoints
            return out
          })
          .filter(Boolean)
      }
      if (!slide.tables && Array.isArray(slide.table)) slide.tables = slide.table
      if (!slide.charts && Array.isArray(slide.chart)) slide.charts = slide.chart
      if (!slide.images && Array.isArray(slide.image)) slide.images = slide.image
      return slide
    })
  }

  return root
}

function normalizeDeckSpecJson(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const root: any = value

  if (!root.slides && Array.isArray(root.pages)) root.slides = root.pages
  if (Array.isArray(root.slides)) {
    root.slides = root.slides.map((s: any) => {
      if (!s || typeof s !== 'object') return s
      const slide: any = { ...s }
      if (!slide.layout_type && typeof slide.layoutType === 'string') slide.layout_type = slide.layoutType
      if (!slide.layout_type && typeof slide.layout === 'string') slide.layout_type = slide.layout
      if (!slide.speaker_notes && typeof slide.speakerNotes === 'string') slide.speaker_notes = slide.speakerNotes

      if (slide.image && typeof slide.image === 'object') {
        const image: any = { ...slide.image }
        if (!image.asset_id && typeof image.assetId === 'string') image.asset_id = image.assetId
        if (!image.src && typeof image.url === 'string') image.src = image.url
        slide.image = image
      }

      return slide
    })
  }

  // theme aliases
  if (root.theme && typeof root.theme === 'object') {
    if (!root.theme.layout && typeof (root.theme as any).slideLayout === 'string') {
      root.theme.layout = (root.theme as any).slideLayout
    }
  }

  return root
}

function normalizeSlideSpecJson(slide: any): any {
  if (!slide || typeof slide !== 'object') return slide
  const s: any = { ...slide }

  // elements -> objects
  if (!Array.isArray(s.objects) && Array.isArray(s.elements)) s.objects = s.elements

  // background aliases
  if (!s.backgroundColor && typeof s.bgColor === 'string') s.backgroundColor = s.bgColor
  if (!s.backgroundColor && typeof s.background === 'string') s.backgroundColor = s.background

  // LLMがslide直下にx/y/w/h/styleを誤って置くことがあるので除去
  delete s.x
  delete s.y
  delete s.w
  delete s.h
  delete s.style

  if (Array.isArray(s.objects)) {
    s.objects = s.objects
      .filter(Boolean)
      .map((o: any) => normalizeSlideObjectJson(o))
  }

  return s
}

function normalizeSlideObjectJson(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  const o: any = { ...obj }

  if (!o.kind && typeof o.type === 'string') o.kind = o.type

  if (!o.box && typeof o.x === 'number' && typeof o.y === 'number' && typeof o.w === 'number' && typeof o.h === 'number') {
    o.box = { x: o.x, y: o.y, w: o.w, h: o.h }
  }
  delete o.x
  delete o.y
  delete o.w
  delete o.h

  if (!o.options && o.style && typeof o.style === 'object') {
    o.options = o.style
  }
  delete o.style

  if (o.kind === 'bullets') {
    if (!Array.isArray(o.items) && typeof o.text === 'string') {
      o.items = o.text
        .split(/\r?\n/)
        .map((t: string) => t.trim())
        .filter(Boolean)
    }
  }

  if (o.kind === 'table') {
    if (!Array.isArray(o.rows) && Array.isArray(o.data)) o.rows = o.data
  }

  if (o.kind === 'chart') {
    if (!Array.isArray(o.data) && Array.isArray(o.series)) o.data = o.series
  }

  if (o.kind === 'image') {
    if (!o.dataUrl && typeof o.data === 'string') o.dataUrl = o.data
    if (!o.dataUrl && typeof o.src === 'string') o.dataUrl = o.src
  }

  return o
}
