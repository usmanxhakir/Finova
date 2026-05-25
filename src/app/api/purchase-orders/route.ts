import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('company_id')
      .eq('id', user.id)
      .limit(1)
      .maybeSingle()

    if (!profile?.company_id) {
      return Response.json({ error: 'Company not found for user' }, { status: 404 })
    }
    const companyId = profile.company_id

    const { data: purchaseOrders, error } = await (supabase.from('purchase_orders') as any)
      .select(`
        id,
        number,
        status,
        created_at,
        total,
        contacts!purchase_orders_contact_id_fkey(name),
        users!purchase_orders_created_by(email)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[API Purchase Orders] fetch error:', error)
      return Response.json({ error: 'Failed to fetch purchase orders' }, { status: 500 })
    }

    return Response.json({ purchaseOrders })
  } catch (error: any) {
    console.error('[API Purchase Orders] error:', error)
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('company_id')
      .eq('id', user.id)
      .limit(1)
      .maybeSingle()

    if (!profile?.company_id) {
      return Response.json({ error: 'Company not found for user' }, { status: 404 })
    }
    const companyId = profile.company_id

    const body = await request.json()
    const {
      contact_id,
      line_items,
      notes,
      issue_date,
      expected_delivery_date,
      reference_number,
      status = 'draft',
    } = body

    if (!['draft', 'pending_approval'].includes(status)) {
      return Response.json({ error: 'Invalid purchase order status' }, { status: 400 })
    }

    // 1. Generate PO Number via RPC
    const { data: poNumber, error: numError } = await (supabase as any)
      .rpc('generate_po_number')

    if (numError || !poNumber) {
      console.error('[API Purchase Orders] number generation error:', numError)
      throw new Error('Failed to generate PO number')
    }

    // 2. Calculate total amount (SUM of line item amounts)
    // All values are already in cents (integer math)
    const totalAmount = line_items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0)

    // 3. Insert Purchase Order
    const { data: purchaseOrder, error: poError } = await (supabase.from('purchase_orders') as any)
      .insert({
        company_id: companyId,
        number: poNumber,
        contact_id,
        notes,
        issue_date,
        expected_delivery_date,
        reference_number,
        status,
        total: totalAmount,
        created_by: user.id
      })
      .select()
      .limit(1)
      .maybeSingle()

    if (poError || !purchaseOrder) {
      console.error('[API Purchase Orders] insert error:', poError)
      throw new Error(poError?.message || 'Failed to create purchase order')
    }

    // 4. Insert Line Items
    const formattedLines = line_items.map((item: any) => ({
      company_id: companyId,
      po_id: purchaseOrder.id,
      item_id: item.item_id || null,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.amount,
      account_id: item.account_id
    }))

    const { error: linesError } = await (supabase.from('po_line_items') as any)
      .insert(formattedLines)

    if (linesError) {
      console.error('[API Purchase Orders] line items insert error:', linesError)
      // Cleanup
      await (supabase.from('purchase_orders') as any).delete().eq('id', purchaseOrder.id)
      throw new Error(`Failed to create line items: ${linesError.message}`)
    }

    return Response.json({ id: purchaseOrder.id })
  } catch (error: any) {
    console.error('[API Purchase Orders] error:', error)
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
