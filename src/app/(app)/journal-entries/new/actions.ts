'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCompanyId } from '@/lib/supabase/get-company-id'

export async function saveJournalEntry(formData: FormData) {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    const date = formData.get('date') as string
    const reference = formData.get('reference') as string
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

        // 1. Insert Header
        const { data: entry, error: entryError } = await (supabase.from('journal_entries') as any)
            .insert({
                company_id: companyId,
                date,
                reference,
                description,
                is_system_generated: false,
                source_type: 'manual',
                source_id: null
            })
            .select()
            .single()

        if (entryError || !entry) {
            throw new Error(`Failed to create journal entry: ${entryError?.message}`)
        }

        // 2. Insert Lines
        const entryLines = lines.map(line => ({
            journal_entry_id: entry.id,
            company_id: companyId,
            ...line
        }))

        const { error: linesError } = await (supabase.from('journal_entry_lines') as any)
            .insert(entryLines)

        if (linesError) {
            // Rollback header manually (optional, but good practice if not using RPC)
            await (supabase.from('journal_entries') as any).delete().eq('id', entry.id)
            throw new Error(`Failed to create entry lines: ${linesError.message}`)
        }

        redirectTo = '/journal-entries'
    } catch (error: any) {
        console.error('Error saving journal entry:', error)
        return { error: error.message || 'An error occurred' }
    }

    if (redirectTo) {
        revalidatePath('/journal-entries')
        redirect(redirectTo)
    }
}
