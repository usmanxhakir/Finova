import { createClient } from '@/lib/supabase/server';
import { NextResponse, NextRequest } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ accountId: string }> }
) {
    const { accountId } = await params;
    const { searchParams } = new URL(request.url);
    const clearedParam = searchParams.get('cleared') || 'all';

    const supabase = await createClient();

    try {
        let query = (supabase
            .from('journal_entry_lines') as any)
            .select(`
                id,
                debit,
                credit,
                is_cleared,
                reconciliation_id,
                journal_entry_id,
                journal_entries!inner (
                    date,
                    description,
                    reference
                )
            `)
            .eq('account_id', accountId);

        if (clearedParam === 'true') {
            query = query.eq('is_cleared', true);
        } else if (clearedParam === 'false') {
            query = query.eq('is_cleared', false);
        }

        const { data, error } = await query;

        if (error) throw error;

        const sorted = (data || []).sort((a: any, b: any) => {
            const dateA = a.journal_entries?.date ?? '';
            const dateB = b.journal_entries?.date ?? '';
            return dateB.localeCompare(dateA);
        });

        return NextResponse.json(sorted);

    } catch (error: any) {
        console.error('Error in reconciliation lines API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
