import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ accountId: string }> }
) {
    const { accountId } = await params;
    const body = await request.json();
    const { statement_date, statement_ending_balance } = body;

    const supabase = await createClient();

    try {
        // 1. Check for existing in_progress reconciliation
        const { data: existing, error: fetchError } = await (supabase
            .from('reconciliations') as any)
            .select('*')
            .eq('account_id', accountId)
            .eq('status', 'in_progress')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchError) throw fetchError;

        if (existing) {
            return NextResponse.json(existing);
        }

        // 2. Create new reconciliation
        const { data: newRecon, error: insertError } = await (supabase
            .from('reconciliations') as any)
            .insert({
                account_id: accountId,
                statement_date: statement_date,
                statement_ending_balance: statement_ending_balance,
                status: 'in_progress',
                cleared_balance: 0,
                difference: statement_ending_balance, 
                book_balance_at_date: 0 // Will update on complete or during process if needed
            })
            .select()
            .single();

        if (insertError) throw insertError;

        return NextResponse.json(newRecon);

    } catch (error: any) {
        console.error('Error in start reconciliation API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
