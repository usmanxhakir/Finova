import { createClient } from '@/lib/supabase/server'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BillTable } from '@/components/bills/BillTable'

export default async function BillsPage() {
    const supabase = await createClient()

    // Fetch bills with contact names
    const { data: bills, error } = await supabase
        .from('bills')
        .select(`
            *,
            contacts (
                name
            )
        `)
        .order('created_at', { ascending: false })

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id as string)
        .single() as any

    const isViewer = profile?.role === 'viewer'

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                        Bills
                    </h1>
                    <p className="text-muted-foreground">
                        Manage your vendor bills and AP payments.
                    </p>
                </div>
                {!isViewer && (
                    <Button asChild>
                        <Link href="/bills/new">
                            <Plus className="mr-2 h-4 w-4" />
                            New Bill
                        </Link>
                    </Button>
                )}
            </div>

            <BillTable bills={bills || []} />
        </div>
    )
}
