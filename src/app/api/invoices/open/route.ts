import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database.types'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type ContactRow = Database['public']['Tables']['contacts']['Row']

// We add 'balance' to the type definition because it may not yet be in the generated types
type InvoiceWithContact = InvoiceRow & {
  balance: number
  contacts: Pick<ContactRow, 'name'> | null
}

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
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
    .returns<InvoiceWithContact[]>()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const formattedInvoices = (data || []).map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    total: invoice.total,
    balance: invoice.balance,
    contact_id: invoice.contact_id,
    contact_name: invoice.contacts?.name || '',
  }))

  return Response.json(formattedInvoices)
}
