/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getCompanyId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile, error } = await (supabase.from('profiles') as any)
    .select('company_id')
    .eq('id', userId)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile?.company_id) throw new Error('Company not found for user')

  return profile.company_id as string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const companyId = await getCompanyId(supabase, user.id)

    // Fetch PO
    const { data: purchaseOrder, error: poError } = await (supabase.from('purchase_orders') as any)
      .select('id, status')
      .eq('id', id)
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle()

    if (poError) throw new Error(poError.message)
    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (purchaseOrder.status === 'converted') {
      return NextResponse.json(
        { error: 'Cannot void a purchase order that has already been converted to a bill.' },
        { status: 400 }
      )
    }

    if (purchaseOrder.status === 'void') {
      return NextResponse.json(
        { error: 'This purchase order is already voided.' },
        { status: 400 }
      )
    }

    // Parse optional reason from request body
    const body = await request.json().catch(() => ({}))
    const reason = typeof body.reason === 'string' ? body.reason.trim() || null : null

    // Void the PO
    const { error: updateError } = await (supabase.from('purchase_orders') as any)
      .update({
        status: 'void',
        voided_at: new Date().toISOString(),
        voided_by: user.id,
        void_reason: reason,
      })
      .eq('id', id)
      .eq('company_id', companyId)

    if (updateError) throw new Error(updateError.message)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API PO Void] error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
