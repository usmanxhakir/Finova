import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('generate_je_reference')

        if (error) {
            console.error('Error generating JE reference:', error)
            return NextResponse.json({ error: 'Failed to generate reference' }, { status: 500 })
        }

        return NextResponse.json({ reference: data || 'JE-000-000' })
    } catch (err) {
        console.error('Unexpected error generating JE reference:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
