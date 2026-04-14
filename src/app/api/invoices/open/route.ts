import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const supabase = await createClient()
        
        const { data: invoices, error } = await supabase
            .from('invoices')
            .select(`
                id,
                number,
                issue_date,
                due_date,
                total,
                amount_due,
                contact_id,
                contacts (
                    name
                )
            `)
            .in('status', ['sent', 'partially_paid'])
            .gt('amount_due', 0)
            .order('due_date', { ascending: true })

        if (error) throw error

        const formattedInvoices = invoices?.map(invoice => ({
            id: invoice.id,
            number: invoice.number,
            issue_date: invoice.issue_date,
            due_date: invoice.due_date,
            total: invoice.total,
            balance: invoice.amount_due,
            contact_id: invoice.contact_id,
            contact_name: (invoice.contacts as any)?.name
        }))

        return NextResponse.json(formattedInvoices)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
