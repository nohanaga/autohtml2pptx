import { z } from 'zod'
import type { ChatHistoryMessage } from '../../shared/types/chat'
import { DeckSpecSchema } from '../../shared/deckSpec'

const GenerateDeckSpecResponseSchema = z.object({
  deck: DeckSpecSchema,
})

export async function generateDeckSpec(input: {
  messages: ChatHistoryMessage[]
  currentHtml?: string
}) {
  const response = await fetch('/api/generate-deck-spec', {
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
  return GenerateDeckSpecResponseSchema.parse(json)
}
