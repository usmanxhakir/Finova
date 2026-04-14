import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database.types'

type BillRow = Database['public']['Tables']['bills']['Row']
type ContactRow = Database['public']['Tables']['contacts']['Row']

// We add 'balance' to the type definition because it may not yet be in the generated types
type BillWithContact = BillRow & {
  balance: number
  contacts: Pick<ContactRow, 'name'> | null
}

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bills')
    .select(`
      id,
      number,
      issue_date,
      due_date,
      total,
      balance,
      contact_id,
      contacts ( name )
    `)
    .neq('status', 'draft')
    .neq('status', 'paid')
    .neq('status', 'void')
    .gt('balance', 0)
    .order('due_date', { ascending: true })
    .returns<BillWithContact[]>()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const formattedBills = (data || []).map((bill) => ({
    id: bill.id,
    number: bill.number,
    issue_date: bill.issue_date,
    due_date: bill.due_date,
    total: bill.total,
    balance: bill.balance,
    contact_id: bill.contact_id,
    contact_name: bill.contacts?.name || '',
  }))

  return Response.json(formattedBills)
}
