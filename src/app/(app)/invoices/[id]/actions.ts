'use server'

import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/supabase/get-company-id'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createInvoiceJournalEntry, voidInvoiceJournalEntries, createPaymentJournalEntry } from '@/lib/accounting/journal-engine'
import { sendInvoiceEmail } from '@/lib/email/send-invoice'

export async function handleSendInvoice(id: string, to: string, subject: string, personalMessage?: string) {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    // 1. Fetch data
    const { data: invoice } = await (supabase.from('invoices') as any)
        .select('*, contacts(*), invoice_line_items(*)')
        .eq('id', id)
        .single()

    const { data: settings } = await (supabase.from('companies') as any)
        .select('*')
        .eq('id', companyId)
        .single()

    if (!invoice || !settings) throw new Error('Invoice or settings not found')

    // 2. Send Email
    await sendInvoiceEmail({
        invoice,
        settings,
        to,
        subject,
        personalMessage
    })

    // 3. Update Database
    const updateData: any = { sent_at: new Date().toISOString() }
    if (invoice.status === 'draft') {
        updateData.status = 'sent'
        // If it was draft, we also need to create journal entry as it's now "finalized" by sending
        await createInvoiceJournalEntry(supabase, id, companyId)
    }

    const { error: updateError } = await (supabase.from('invoices') as any)
        .update(updateData)
        .eq('id', id)

    if (updateError) throw new Error(`Failed to update invoice sent status: ${updateError.message}`)

    revalidatePath(`/invoices/${id}`)
    revalidatePath('/invoices')
}

export async function handleUpdateInvoice(id: string, values: any, isFinalize: boolean, currentStatus: string, currentAmountDue: number) {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    // 1. Update Invoice
    const { error: invoiceUpdateError } = await (supabase.from('invoices') as any)
        .update({
            number: values.number,
            contact_id: values.contact_id,
            issue_date: values.issue_date,
            due_date: values.due_date,
            notes: values.notes,
            terms: values.terms,
            footer: values.footer,
            status: isFinalize ? 'sent' : values.status,
            subtotal: Math.round(Number(values.subtotal) * 100),
            tax_amount: Math.round(Number(values.tax_amount) * 100),
            discount_amount: Math.round(Number(values.discount_amount) * 100),
            total: Math.round(Number(values.total) * 100),
            amount_due: isFinalize ? Math.round(Number(values.total) * 100) : Number(currentAmountDue),
        })
        .eq('id', id)

    if (invoiceUpdateError) throw new Error(`Failed to update invoice: ${invoiceUpdateError.message}`)

    // 2. Clear and recreate line items
    await (supabase.from('invoice_line_items') as any).delete().eq('invoice_id', id)

    const lineItems = values.line_items.map((item: any) => ({
        company_id: companyId,
        invoice_id: id,
        item_id: item.item_id || null,
        description: item.description,
        quantity: Number(item.quantity),
        rate: Math.round(Number(item.rate) * 100),
        amount: Math.round(Number(item.amount) * 100),
        account_id: item.account_id,
        tax_rate: Number(item.tax_rate)
    }))

    const { error: linesError } = await (supabase.from('invoice_line_items') as any).insert(lineItems)
    if (linesError) throw new Error(`Failed to update line items: ${linesError.message}`)

    // 3. Create Journal Entry if Finalized
    if (isFinalize && currentStatus !== 'sent') {
        await createInvoiceJournalEntry(supabase, id, companyId)
    }

    revalidatePath(`/invoices/${id}`)
    revalidatePath('/invoices')
}

export async function handleVoidInvoice(id: string) {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    const { error: voidError } = await (supabase.from('invoices') as any)
        .update({ status: 'void' })
        .eq('id', id)

    if (voidError) throw new Error(`Failed to void invoice: ${voidError.message}`)

    await voidInvoiceJournalEntries(supabase, id, companyId)

    revalidatePath(`/invoices/${id}`)
    revalidatePath('/invoices')
    redirect('/invoices')
}

export async function handleRecordInvoicePayment(id: string, values: any, contactId: string) {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    // Step 0: Fetch current invoice state FIRST (all values in cents/integers)
    const { data: invoice, error: fetchError } = await (supabase.from('invoices') as any)
        .select('total, amount_paid')
        .eq('id', id)
        .single()

    if (fetchError || !invoice) throw new Error('Invoice not found')

    // Step 1: Insert payment (convert user-entered dollars → cents with Math.round)
    const paymentAmountInCents = Math.round(Number(values.amount) * 100)

    const { data: paymentData, error: paymentError } = await (supabase.from('payments') as any)
        .insert({
            company_id: companyId,
            type: 'invoice_payment',
            contact_id: contactId,
            account_id: values.account_id,
            date: values.date,
            amount: paymentAmountInCents,
            reference: values.reference || null,
            notes: values.notes || null,
        })
        .select()
        .single()

    if (paymentError || !paymentData) throw new Error(`Failed to record payment: ${paymentError?.message}`)

    const payment = paymentData as any

    // Step 2: Create Allocation
    const { error: allocError } = await (supabase.from('payment_allocations') as any).insert({
        company_id: companyId,
        payment_id: payment.id,
        invoice_id: id,
        amount_applied: paymentAmountInCents,
    })

    if (allocError) {
        await (supabase.from('payments') as any).delete().eq('id', payment.id)
        throw new Error(`Failed to allocate payment: ${allocError.message}`)
    }

    // Step 3: Calculate new values (all integers — no floating point)
    const newAmountPaid = Number(invoice.amount_paid) + paymentAmountInCents
    const newAmountDue = Number(invoice.total) - newAmountPaid
    const newStatus = newAmountDue <= 0
        ? 'paid'
        : newAmountPaid > 0
            ? 'partially_paid'
            : 'sent'

    // Step 4: Update the invoice
    const { error: upError } = await (supabase.from('invoices') as any)
        .update({
            amount_paid: newAmountPaid,
            amount_due: Math.max(0, newAmountDue),
            status: newStatus,
        })
        .eq('id', id)

    if (upError) throw new Error(`Failed to update invoice: ${upError.message}`)

    // Step 5: Create Journal Entry
    await createPaymentJournalEntry(supabase, payment.id, companyId)

    // Step 6: Revalidate page cache
    revalidatePath('/invoices')
    revalidatePath(`/invoices/${id}`)
}
