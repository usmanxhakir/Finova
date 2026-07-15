'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import { BillForm } from '@/components/bills/BillForm'
import { StatusBadge } from '@/components/bills/BillTable'
import { RecordBillPaymentModal } from '@/components/bills/RecordBillPaymentModal'
import { BillDownloadButton } from '@/components/bills/BillDownloadButton'
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
import { handleUpdateBill, handleVoidBill, handleRecordBillPayment, handleEditBillPayment, handleDeleteBillPayment } from './actions'
import { EditBillPaymentModal } from '@/components/bills/EditBillPaymentModal'
import { ArrowLeft, Ban } from 'lucide-react'
import Link from 'next/link'
import { useUserRole } from '@/hooks/useUserRole'

export default function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import { BillForm } from '@/components/bills/BillForm'
import { StatusBadge } from '@/components/bills/BillTable'
import { RecordBillPaymentModal } from '@/components/bills/RecordBillPaymentModal'
import { BillDownloadButton } from '@/components/bills/BillDownloadButton'
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
import { handleUpdateBill, handleVoidBill, handleRecordBillPayment, handleEditBillPayment, handleDeleteBillPayment } from './actions'
import { EditBillPaymentModal } from '@/components/bills/EditBillPaymentModal'
import { ArrowLeft, Ban } from 'lucide-react'
import Link from 'next/link'
import { useUserRole } from '@/hooks/useUserRole'

export default function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const supabase = createClient()
    const { isViewer, companyId } = useUserRole()

    const [bill, setBill] = useState<any>(null)
    const [vendors, setVendors] = useState<any[]>([])
    const [items, setItems] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [projects, setProjects] = useState<any[]>([])
    const [settings, setSettings] = useState<any>(null)
    const [bankAccounts, setBankAccounts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const loadBill = async () => {
        try {
            const { data: billData } = await supabase.from('bills')
                .select('*, contacts(*), bill_line_items(*, items(id, name)), payment_allocations(*, payments(*))')
                .eq('id', id)
                .single()

            if (billData) {
                setBill(billData)
            }
        } catch (error) {
            console.error('Error reloading bill:', error)
        }
    }

    useEffect(() => {
        async function loadData() {
            try {
                const [
                    { data: billData },
                    { data: vendData },
                    { data: itemData },
                    { data: accData },
                    { data: projData },
                    { data: settData },
                    { data: bankData }
                ] = await Promise.all([
                    supabase.from('bills').select('*, contacts(*), bill_line_items(*, items(id, name)), payment_allocations(*, payments(*))').eq('id', id).single(),
                    supabase.from('contacts').select('id, name').in('type', ['vendor', 'both']).eq('is_active', true),
                    supabase.from('items').select('*').eq('is_active', true),
                    supabase.from('accounts').select('id, name, code, type').eq('is_active', true),
                    supabase.from('projects').select('id, name, contact_id').eq('is_active', true),
                    companyId
                        ? supabase.from('companies').select('*').eq('id', companyId).maybeSingle()
                        : supabase.from('companies').select('*').limit(1).maybeSingle(),
                    supabase.from('accounts').select('id, name, code').in('sub_type', ['bank', 'cash']).eq('is_active', true)
                ])

                if (!billData) {
                    router.push('/bills')
                    return
                }

                setBill(billData)
                setVendors(vendData || [])
                setItems(itemData || [])
                setAccounts(accData || [])
                setProjects(projData || [])
                setSettings(settData)
                setBankAccounts(bankData || [])
            } catch (error) {
                console.error('Error loading bill:', error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [id, companyId, supabase, router])
            />

            {bill.payment_allocations && bill.payment_allocations.length > 0 && (
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
                                {bill.payment_allocations.map((alloc: any) => (
                                    <TableRow key={alloc.id}>
                                        <TableCell>{format(new Date(alloc.payments.date), 'MMM d, yyyy')}</TableCell>
                                        <TableCell>{alloc.payments.reference || '-'}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(alloc.amount_applied)}</TableCell>
                                        <TableCell>
                                            {!isViewer && bill.status !== 'void' && (
                                                <EditBillPaymentModal
                                                    payment={alloc.payments}
                                                    billNumber={bill.number}
                                                    bankAccounts={bankAccounts}
                                                    onEdit={async (values) => {
                                                        await handleEditBillPayment(alloc.payment_id, bill.id, values)
                                                        await loadBill()
                                                        router.refresh()
                                                    }}
                                                    onDelete={async () => {
                                                        await handleDeleteBillPayment(alloc.payment_id, bill.id)
                                                        await loadBill()
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
        </div>
    )
}
