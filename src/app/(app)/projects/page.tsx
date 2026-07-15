import { createClient } from '@/lib/supabase/server'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectsTable } from '@/components/projects/ProjectsTable'
import { ProjectSheet } from '@/components/projects/ProjectSheet'
import { getCompanyId } from '@/lib/supabase/get-company-id'

export default async function ProjectsPage() {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    // Fetch projects with contact names
    const { data: projects, error } = await supabase
        .from('projects')
        .select(`
            *,
            contacts (
                name
            )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id as string)
        .single() as any

    const isViewer = profile?.role === 'viewer'

    // Fetch customers for the project sheet
    const { data: customers } = await supabase
        .from('contacts')
        .select('id, name')
        .in('type', ['customer', 'both'])
        .eq('is_active', true)
        .eq('company_id', companyId)

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                        Projects
                    </h1>
                    <p className="text-muted-foreground">
                        Manage your customer projects and track their performance.
                    </p>
                </div>
            </div>

            <ProjectsTable projects={projects || []} isViewer={isViewer} customers={customers || []} />
        </div>
    )
}
