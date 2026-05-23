import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const { email } = await request.json()
  if (!email) return NextResponse.json({ allowed: false })

  const admin = createAdminClient()
  const { data } = await admin
    .from('pending_registrations')
    .select('id, plan')
    .eq('email', email.toLowerCase())
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!data) return NextResponse.json({ allowed: false })
  return NextResponse.json({ allowed: true, plan: data.plan, registrationId: data.id })
}