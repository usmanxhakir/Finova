import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

const VARIANT_TO_PLAN: Record<string, string> = {
  '1679534': 'pro',
  '1679543': 'pro',
  '1679596': 'studio',
  '1679679': 'studio',
}

function verifySignature(payload: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', process.env.LS_SIGNING_SECRET!)
  const digest = hmac.update(payload).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-signature') ?? ''

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  const eventName = payload.meta?.event_name

  if (eventName !== 'subscription_created') {
    return NextResponse.json({ received: true })
  }

  const attrs = payload.data?.attributes
  const email = attrs?.user_email
  const variantId = String(attrs?.variant_id ?? '')
  const plan = VARIANT_TO_PLAN[variantId] ?? 'pro'
  const lsSubscriptionId = String(payload.data?.id ?? '')

  if (!email) {
    return NextResponse.json({ error: 'No email' }, { status: 400 })
  }

  const admin = createAdminClient()
  await admin.from('pending_registrations').insert({
    email: email.toLowerCase(),
    plan,
    ls_variant_id: variantId,
    ls_order_id: lsSubscriptionId,
    status: 'pending',
  })

  return NextResponse.json({ received: true })
}