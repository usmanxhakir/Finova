import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/supabase/get-company-id'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const companyId = await getCompanyId()

    const { data: purchaseOrder, error } = await (supabase.from('purchase_orders') as any)
      .select(`
        *,
        contacts!purchase_orders_contact_id_fkey(name),
        po_line_items(*)
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle()

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

    const companyId = await getCompanyId()

    // 1. Check current status
    const { data: currentPO } = await (supabase.from('purchase_orders') as any)
      .select('status, company_id')
      .eq('id', id)
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle()

    if (!currentPO) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (currentPO.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft purchase orders can be edited' }, { status: 400 })
    }

    const body = await request.json()
    const { contact_id, notes, expected_date, reference_number, status, line_items } = body

    // Calculate total if line items are provided
    let total_amount = undefined
    if (line_items) {
      total_amount = line_items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0)
    }

    // 2. Update Purchase Order
    const updateData: any = {}
    if (contact_id !== undefined) updateData.contact_id = contact_id
    if (notes !== undefined) updateData.notes = notes
    if (expected_date !== undefined) updateData.expected_date = expected_date
    if (reference_number !== undefined) updateData.reference_number = reference_number
    if (status !== undefined) updateData.status = status
    if (total_amount !== undefined) updateData.total_amount = total_amount

    const { error: poError } = await (supabase.from('purchase_orders') as any)
      .update(updateData)
      .eq('id', id)
      .eq('company_id', companyId)

    if (poError) {
      throw new Error(`Failed to update purchase order: ${poError.message}`)
    }

    // 3. Update Line Items if provided
    if (line_items) {
      // Delete existing
      const { error: deleteError } = await (supabase.from('po_line_items') as any)
        .delete()
        .eq('po_id', id)
        .eq('company_id', companyId)

      if (deleteError) throw new Error(`Failed to update line items (delete): ${deleteError.message}`)

      // Insert new
      const formattedLines = line_items.map((item: any) => ({
        company_id: companyId,
        po_id: id,
        item_id: item.item_id || null,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
        account_id: item.account_id
      }))

      const { error: linesError } = await (supabase.from('po_line_items') as any)
        .insert(formattedLines)

      if (linesError) throw new Error(`Failed to update line items (insert): ${linesError.message}`)
    }

    // 4. Return full object
    const { data: updatedPO } = await (supabase.from('purchase_orders') as any)
      .select(`
        *,
        contacts!purchase_orders_contact_id_fkey(name),
        po_line_items(*)
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle()

    return NextResponse.json(updatedPO)
  } catch (error: any) {
    console.error('[API PO PATCH] error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
