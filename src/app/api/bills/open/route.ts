import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const supabase = await createClient()
        
        const { data: bills, error } = await supabase
            .from('bills')
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
            .in('status', ['received', 'partially_paid'])
            .gt('amount_due', 0)
            .order('due_date', { ascending: true })

        if (error) throw error

        // Transform to match required return fields
        const formattedBills = bills?.map(bill => ({
            id: bill.id,
            number: bill.number,
            issue_date: bill.issue_date,
            due_date: bill.due_date,
            total: bill.total,
            balance: bill.amount_due, // user specified 'balance' in prompt, DB uses 'amount_due'
            contact_id: bill.contact_id,
            contact_name: (bill.contacts as any)?.name
        }))

        return NextResponse.json(formattedBills)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
