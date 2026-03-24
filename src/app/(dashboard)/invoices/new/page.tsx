'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { InvoiceForm } from '@/components/invoices/InvoiceForm'
import { handleSaveInvoice } from './actions'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewInvoicePage() {
    const router = useRouter()
    const supabase = createClient()

    const [customers, setCustomers] = useState<any[]>([])
    const [items, setItems] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [settings, setSettings] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadData() {
            try {
                const [
                    { data: custData },
                    { data: itemData },
                    { data: accData },
                    { data: settData }
                ] = await Promise.all([
                    supabase.from('contacts').select('id, name').in('type', ['customer', 'both']).eq('is_active', true),
                    supabase.from('items').select('*').eq('is_active', true),
                    supabase.from('accounts').select('id, name, code, type').eq('is_active', true),
                    supabase.from('company_settings').select('*').single()
                ])

                setCustomers(custData || [])
                setItems(itemData || [])
                setAccounts(accData || [])
                setSettings(settData)
            } catch (error) {
                console.error('Error loading new invoice data:', error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [supabase])

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>

    const prefix = settings?.invoice_prefix || 'INV-'
    const nextNumber = `${prefix}${String(settings?.invoice_next_number || 1).padStart(4, '0')}`

    const onSave = async (values: any, isFinalize: boolean) => {
        const result = await handleSaveInvoice(values, isFinalize, settings)
        // handleSaveInvoice returns a result object on error, or void (then redirects) on success
        if (result && result.success === false) {
            throw new Error(result.errorCode)
        }
    }

    return (
        <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <Link
                    href="/invoices"
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Invoices
                </Link>
            </div>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">New Invoice</h1>
                <p className="text-muted-foreground">Create a new invoice for your customer.</p>
            </div>

            <InvoiceForm
                customers={customers}
                items={items}
                accounts={accounts}
                nextNumber={nextNumber}
                onSave={onSave}
                onBack={() => router.push('/invoices')}
            />
        </div>
    )
}
