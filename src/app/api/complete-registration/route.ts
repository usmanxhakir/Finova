import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const { registrationId, companyId } = await request.json()
  if (!registrationId || !companyId) return NextResponse.json({ ok: false })

  const admin = createAdminClient()

  // Get the pending registration for plan + ls details
  const { data: reg } = await admin
    .from('pending_registrations')
    .select('plan, ls_variant_id, ls_order_id')
    .eq('id', registrationId)
    .single()

  if (!reg) return NextResponse.json({ ok: false })

  // Mark as used
  await admin
    .from('pending_registrations')
    .update({ status: 'used' })
    .eq('id', registrationId)

  // Create subscription row
  await admin.from('subscriptions').insert({
    company_id: companyId,
    plan: reg.plan,
    status: 'active',
    ls_subscription_id: reg.ls_order_id,
    ls_variant_id: reg.ls_variant_id,
  })

  return NextResponse.json({ ok: true })
}