'use server'

import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/supabase/get-company-id'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createBillJournalEntry, voidBillJournalEntries, createBillPaymentJournalEntry, replaceBillJournalEntry, replacePaymentJournalEntry, voidPaymentJournalEntry } from '@/lib/accounting/journal-engine'

export async function handleUpdateBill(id: string, values: any, isFinalize: boolean, currentStatus: string, currentAmountPaid: number) {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    if (currentStatus === 'void') {
        throw new Error('Cannot edit a voided bill.')
    }

    const totalInCents = Math.round(Number(values.total) * 100)
    if ((currentStatus === 'paid' || currentStatus === 'partially_paid') && totalInCents < currentAmountPaid) {
        throw new Error(`The bill total cannot be less than the amount already paid ($${(currentAmountPaid / 100).toFixed(2)}).`)
    }

    const newAmountDue = isFinalize ? Math.max(0, totalInCents - currentAmountPaid) : totalInCents

    let newStatus = values.status
    if (isFinalize) {
        if (currentStatus === 'draft') {
            newStatus = 'received'
        } else if (currentStatus === 'paid' || currentStatus === 'partially_paid' || currentStatus === 'received' || currentStatus === 'overdue') {
            newStatus = newAmountDue <= 0 ? 'paid' : (currentAmountPaid > 0 ? 'partially_paid' : currentStatus)
        }
    }

    // 1. Update Bill
    const { error: billUpdateError } = await (supabase.from('bills') as any)
        .update({
            number: values.number,
            contact_id: values.contact_id,
            reference_number: values.reference_number,
            issue_date: values.issue_date,
            due_date: values.due_date,
            notes: values.notes,
            status: newStatus,
            subtotal: Math.round(Number(values.subtotal) * 100),
            tax_amount: Math.round(Number(values.tax_amount) * 100),
            discount_amount: Math.round(Number(values.discount_amount) * 100),
            total: totalInCents,
            amount_due: newAmountDue,
        })
        .eq('id', id)

    if (billUpdateError) throw new Error(`Failed to update bill: ${billUpdateError.message}`)

    // 2. Clear and recreate line items
    await (supabase.from('bill_line_items') as any).delete().eq('bill_id', id)

    const lineItems = values.line_items.map((item: any) => ({
        company_id: companyId,
        bill_id: id,
        item_id: item.item_id || null,
        description: item.description,
        quantity: Number(item.quantity),
        rate: Math.round(Number(item.rate) * 100),
        amount: Math.round(Number(item.amount) * 100),
        account_id: item.account_id,
        tax_rate: Number(item.tax_rate)
    }))

    const { error: linesError } = await (supabase.from('bill_line_items') as any).insert(lineItems)
    if (linesError) throw new Error(`Failed to update line items: ${linesError.message}`)

    // 3. Create or Replace Journal Entry if Finalized
    if (isFinalize) {
        if (currentStatus === 'draft') {
            await createBillJournalEntry(supabase, id, companyId)
        } else {
            await replaceBillJournalEntry(supabase, id, companyId)
        }
    }

    revalidatePath(`/bills/${id}`)
    revalidatePath('/bills')
}

export async function handleVoidBill(id: string) {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    const { error: voidError } = await (supabase.from('bills') as any)
        .update({ status: 'void' })
        .eq('id', id)

    if (voidError) throw new Error(`Failed to void bill: ${voidError.message}`)

    await voidBillJournalEntries(supabase, id, companyId)

    revalidatePath(`/bills/${id}`)
    revalidatePath('/bills')
    redirect('/bills')
}

export async function handleRecordBillPayment(id: string, values: any, contactId: string) {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    // Step 0: Fetch current bill state FIRST (all values in cents/integers)
    const { data: bill, error: fetchError } = await (supabase.from('bills') as any)
        .select('total, amount_paid')
        .eq('id', id)
        .single()

    if (fetchError || !bill) throw new Error('Bill not found')

    // Step 1: Insert payment (convert user-entered dollars → cents with Math.round)
    const paymentAmountInCents = Math.round(Number(values.amount) * 100)

    const { data: paymentData, error: paymentError } = await (supabase.from('payments') as any)
        .insert({
            company_id: companyId,
            type: 'bill_payment',
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
        bill_id: id,
        amount_applied: paymentAmountInCents,
    })

    if (allocError) {
        await (supabase.from('payments') as any).delete().eq('id', payment.id)
        throw new Error(`Failed to allocate payment: ${allocError.message}`)
    }

    // Step 3: Calculate new values (all integers — no floating point)
    const newAmountPaid = Number(bill.amount_paid) + paymentAmountInCents
    const newAmountDue = Number(bill.total) - newAmountPaid
    const newStatus = newAmountDue <= 0
        ? 'paid'
        : newAmountPaid > 0
            ? 'partially_paid'
            : 'received'

    // Step 4: Update the bill
    const { error: upError } = await (supabase.from('bills') as any)
        .update({
            amount_paid: newAmountPaid,
            amount_due: Math.max(0, newAmountDue),
            status: newStatus,
        })
        .eq('id', id)

    if (upError) throw new Error(`Failed to update bill: ${upError.message}`)

    // Step 5: Create Journal Entry
    await createBillPaymentJournalEntry(supabase, payment.id, companyId)

    // Step 6: Revalidate page cache
    revalidatePath('/bills')
    revalidatePath(`/bills/${id}`)
}

