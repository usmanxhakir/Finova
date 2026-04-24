'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'

type UserRole = Database['public']['Enums']['user_role']

export function useUserRole() {
    const [role, setRole] = useState<UserRole | null>(null)
    const [companyId, setCompanyId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function getProfile() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    setRole(null)
                    setCompanyId(null)
                    return
                }

                const { data: profile } = await (supabase
                    .from('profiles') as any)
                    .select('role, company_id')
                    .eq('id', user.id)
                    .maybeSingle()

                if (profile) {
                    setRole((profile as any).role)
                    setCompanyId((profile as any).company_id)
                }
            } catch (error) {
                console.error('Error fetching user profile:', error)
            } finally {
                setLoading(false)
            }
        }

        getProfile()
    }, [supabase])

    return {
        role,
        companyId,
        loading,
        isAdmin: role === 'admin',
        isAccountant: role === 'accountant',
        isViewer: role === 'viewer',
    }
}
