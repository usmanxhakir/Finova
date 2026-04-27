import { createClient } from '@/lib/supabase/server'
import { loadAgentContext, buildSystemPrompt } from '@/lib/agent/context-loader'
import { resolveIntent } from '@/lib/agent/resolver'
import type { ParseResponse, ParsedIntent } from '@/types/agent'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { message, conversation_history = [] } = body as {
    message: string
    conversation_history: Array<{ role: string; content: string }>
  }

  if (!message?.trim()) {
    return Response.json({ error: 'Message is required' }, { status: 400 })
  }

  const context = await loadAgentContext()
  const systemPrompt = buildSystemPrompt(context)

  const openRouterResponse = await fetch(
    `${process.env.OPENROUTER_BASE_URL}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://finova-sigma.vercel.app',
        'X-Title': 'Finova Accounting',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          // Keep last 10 messages for context window efficiency
          ...conversation_history.slice(-10),
          { role: 'user', content: message },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    }
  )

  if (!openRouterResponse.ok) {
    const errText = await openRouterResponse.text()
    console.error('[Agent Parse] OpenRouter error:', errText)
    return Response.json(
      { error: 'AI service unavailable. Please try again.' },
      { status: 502 }
    )
  }

  const aiData = await openRouterResponse.json()
  const rawContent: string = aiData.choices?.[0]?.message?.content ?? ''

  let parsed: ParseResponse
  try {
    const clean = rawContent.replace(/```json|```/g, '').trim()
    const json = JSON.parse(clean)

    parsed = {
      intents: (json.intents ?? []).map((i: ParsedIntent) =>
        resolveIntent(i, context)
      ),
      raw_message: message,
      clarification_needed: json.clarification_needed ?? null,
    }
  } catch (err) {
    console.error('[Agent Parse] Failed to parse AI JSON:', rawContent)
    parsed = {
      intents: [],
      raw_message: message,
      clarification_needed:
        "I had trouble understanding that. Could you try rephrasing?",
    }
  }

  return Response.json(parsed)
}
