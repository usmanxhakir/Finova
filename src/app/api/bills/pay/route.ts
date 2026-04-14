import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const allocationSchema = z.object({
    bill_id: z.string().uuid(),
    amount_applied: z.number().int()
})

const payBillsSchema = z.object({
    contact_id: z.string().uuid(),
    payment_date: z.string(),
    amount: z.number().int(),
    payment_method: z.string(),
    reference: z.string().optional().nullable(),
    account_id: z.string().uuid(),
    notes: z.string().optional().nullable(),
    allocations: z.array(allocationSchema).min(1)
})

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const validated = payBillsSchema.parse(body)
        
        const supabase = await createClient()
        
        const { data, error } = await supabase.rpc('pay_bills', {
            p_contact_id: validated.contact_id,
            p_payment_date: validated.payment_date,
            p_amount: validated.amount,
            p_payment_method: validated.payment_method,
            p_account_id: validated.account_id,
            p_allocations: validated.allocations,
            p_reference: validated.reference,
            p_notes: validated.notes
        })

        if (error) throw error

        return NextResponse.json({ payment_id: data })
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
