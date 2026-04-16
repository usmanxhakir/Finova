import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database.types'
import { NextRequest } from 'next/server'

type BillRow = Database['public']['Tables']['bills']['Row']
type ContactRow = Database['public']['Tables']['contacts']['Row']

// We add 'balance' to the type definition because it may not yet be in the generated types
type BillWithContact = BillRow & {
  amount_due: number
  contacts: Pick<ContactRow, 'name'> | null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get('contactId')

  let query = supabase
    .from('bills')
    .select(`
      id,
      number,
      issue_date,
      due_date,
      total,
      amount_due,
      contact_id,
      contacts ( name )
    `)
    .in('status', ['received', 'partially_paid', 'overdue'])
    .gt('amount_due', 0)
    .order('due_date', { ascending: true })

  if (contactId && contactId !== 'undefined' && contactId !== 'null') {
    query = query.eq('contact_id', contactId)
  }

  const { data, error } = await query.returns<BillWithContact[]>()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const formattedBills = (data || []).map((bill) => ({
    id: bill.id,
    number: bill.number,
    issue_date: bill.issue_date,
    due_date: bill.due_date,
    total: bill.total,
    balance: bill.amount_due,
    contact_id: bill.contact_id,
    contact_name: bill.contacts?.name || '',
  }))

  return Response.json(formattedBills)
}
