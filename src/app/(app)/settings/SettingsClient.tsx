'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CompanyTab } from '@/components/settings/CompanyTab'
import { UsersTab } from '@/components/settings/UsersTab'
import { Building2, Users } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'

interface SettingsClientProps {
    initialCompanySettings: any
    userProfile: any
}

export function SettingsClient({ initialCompanySettings, userProfile }: SettingsClientProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const currentTab = searchParams.get('tab') || 'company'
    const isAdmin = userProfile?.role === 'admin'

    const handleTabChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('tab', value)
        router.push(`/settings?${params.toString()}`)
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage your organization's settings and team members.</p>
            </div>

            <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="company" className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Company Settings
                    </TabsTrigger>
                    {isAdmin && (
                        <TabsTrigger value="users" className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Users & Roles
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="company" className="mt-6">
                    <CompanyTab initialSettings={initialCompanySettings} />
                </TabsContent>

                {isAdmin && (
                    <TabsContent value="users" className="mt-6">
                        <UsersTab currentUserProfile={userProfile} />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    )
}
