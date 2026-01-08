import { PptxIntentSpecSchema, type PptxIntentSpec } from '../../shared/pptxIntent'

export async function generatePptxIntent(input: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  currentHtml?: string
}): Promise<PptxIntentSpec> {
  const res = await fetch('/api/generate-pptx-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed: ${res.status}`)
  }

  const json = (await res.json()) as unknown
  const intent = (json as any)?.intent
  return PptxIntentSpecSchema.parse(intent)
}
