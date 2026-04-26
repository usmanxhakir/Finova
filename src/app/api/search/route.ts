import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!q || q.length < 2) {
        return NextResponse.json({
            invoices: [],
            bills: [],
            expenses: [],
            contacts: [],
            items: [],
        })
    }

    try {
        const [invoicesRes, billsRes, expensesRes, contactsRes, itemsRes] = await Promise.all([
            // Invoices
            supabase
                .from('invoices')
                .select('id, number, total, status, notes, contact_id, contacts(name)')
                .or(`number.ilike.%${q}%,notes.ilike.%${q}%`)
                .neq('status', 'void')
                .limit(5),

            // Bills
            supabase
                .from('bills')
                .select('id, number, total, status, reference_number, notes, contact_id, contacts(name)')
                .or(`number.ilike.%${q}%,reference_number.ilike.%${q}%,notes.ilike.%${q}%`)
                .neq('status', 'void')
                .limit(5),

            // Expenses
            supabase
                .from('expenses')
                .select('id, description, payee, amount')
                .or(`description.ilike.%${q}%,payee.ilike.%${q}%`)
                .limit(5),

            // Contacts
            supabase
                .from('contacts')
                .select('id, name, type, email')
                .eq('is_active', true)
                .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
                .limit(5),

            // Items
            supabase
                .from('items')
                .select('id, name, type, default_rate')
                .eq('is_active', true)
                .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
                .limit(5),
        ])

        const invoices = (invoicesRes.data || []).map((inv: any) => ({
            ...inv,
            contact_name: inv.contacts?.name ?? 'Unknown',
            total: (inv.total || 0) / 100,
            contacts: undefined,
        }))

        const bills = (billsRes.data || []).map((bill: any) => ({
            ...bill,
            contact_name: bill.contacts?.name ?? 'Unknown',
            total: (bill.total || 0) / 100,
            contacts: undefined,
        }))

        const expenses = (expensesRes.data || []).map((exp: any) => ({
            ...exp,
            amount: (exp.amount || 0) / 100,
        }))

        const contacts = contactsRes.data || []
        
        const items = (itemsRes.data || []).map((item: any) => ({
            ...item,
            default_rate: (item.default_rate || 0) / 100,
        }))

        return NextResponse.json({
            invoices,
            bills,
            expenses,
            contacts,
            items,
        })
    } catch (error) {
        console.error('Search API Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
