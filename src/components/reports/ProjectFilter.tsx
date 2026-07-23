'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

type Project = {
    id: string
    name: string
    code: string | null
}

type Company = {
    id: string
}

interface ProjectFilterProps {
    onChange?: (projectId: string | null) => void
    availabilityNote?: string
}

const ALL_PROJECTS_VALUE = '__all_projects__'

export function ProjectFilter({ onChange, availabilityNote }: ProjectFilterProps) {
    const supabase = useMemo(() => createClient(), [])
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [projects, setProjects] = useState<Project[]>([])
    const projectId = searchParams.get('project_id') || ''

    useEffect(() => {
        const loadProjects = async () => {
            const { data: companyData } = await supabase.from('companies').select('id').single()
            const company = companyData as unknown as Company | null
            if (!company) return

            const { data } = await supabase
                .from('projects')
                .select('id, name, code')
                .eq('company_id', company.id)
                .order('name')

            setProjects(data || [])
        }

        loadProjects()
    }, [supabase])

    const handleChange = (value: string) => {
        const nextProjectId = value === ALL_PROJECTS_VALUE ? null : value
        const params = new URLSearchParams(searchParams.toString())

        if (nextProjectId) params.set('project_id', nextProjectId)
        else params.delete('project_id')

        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)
        onChange?.(nextProjectId)
    }

    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Project</span>
            <Select value={projectId || ALL_PROJECTS_VALUE} onValueChange={handleChange}>
                <SelectTrigger className="w-[220px] h-9">
                    <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL_PROJECTS_VALUE}>All projects</SelectItem>
                    {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                            {project.code ? `${project.code} - ${project.name}` : project.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {availabilityNote && (
                <p className="flex max-w-[360px] items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {availabilityNote}
                </p>
            )}
        </div>
    )
}
