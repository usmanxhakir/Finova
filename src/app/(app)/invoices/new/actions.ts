'use server'

import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/supabase/get-company-id'
import { redirect } from 'next/navigation'
import { createInvoiceJournalEntry } from '@/lib/accounting/journal-engine'

export async function handleSaveInvoice(values: any, isFinalize: boolean, settings: any): Promise<{ success: false; errorCode: string; message?: string } | void> {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    // 1. Insert Invoice
    const { data: invoiceData, error: invoiceError } = await (supabase.from('invoices') as any)
        .insert({
            company_id: companyId,
            number: values.number,
            contact_id: values.contact_id,
            issue_date: values.issue_date,
            due_date: values.due_date,
            notes: values.notes,
            terms: values.terms,
            footer: values.footer,
            status: isFinalize ? 'sent' : 'draft',
            subtotal: Math.round(Number(values.subtotal) * 100),
            tax_amount: Math.round(Number(values.tax_amount) * 100),
            discount_amount: Math.round(Number(values.discount_amount) * 100),
            total: Math.round(Number(values.total) * 100),
            amount_due: Math.round(Number(values.total) * 100),
            amount_paid: 0
        })
        .select()
        .single()

    const invoice = invoiceData as any

    if (invoiceError || !invoice) {
        // Postgres unique-constraint violation code is '23505'
        if (invoiceError?.code === '23505') {
            return { success: false, errorCode: 'DUPLICATE_NUMBER' }
        }
        return { success: false, errorCode: 'UNKNOWN', message: invoiceError?.message || 'Failed to create invoice' }
    }

    // 2. Insert Line Items
    const lineItems = values.line_items.map((item: any) => ({
        company_id: companyId,
        invoice_id: invoice.id,
        item_id: item.item_id || null,
        description: item.description,
        quantity: Number(item.quantity),
        rate: Math.round(Number(item.rate) * 100),
        amount: Math.round(Number(item.amount) * 100),
        account_id: item.account_id,
        tax_rate: Number(item.tax_rate)
    }))

    const { error: linesError } = await (supabase.from('invoice_line_items') as any)
        .insert(lineItems)

    if (linesError) {
        // Cleanup invoice on error
        await (supabase.from('invoices') as any).delete().eq('id', invoice.id)
        throw new Error(`Failed to create line items: ${linesError.message}`)
    }

    // 3. Update next number in settings (now in companies table)
    if (settings?.id) {
        await (supabase.from('companies') as any)
            .update({ invoice_next_number: (settings.invoice_next_number || 1) + 1 })
            .eq('id', settings.id)
    }

    // 4. Create Journal Entry if Finalized
    if (isFinalize) {
        try {
            await createInvoiceJournalEntry(supabase, invoice.id, companyId)
        } catch (err: any) {
            console.error('Journal entry creation failed:', err)
            // We keep the invoice but report the error
        }
    }

    redirect('/invoices')
}
