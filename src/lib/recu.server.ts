import Anthropic from '@anthropic-ai/sdk'
import { getStore } from '@netlify/blobs'
import { getDatabase } from '@netlify/database'
import { parseModelJson } from './ai'
import { LESSON_MODEL, generationParams } from './models'
import { receiptPrompt, receiptReadingSchema, type ReceiptReading } from './recu'

// Reçus privés : jamais publics, relus uniquement par la console admin.
const store = () => getStore('recus-paiement')

let client: Anthropic | null = null
const anthropic = () => (client ??= new Anthropic())

type Image = { mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string }

/** Analyses de reçus de l'élève sur la dernière heure (anti-abus, refus compris). */
export async function receiptChecksLastHour(userId: string) {
  const [row] = await getDatabase().sql<{ n: number }>`SELECT count(*)::int AS n FROM ai_events
    WHERE user_id = ${userId} AND kind = 'recu' AND created_at > now() - interval '1 hour'`
  return Number(row?.n ?? 0)
}

/** Lecture du reçu par l'IA (null si l'analyse est indisponible : l'admin vérifiera à la main). */
export async function readReceipt(
  userId: string,
  image: Image,
  attendu: { amount: number; method: string; reference: string },
): Promise<ReceiptReading | null> {
  let status = 'error'
  let usage: { input_tokens?: number; output_tokens?: number } | undefined
  try {
    const message = await anthropic().messages.create(
      {
        model: LESSON_MODEL,
        ...generationParams(LESSON_MODEL, 500),
        system: receiptPrompt(attendu),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
              { type: 'text', text: 'Lis ce reçu et réponds en JSON.' },
            ],
          },
        ],
      },
      { timeout: 45_000, maxRetries: 1 },
    )
    usage = message.usage
    const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    const parsed = receiptReadingSchema.safeParse(parseModelJson(text))
    status = parsed.success ? 'ok' : 'error'
    return parsed.success ? parsed.data : null
  } catch {
    return null
  } finally {
    try {
      await getDatabase().sql`INSERT INTO ai_events (id, user_id, kind, mode, status, input_tokens, output_tokens)
        VALUES (${crypto.randomUUID()}, ${userId}, 'recu', ${attendu.method}, ${status},
          ${usage?.input_tokens ?? 0}, ${usage?.output_tokens ?? 0})`
    } catch {
      // Le journal ne bloque jamais l'envoi du reçu.
    }
  }
}

export async function saveReceipt(paymentId: string, image: Image) {
  const key = `${paymentId}`
  const bytes = Buffer.from(image.data, 'base64')
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  await store().set(key, body, {
    metadata: { mediaType: image.mediaType },
  })
  return key
}

export async function loadReceipt(key: string) {
  const res = await store().getWithMetadata(key, { type: 'arrayBuffer' })
  if (!res) return null
  const mediaType = String(res.metadata?.mediaType ?? 'image/jpeg')
  return `data:${mediaType};base64,${Buffer.from(res.data).toString('base64')}`
}
