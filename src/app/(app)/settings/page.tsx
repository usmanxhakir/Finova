import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsClient } from './SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    // Fetch user profile to check role
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    if (!profile?.company_id) {
        redirect('/login')
    }

    // Fetch initial company settings
    const { data: companySettings } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single()

    return (
        <SettingsClient 
            initialCompanySettings={companySettings} 
            userProfile={profile}
        />
    )
}
