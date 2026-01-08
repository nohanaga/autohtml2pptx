import { z } from 'zod'
import type { ChatHistoryMessage } from '../../shared/types/chat'

const GenerateHtmlResponseSchema = z.object({
  html: z.string(),
})

export async function generateHtml(input: { messages: ChatHistoryMessage[]; currentHtml?: string }) {
  const response = await fetch('/api/generate-html', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `APIエラー (${response.status})${text ? `: ${text.slice(0, 500)}` : ''}`,
    )
  }

  const json = await response.json()
  return GenerateHtmlResponseSchema.parse(json)
}
