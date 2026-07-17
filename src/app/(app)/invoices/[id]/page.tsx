'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import { InvoiceForm } from '@/components/invoices/InvoiceForm'
import { StatusBadge } from '@/components/invoices/InvoiceTable'
import { RecordPaymentModal } from '@/components/invoices/RecordPaymentModal'
import { InvoiceDownloadButton } from '@/components/invoices/InvoiceDownloadButton'
import { SendInvoiceModal } from '@/components/invoices/SendInvoiceModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { formatCurrency, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { handleUpdateInvoice, handleVoidInvoice, handleRecordInvoicePayment, handleEditInvoicePayment, handleDeleteInvoicePayment } from './actions'
import { EditPaymentModal } from '@/components/invoices/EditPaymentModal'
import { ArrowLeft, Ban } from 'lucide-react'
import Link from 'next/link'
import { useUserRole } from '@/hooks/useUserRole'

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const supabase = createClient()
    const { isViewer, companyId } = useUserRole()

    const [invoice, setInvoice] = useState<any>(null)
    const [customers, setCustomers] = useState<any[]>([])
    const [items, setItems] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [projects, setProjects] = useState<any[]>([])
    const [settings, setSettings] = useState<any>(null)
    const [bankAccounts, setBankAccounts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isSendModalOpen, setIsSendModalOpen] = useState(false)

    const loadInvoice = async () => {
        try {
            const { data: invData } = await supabase.from('invoices')
                .select('*, contacts(*), invoice_line_items(*, items(id, name)), payment_allocations(*, payments(*))')
                .eq('id', id)
                .single()

            if (invData) {
                setInvoice(invData)
            }
        } catch (error) {
            console.error('Error reloading invoice:', error)
        }
    }

    useEffect(() => {
        async function loadData() {
            try {
                const [
                    { data: invData },
                    { data: custData },
                    { data: itemData },
                    { data: accData },
                    { data: projData },
                    { data: settData },
                    { data: bankData }
                ] = await Promise.all([
                    supabase.from('invoices').select('*, contacts(*), invoice_line_items(*, items(id, name)), payment_allocations(*, payments(*))').eq('id', id).single(),
                    supabase.from('contacts').select('id, name').in('type', ['customer', 'both']).eq('is_active', true),
                    supabase.from('items').select('*').eq('is_active', true),
                    supabase.from('accounts').select('id, name, code, type').eq('is_active', true),
                    supabase.from('projects').select('id, name, contact_id').eq('is_active', true),
                    companyId
                        ? supabase.from('companies').select('*').eq('id', companyId).maybeSingle()
                        : supabase.from('companies').select('*').limit(1).maybeSingle(),
                    supabase.from('accounts').select('id, name, code').in('sub_type', ['bank', 'cash']).eq('is_active', true)
                ])

                if (!invData) {
                    router.push('/invoices')
                    return
                }

                setInvoice(invData)
                setCustomers(custData || [])
                setItems(itemData || [])
                setAccounts(accData || [])
                setProjects(projData || [])
                setSettings(settData)
                setBankAccounts(bankData || [])
            } catch (error) {
                console.error('Error loading invoice:', error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [id, companyId, supabase, router])
            {invoice.payment_allocations && invoice.payment_allocations.length > 0 && (
                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle>Payment History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="w-[100px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoice.payment_allocations.map((alloc: any) => (
                                    <TableRow key={alloc.id}>
                                        <TableCell>{format(new Date(alloc.payments.date), 'MMM d, yyyy')}</TableCell>
                                        <TableCell>{alloc.payments.reference || '-'}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(alloc.amount_applied)}</TableCell>
                                        <TableCell>
                                            {!isViewer && invoice.status !== 'void' && (
                                                <EditPaymentModal
                                                    payment={alloc.payments}
                                                    invoiceNumber={invoice.number}
                                                    bankAccounts={bankAccounts}
                                                    onEdit={async (values) => {
                                                        await handleEditInvoicePayment(alloc.payment_id, invoice.id, values)
                                                        await loadInvoice()
                                                        router.refresh()
                                                    }}
                                                    onDelete={async () => {
                                                        await handleDeleteInvoicePayment(alloc.payment_id, invoice.id)
                                                        await loadInvoice()
                                                        router.refresh()
                                                    }}
                                                />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {invoice && (
                <SendInvoiceModal
                    invoice={invoice}
                    settings={settings}
                    open={isSendModalOpen}
                    onOpenChange={setIsSendModalOpen}
                    onSuccess={loadInvoice}
                />
            )}
        </div>
    )
}
