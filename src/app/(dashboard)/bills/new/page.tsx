'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BillForm } from '@/components/bills/BillForm'
import { handleSaveBill } from './actions'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewBillPage() {
    const router = useRouter()
    const supabase = createClient()

    const [vendors, setVendors] = useState<any[]>([])
    const [items, setItems] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [settings, setSettings] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadData() {
            try {
                const [
                    { data: vendData },
                    { data: itemData },
                    { data: accData },
                    { data: settData }
                ] = await Promise.all([
                    supabase.from('contacts').select('id, name').in('type', ['vendor', 'both']).eq('is_active', true),
                    supabase.from('items').select('*').eq('is_active', true),
                    supabase.from('accounts').select('id, name, code, type').eq('is_active', true),
                    supabase.from('company_settings').select('*').single()
                ])

                setVendors(vendData || [])
                setItems(itemData || [])
                setAccounts(accData || [])
                setSettings(settData)
            } catch (error) {
                console.error('Error loading new bill data:', error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [supabase])

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>

    const prefix = settings?.bill_prefix || 'BILL-'
    const nextNumber = `${prefix}${String(settings?.bill_next_number || 1).padStart(4, '0')}`

    const onSave = async (values: any, isFinalize: boolean) => {
        const result = await handleSaveBill(values, isFinalize, settings)
<<<<<<< Updated upstream
=======
        // handleSaveBill returns a result object on error, or void (then redirects) on success
>>>>>>> Stashed changes
        if (result && result.success === false) {
            throw new Error(result.errorCode)
        }
    }

    return (
        <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <Link
                    href="/bills"
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Bills
                </Link>
            </div>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">New Bill</h1>
                <p className="text-muted-foreground">Create a new bill from a vendor.</p>
            </div>

            <BillForm
                vendors={vendors}
                items={items}
                accounts={accounts}
                nextNumber={nextNumber}
                onSave={onSave}
                onBack={() => router.push('/bills')}
            />
        </div>
    )
}
