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
import { handleUpdateBill, handleVoidBill, handleRecordBillPayment } from './actions'
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
                .select('*, contacts(*), bill_line_items(*)')
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
                    supabase.from('bills').select('*, contacts(*), bill_line_items(*)').eq('id', id).single(),
                    supabase.from('contacts').select('id, name').in('type', ['vendor', 'both']).eq('is_active', true),
                    supabase.from('items').select('*').eq('is_active', true),
                    supabase.from('accounts').select('id, name, code, type').eq('is_active', true),
                    supabase.from('company_settings').select('*').single(),
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

    const isLocked = bill.status !== 'draft'

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

            {isLocked ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Bill Details</CardTitle>
                    </CardHeader>
                    <CardContent className={cn(
                        "space-y-6",
                        bill.status === 'void' && "opacity-60 grayscale-[0.3]"
                    )}>
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Vendor</h4>
                                <p className="mt-1 text-lg font-medium">{(bill.contacts as any)?.name}</p>
                                <p className="text-zinc-600 dark:text-zinc-400">
                                    {(bill.contacts as any)?.billing_address}<br />
                                    {(bill.contacts as any)?.billing_city}, {(bill.contacts as any)?.billing_state} {(bill.contacts as any)?.billing_zip}
                                </p>
                            </div>
                            <div className="text-right">
                                <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Dates & Reference</h4>
                                <p className="mt-1">
                                    <span className="font-medium">Issued:</span> {format(new Date(bill.issue_date), 'MMM d, yyyy')}
                                </p>
                                <p>
                                    <span className="font-medium">Due:</span> {format(new Date(bill.due_date), 'MMM d, yyyy')}
                                </p>
                                {bill.reference_number && (
                                    <p>
                                        <span className="font-medium">Reference:</span> {bill.reference_number}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right w-[100px]">Qty</TableHead>
                                        <TableHead className="text-right w-[150px]">Rate</TableHead>
                                        <TableHead className="text-right w-[150px]">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(bill.bill_line_items as any[]).map((item: any) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.description}</TableCell>
                                            <TableCell className="text-right">{item.quantity}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex justify-end pt-4">
                            <div className="w-[350px] space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Subtotal</span>
                                    <span>{formatCurrency(bill.subtotal)}</span>
                                </div>
                                {Number(bill.discount_amount) > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Discount</span>
                                        <span>-{formatCurrency(bill.discount_amount)}</span>
                                    </div>
                                )}
                                {Number(bill.tax_amount) > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Tax</span>
                                        <span>{formatCurrency(bill.tax_amount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-xl pt-2 border-t">
                                    <span>Total</span>
                                    <span className="text-primary">{formatCurrency(bill.total)}</span>
                                </div>
                                <div className="flex justify-between font-medium pt-2 text-zinc-500">
                                    <span>Paid</span>
                                    <span>{formatCurrency(bill.amount_paid)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
                                    <span>Balance Due</span>
                                    <span>{formatCurrency(bill.amount_due)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
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
                />
            )}
        </div>
    )
}
