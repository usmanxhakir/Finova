import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/supabase/get-company-id'
import { JournalEntriesList } from './JournalEntriesList'

export default async function JournalEntriesPage({
    searchParams
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    const resolvedParams = await searchParams
    const showSystem = resolvedParams.showSystem === 'true'
    const from = typeof resolvedParams.from === 'string' ? resolvedParams.from : undefined
    const to = typeof resolvedParams.to === 'string' ? resolvedParams.to : undefined

    let query = (supabase.from('journal_entries') as any)
        .select(`
            *,
            journal_entry_lines (
                debit,
                credit
            )
        `)
        .eq('company_id', companyId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

    if (!showSystem) {
        query = query.eq('is_system_generated', false)
    }

    if (from) {
        query = query.gte('date', from)
    }

    if (to) {
        query = query.lte('date', to)
    }

    const { data: entries, error } = await query

    if (error) {
        console.error('Error fetching journal entries:', error)
    }

    return (
        <JournalEntriesList 
            initialEntries={entries || []} 
            showSystem={showSystem}
            from={from}
            to={to}
        />
    )
}
