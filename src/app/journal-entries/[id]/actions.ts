'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCompanyId } from '@/lib/supabase/get-company-id'

export async function updateJournalEntry(id: string, formData: FormData) {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    const date = formData.get('date') as string
    const description = formData.get('description') as string

    // Parse lines
    const lineCount = parseInt(formData.get('lineCount') as string || '0', 10)
    const lines = []

    for (let i = 0; i < lineCount; i++) {
        const account_id = formData.get(`lines[${i}][account_id]`) as string
        const lineDesc = formData.get(`lines[${i}][description]`) as string || ''
        const debitStr = formData.get(`lines[${i}][debit]`) as string
        const creditStr = formData.get(`lines[${i}][credit]`) as string

        const debit = debitStr ? parseInt(debitStr, 10) : 0
        const credit = creditStr ? parseInt(creditStr, 10) : 0

        // Only include lines that have an account and at least one non-zero amount
        if (account_id && (debit !== 0 || credit !== 0)) {
            lines.push({ account_id, description: lineDesc, debit, credit })
        }
    }

    let redirectTo: string | null = null

    try {
        if (lines.length < 2) {
            throw new Error('A journal entry must have at least two lines.')
        }

        const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0)
        const totalCredits = lines.reduce((sum, line) => sum + line.credit, 0)

        if (totalDebits !== totalCredits) {
            throw new Error('Debits and credits must be equal.')
        }

        // Ensure we only edit manual entries
        const { data: existing, error: fetchError } = await (supabase.from('journal_entries') as any)
            .select('is_system_generated')
            .eq('id', id)
            .eq('company_id', companyId)
            .single()

        if (fetchError || !existing) {
            throw new Error('Journal entry not found')
        }

        if (existing.is_system_generated) {
            throw new Error('Cannot edit a system-generated journal entry.')
        }

        // 1. Update Header
        const { error: entryError } = await (supabase.from('journal_entries') as any)
            .update({
                date,
                description,
            })
            .eq('id', id)
            .eq('company_id', companyId)

        if (entryError) {
            throw new Error(`Failed to update journal entry: ${entryError.message}`)
        }

        // 2. Delete old lines
        const { error: delError } = await (supabase.from('journal_entry_lines') as any)
            .delete()
            .eq('journal_entry_id', id)
            .eq('company_id', companyId)
            
        if (delError) {
            throw new Error(`Failed to delete old entry lines: ${delError.message}`)
        }

        // 3. Insert new Lines
        const entryLines = lines.map(line => ({
            journal_entry_id: id,
            company_id: companyId,
            ...line
        }))

        const { error: linesError } = await (supabase.from('journal_entry_lines') as any)
            .insert(entryLines)

        if (linesError) {
            throw new Error(`Failed to create new entry lines: ${linesError.message}`)
        }

        redirectTo = '/journal-entries'
    } catch (error: any) {
        console.error('Error updating journal entry:', error)
        return { error: error.message || 'An error occurred' }
    }

    if (redirectTo) {
        revalidatePath('/journal-entries')
        redirect(redirectTo)
    }
}
