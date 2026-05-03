export const runtime = 'edge'

import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt } from '@/lib/agent/context-loader'
import { loadAgentContext } from '@/lib/agent/context-loader'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { message: string }
  const { message } = body

  if (!message?.trim()) {
    return Response.json({ error: 'Message is required' }, { status: 400 })
  }

  const context = await loadAgentContext()
  const systemPrompt = buildSystemPrompt(context)

  const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    }),
  })

  if (!groqResponse.ok) {
    const errText = await groqResponse.text()
    console.error('[Agent Parse] Groq error:', errText)
    return Response.json({ error: 'AI service unavailable. Please try again.' }, { status: 502 })
  }

  const aiData = await groqResponse.json() as {
    choices: Array<{ message: { content: string } }>
  }
  const rawContent: string = aiData.choices?.[0]?.message?.content ?? ''

  try {
    const clean = rawContent.replace(/```json|```/g, '').trim()
    const json = JSON.parse(clean) as {
      entries?: unknown[]
      clarification_needed?: string | null
    }
    return Response.json({
      entries: json.entries ?? [],
      clarification_needed: json.clarification_needed ?? null,
    })
  } catch {
    console.error('[Agent Parse] Failed to parse AI JSON:', rawContent)
    return Response.json({
      entries: [],
      clarification_needed: "I had trouble understanding that. Could you rephrase?",
    })
  }
}
