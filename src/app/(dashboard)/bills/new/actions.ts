'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createBillJournalEntry } from '@/lib/accounting/journal-engine'

export async function handleSaveBill(values: any, isFinalize: boolean, settings: any) {
    const supabase = await createClient()

    // 1. Insert Bill
    const { data: billData, error: billError } = await (supabase.from('bills') as any)
        .insert({
            number: values.number,
            contact_id: values.contact_id,
            reference_number: values.reference_number,
            issue_date: values.issue_date,
            due_date: values.due_date,
            notes: values.notes,
            status: isFinalize ? 'received' : 'draft',
            subtotal: Math.round(Number(values.subtotal) * 100),
            tax_amount: Math.round(Number(values.tax_amount) * 100),
            discount_amount: Math.round(Number(values.discount_amount) * 100),
            total: Math.round(Number(values.total) * 100),
            amount_due: Math.round(Number(values.total) * 100),
            amount_paid: 0
        })
        .select()
        .single()

    const bill = billData as any

    if (billError || !bill) {
    if (billError?.code === '23505') {
        throw new Error('DUPLICATE_NUMBER')
    }
    throw new Error(`Failed to create bill: ${billError?.message}`)
}

    // 2. Insert Line Items
    const lineItems = values.line_items.map((item: any) => ({
        bill_id: bill.id,
        item_id: item.item_id || null,
        description: item.description,
        quantity: Number(item.quantity),
        rate: Math.round(Number(item.rate) * 100),
        amount: Math.round(Number(item.amount) * 100),
        account_id: item.account_id,
        tax_rate: Number(item.tax_rate)
    }))

    const { error: linesError } = await (supabase.from('bill_line_items') as any)
        .insert(lineItems)

    if (linesError) {
        // Cleanup bill on error
        await (supabase.from('bills') as any).delete().eq('id', bill.id)
        throw new Error(`Failed to create line items: ${linesError.message}`)
    }

    // 3. Update next number in settings
    if (settings?.id) {
        await (supabase.from('company_settings') as any)
            .update({ bill_next_number: (settings.bill_next_number || 1) + 1 })
            .eq('id', settings.id)
    }

    // 4. Create Journal Entry if Finalized
    if (isFinalize) {
        try {
            await createBillJournalEntry(supabase, bill.id)
        } catch (err: any) {
            console.error('Journal entry creation failed:', err)
            // We keep the bill but report the error
        }
    }

    redirect('/bills')
}
