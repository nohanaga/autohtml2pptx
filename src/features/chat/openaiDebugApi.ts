import { z } from 'zod'

const OpenAiDebugEntrySchema = z
  .object({
    at: z.string(),
    kind: z.string(),
    requestUrl: z.string(),
    requestBody: z.unknown(),
    responseStatus: z.number(),
    responseText: z.string(),
    responseJson: z.unknown(),
  })
  .strict()

const OpenAiDebugResponseSchema = z
  .object({
    enabled: z.boolean().optional(),
    last: OpenAiDebugEntrySchema.nullable().optional(),
    error: z.string().optional(),
  })
  .passthrough()

export type OpenAiDebugEntry = z.infer<typeof OpenAiDebugEntrySchema>

export async function fetchLastOpenAiDebug(): Promise<OpenAiDebugEntry | null> {
  const res = await fetch('/api/debug/openai-last')
  if (!res.ok) return null
  const json = await res.json()
  const parsed = OpenAiDebugResponseSchema.safeParse(json)
  if (!parsed.success) return null
  return (parsed.data.last as OpenAiDebugEntry | null) ?? null
}
