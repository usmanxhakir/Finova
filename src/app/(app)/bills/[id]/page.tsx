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
    const { isViewer } = useUserRole()

    const [bill, setBill] = useState<any>(null)
    const [vendors, setVendors] = useState<any[]>([])
    const [items, setItems] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [settings, setSettings] = useState<any>(null)
    const [bankAccounts, setBankAccounts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const loadBill = async () => {
        try {
            const { data: billData } = await supabase.from('bills')
                .select('*, contacts(*), bill_line_items(*), payment_allocations(*, payments(*))')
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
                    { data: settData },
                    { data: bankData }
                ] = await Promise.all([
                    supabase.from('bills').select('*, contacts(*), bill_line_items(*), payment_allocations(*, payments(*))').eq('id', id).single(),
                    supabase.from('contacts').select('id, name').in('type', ['vendor', 'both']).eq('is_active', true),
                    supabase.from('items').select('*').eq('is_active', true),
                    supabase.from('accounts').select('id, name, code, type').eq('is_active', true),
                    supabase.from('companies').select('*').single(),
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
                setSettings(settData)
                setBankAccounts(bankData || [])
            } catch (error) {
                console.error('Error loading bill:', error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [id, supabase, router])

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading bill...</div>
    if (!bill) return null

    const isLocked = bill.status === 'void'

    const onSave = async (values: any, isFinalize: boolean) => {
        await handleUpdateBill(id, values, isFinalize, bill.status, Number(bill.amount_due))
        await loadBill()
        router.refresh()
    }

    const onVoid = async () => {
        await handleVoidBill(id)
        await loadBill()
    }

    const onRecordPayment = async (values: any) => {
        await handleRecordBillPayment(id, values, bill.contact_id)
        await loadBill()
        router.refresh()
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

            {bill.status === 'void' && (
                <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-900 rounded-lg p-6 flex items-start gap-4 mb-2 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <Ban className="h-24 w-24 text-red-600 rotate-12" />
                    </div>
                    <div className="bg-red-100 dark:bg-red-900/50 p-2 rounded-full">
                        <Ban className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-red-700 dark:text-red-400 uppercase tracking-tight">This Bill is VOIDED</h3>
                        <p className="text-red-600/80 dark:text-red-400/70 text-sm mt-1">
                            Voided on {format(new Date(bill.updated_at), 'PPP')}
                        </p>
                        {bill.notes && (
                            <div className="mt-3 p-3 bg-white/50 dark:bg-black/20 rounded border border-red-100 dark:border-red-900/50 text-sm text-red-800 dark:text-red-300 italic">
                                "{bill.notes}"
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">Bill {bill.number}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={bill.status} />
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">Issued on {format(new Date(bill.issue_date), 'MMM d, yyyy')}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <BillDownloadButton bill={bill} settings={settings} />
                    {!isViewer && bill.status !== 'void' && bill.status !== 'paid' && (
                        <RecordBillPaymentModal
                            bill={bill}
                            bankAccounts={bankAccounts || []}
                            onRecord={onRecordPayment}
                            onSuccess={() => { router.refresh() }}
                            trigger={
                                <Button className="bg-green-600 hover:bg-green-700 text-white">Record Payment</Button>
                            }
                        />
                    )}
                    {!isViewer && bill.status !== 'void' && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" className="text-destructive hover:bg-destructive hover:text-white">Void</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Void this Bill?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action is irreversible. Voiding this bill will reverse all associated journal entries and cannot be undone. Are you sure you want to proceed?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={onVoid} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Yes, Void It
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>

            <BillForm
                initialData={{
                    number: bill.number,
                    contact_id: bill.contact_id,
                    reference_number: bill.reference_number,
                    issue_date: bill.issue_date,
                    due_date: bill.due_date,
                    notes: bill.notes,
                    line_items: (bill.bill_line_items as any[]).map((li: any) => ({
                        ...li,
                        quantity: Number(li.quantity),
                        rate: Number(li.rate) / 100,
                        amount: Number(li.amount) / 100,
                        tax_rate: Number(li.tax_rate || 0)
                    })),
                    subtotal: Number(bill.subtotal) / 100,
                    tax_amount: Number(bill.tax_amount) / 100,
                    discount_amount: Number(bill.discount_amount) / 100,
                    total: Number(bill.total) / 100
                }}
                vendors={vendors}
                items={items}
                accounts={accounts}
                nextNumber={bill.number}
                onSave={onSave}
                onBack={() => router.push('/bills')}
                isPosted={bill.status !== 'draft'}
                isVoid={bill.status === 'void'}
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
