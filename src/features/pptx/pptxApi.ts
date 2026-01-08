import { z } from 'zod'
import type { ChatHistoryMessage } from '../../shared/types/chat'
import { PptxSpecSchema } from '../../shared/pptxSpec'

const GeneratePptxSpecResponseSchema = z.object({
  spec: PptxSpecSchema,
})

export async function generatePptxSpec(input: {
  messages: ChatHistoryMessage[]
  currentHtml?: string
}) {
  const response = await fetch('/api/generate-pptx-spec', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`APIエラー (${response.status})${text ? `: ${text.slice(0, 500)}` : ''}`)
  }

  const json = await response.json()
  return GeneratePptxSpecResponseSchema.parse(json)
}
