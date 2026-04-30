'use server'

import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/supabase/get-company-id'
import { redirect } from 'next/navigation'
import { createInvoiceJournalEntry } from '@/lib/accounting/journal-engine'

export async function handleSaveInvoice(values: any, isFinalize: boolean, settings: any): Promise<{ success: false; errorCode: string; message?: string } | void> {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    try {
        // 1. Generate Invoice Number via RPC
        const { data: invoiceNumber, error: numError } = await (supabase as any)
            .rpc('generate_invoice_number')

        if (numError || !invoiceNumber) {
            console.error('[create-invoice] number generation error:', numError)
            throw new Error('Failed to generate invoice number')
        }
        let { data: invoiceData, error: invoiceError } = await (supabase.from('invoices') as any)
            .insert({
                company_id: companyId,
                number: invoiceNumber,
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
            console.error('[create-invoice] invoice insert error:', invoiceError)
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
            console.error('[create-invoice] line items insert error:', linesError)
            // Cleanup invoice on error
            await (supabase.from('invoices') as any).delete().eq('id', invoice.id)
            return { success: false, errorCode: 'LINE_ITEMS_FAILED', message: `Failed to create line items: ${linesError.message}` }
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
                console.error('[create-invoice] journal entry creation failed:', err)
                // We keep the invoice but log the error
            }
        }
    } catch (error) {
        console.error('[create-invoice] error:', error)
        return { success: false, errorCode: 'UNKNOWN', message: error instanceof Error ? error.message : String(error) }
    }

    // redirect() must be called OUTSIDE try/catch — it throws NEXT_REDIRECT internally
    redirect('/invoices')
}
