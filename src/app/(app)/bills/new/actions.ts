'use server'

import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/supabase/get-company-id'
import { redirect } from 'next/navigation'
import { createBillJournalEntry } from '@/lib/accounting/journal-engine'

export async function handleSaveBill(values: any, isFinalize: boolean, settings: any): Promise<{ success: false, errorCode: string, message?: string } | void> {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    // 1. Insert Bill
    const { data: billData, error: billError } = await (supabase.from('bills') as any)
        .insert({
            company_id: companyId,
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
        // Postgres unique-constraint violation code is '23505'
        if (billError?.code === '23505') {
            return { success: false, errorCode: 'DUPLICATE_NUMBER' }
        }
        return { success: false, errorCode: 'UNKNOWN', message: billError?.message || 'Failed to create bill' }
    }

    // 2. Insert Line Items
    const lineItems = values.line_items.map((item: any) => ({
        company_id: companyId,
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

    // 3. Update next number in settings (now in companies table)
    if (settings?.id) {
        await (supabase.from('companies') as any)
            .update({ bill_next_number: (settings.bill_next_number || 1) + 1 })
            .eq('id', settings.id)
    }

    // 4. Create Journal Entry if Finalized
    if (isFinalize) {
        try {
            await createBillJournalEntry(supabase, bill.id, companyId)
        } catch (err: any) {
            console.error('Journal entry creation failed:', err)
            // We keep the bill but report the error
        }
    }

    redirect('/bills')
}