export async function handleEditBillPayment(paymentId: string, billId: string, values: any) {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    // 1. Fetch current payment and bill
    const { data: currentPayment, error: paymentError } = await (supabase.from('payments') as any)
        .select('*')
        .eq('id', paymentId)
        .single()
    if (paymentError || !currentPayment) throw new Error('Payment not found')

    const { data: bill, error: billError } = await (supabase.from('bills') as any)
        .select('total, amount_paid, status')
        .eq('id', billId)
        .single()
    if (billError || !bill) throw new Error('Bill not found')

    // 2. Calculate differences
    const oldAmountInCents = Number(currentPayment.amount)
    const newAmountInCents = Math.round(Number(values.amount) * 100)
    const amountDifference = newAmountInCents - oldAmountInCents

    // 3. Update Payments table
    const { error: updateError } = await (supabase.from('payments') as any)
        .update({
            date: values.date,
            amount: newAmountInCents,
            account_id: values.account_id,
            reference: values.reference || null,
            notes: values.notes || null,
        })
        .eq('id', paymentId)
    if (updateError) throw new Error(`Failed to update payment: ${updateError.message}`)

    // 4. Update Allocations table
    const { error: allocError } = await (supabase.from('payment_allocations') as any)
        .update({ amount_applied: newAmountInCents })
        .eq('payment_id', paymentId)
        .eq('bill_id', billId)
    if (allocError) throw new Error(`Failed to update payment allocation: ${allocError.message}`)

    // 5. Recalculate Bill totals
    const newAmountPaid = Number(bill.amount_paid) + amountDifference
    const newAmountDue = Math.max(0, Number(bill.total) - newAmountPaid)
    let newStatus = bill.status
    if (bill.status !== 'void') {
        newStatus = newAmountDue <= 0 ? 'paid' : (newAmountPaid > 0 ? 'partially_paid' : 'received')
    }

    const { error: billUpError } = await (supabase.from('bills') as any)
        .update({
            amount_paid: newAmountPaid,
            amount_due: newAmountDue,
            status: newStatus
        })
        .eq('id', billId)
    if (billUpError) throw new Error(`Failed to update bill totals: ${billUpError.message}`)

    // 6. Replace Journal Entry
    await replacePaymentJournalEntry(supabase, paymentId, companyId, 'bill_payment')

    revalidatePath('/bills')
    revalidatePath(`/bills/${billId}`)
}

export async function handleDeleteBillPayment(paymentId: string, billId: string) {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    // 1. Fetch current payment and bill
    const { data: currentPayment, error: paymentError } = await (supabase.from('payments') as any)
        .select('*')
        .eq('id', paymentId)
        .single()
    if (paymentError || !currentPayment) throw new Error('Payment not found')

    const { data: bill, error: billError } = await (supabase.from('bills') as any)
        .select('total, amount_paid, status')
        .eq('id', billId)
        .single()
    if (billError || !bill) throw new Error('Bill not found')

    const paymentAmount = Number(currentPayment.amount)

    // 2. Void Journal Entry first
    await voidPaymentJournalEntry(supabase, paymentId, companyId)

    // 3. Delete from Payments table (allocations cascade)
    const { error: delError } = await (supabase.from('payments') as any)
        .delete()
        .eq('id', paymentId)
    if (delError) throw new Error(`Failed to delete payment: ${delError.message}`)

    // 4. Recalculate Bill totals
    const newAmountPaid = Math.max(0, Number(bill.amount_paid) - paymentAmount)
    const newAmountDue = Math.max(0, Number(bill.total) - newAmountPaid)
    let newStatus = bill.status
    if (bill.status !== 'void') {
        newStatus = newAmountDue <= 0 ? 'paid' : (newAmountPaid > 0 ? 'partially_paid' : 'received')
    }

    const { error: billUpError } = await (supabase.from('bills') as any)
        .update({
            amount_paid: newAmountPaid,
            amount_due: newAmountDue,
            status: newStatus
        })
        .eq('id', billId)
    if (billUpError) throw new Error(`Failed to update bill totals: ${billUpError.message}`)

    revalidatePath('/bills')
    revalidatePath(`/bills/${billId}`)
}
