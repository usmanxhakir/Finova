'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'

type UserRole = Database['public']['Enums']['user_role']

export function useUserRole() {
    const [role, setRole] = useState<UserRole | null>(null)
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function getRole() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    setRole(null)
                    return
                }

                const { data: profile } = await (supabase
                    .from('profiles') as any)
                    .select('role')
                    .eq('id', user.id)
                    .maybeSingle() // Using maybeSingle for better safety

                if (profile) {
                    setRole((profile as any).role)
                }
            } catch (error) {
                console.error('Error fetching user role:', error)
            } finally {
                setLoading(false)
            }
        }

        getRole()
    }, [supabase])

    return {
        role,
        loading,
        isAdmin: role === 'admin',
        isAccountant: role === 'accountant',
        isViewer: role === 'viewer',
    }
}
