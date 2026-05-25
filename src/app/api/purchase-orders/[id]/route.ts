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

async function fetchPurchaseOrder(supabase: Awaited<ReturnType<typeof createClient>>, id: string, companyId: string) {
  return (supabase.from('purchase_orders') as any)
    .select(`
      *,
      contacts!purchase_orders_contact_id_fkey(name),
      po_line_items(*)
    `)
    .eq('id', id)
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle()
}

function assertIntegerCents(lineItems: any[]) {
  for (const item of lineItems) {
    if (!Number.isInteger(item.rate) || !Number.isInteger(item.amount)) {
      throw new Error('Line item rate and amount must be integer cents')
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const companyId = await getCompanyId(supabase, user.id)
    const { data: purchaseOrder, error } = await fetchPurchaseOrder(supabase, id, companyId)

    if (error) {
      console.error('[API PO GET] error:', error)
      return NextResponse.json({ error: 'Failed to fetch purchase order' }, { status: 500 })
    }

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    return NextResponse.json(purchaseOrder)
  } catch (error: any) {
    console.error('[API PO GET] error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const companyId = await getCompanyId(supabase, user.id)
    const { data: currentPO, error: currentError } = await (supabase.from('purchase_orders') as any)
      .select('id, status')
      .eq('id', id)
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle()

    if (currentError) throw new Error(currentError.message)
    if (!currentPO) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }
    if (currentPO.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft purchase orders can be edited' }, { status: 400 })
    }

    const body = await request.json()
    const {
      contact_id,
      notes,
      expected_delivery_date,
      issue_date,
      reference_number,
      status,
      line_items,
    } = body

    let total: number | undefined
    if (Array.isArray(line_items)) {
      assertIntegerCents(line_items)
      total = line_items.reduce((sum: number, item: any) => sum + item.amount, 0)
    }

    const updateData: Record<string, any> = {}
    if (contact_id !== undefined) updateData.contact_id = contact_id
    if (notes !== undefined) updateData.notes = notes
    if (expected_delivery_date !== undefined) updateData.expected_delivery_date = expected_delivery_date
    if (issue_date !== undefined) updateData.issue_date = issue_date
    if (reference_number !== undefined) updateData.reference_number = reference_number
    if (status !== undefined) updateData.status = status
    if (total !== undefined) {
      updateData.subtotal = total
      updateData.total = total
    }

    const { error: updateError } = await (supabase.from('purchase_orders') as any)
      .update(updateData)
      .eq('id', id)
      .eq('company_id', companyId)

    if (updateError) throw new Error(`Failed to update purchase order: ${updateError.message}`)

    if (Array.isArray(line_items)) {
      const { error: deleteError } = await (supabase.from('po_line_items') as any)
        .delete()
        .eq('po_id', id)
        .eq('company_id', companyId)

      if (deleteError) throw new Error(`Failed to update line items: ${deleteError.message}`)

      if (line_items.length > 0) {
        const formattedLines = line_items.map((item: any) => ({
          company_id: companyId,
          po_id: id,
          item_id: item.item_id || null,
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          account_id: item.account_id || null,
        }))

        const { error: lineError } = await (supabase.from('po_line_items') as any)
          .insert(formattedLines)

        if (lineError) throw new Error(`Failed to update line items: ${lineError.message}`)
      }
    }

    const { data: updatedPO, error: fetchError } = await fetchPurchaseOrder(supabase, id, companyId)
    if (fetchError) throw new Error(fetchError.message)

    return NextResponse.json(updatedPO)
  } catch (error: any) {
    console.error('[API PO PATCH] error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
