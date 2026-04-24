import { createClient } from '@/lib/supabase/server'

export async function getCompanyId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const { data: profile, error } = await (supabase
    .from('profiles') as any)
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (error || !profile?.company_id) throw new Error('Company not found for user')
  return profile.company_id as string
}
