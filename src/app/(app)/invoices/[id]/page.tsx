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
import { handleUpdateInvoice, handleVoidInvoice, handleRecordInvoicePayment } from './actions'
import { ArrowLeft, Ban } from 'lucide-react'
import Link from 'next/link'
import { useUserRole } from '@/hooks/useUserRole'

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const supabase = createClient()
    const { isViewer } = useUserRole()

    const [invoice, setInvoice] = useState<any>(null)
    const [customers, setCustomers] = useState<any[]>([])
    const [items, setItems] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [settings, setSettings] = useState<any>(null)
    const [bankAccounts, setBankAccounts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isSendModalOpen, setIsSendModalOpen] = useState(false)

    const loadInvoice = async () => {
        try {
            const { data: invData } = await supabase.from('invoices')
                .select('*, contacts(*), invoice_line_items(*)')
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
                    { data: settData },
                    { data: bankData }
                ] = await Promise.all([
                    supabase.from('invoices').select('*, contacts(*), invoice_line_items(*)').eq('id', id).single(),
                    supabase.from('contacts').select('id, name').in('type', ['customer', 'both']).eq('is_active', true),
                    supabase.from('items').select('*').eq('is_active', true),
                    supabase.from('accounts').select('id, name, code, type').eq('is_active', true),
                    supabase.from('company_settings').select('*').single(),
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
                setSettings(settData)
                setBankAccounts(bankData || [])
            } catch (error) {
                console.error('Error loading invoice:', error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [id, supabase, router])

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading invoice...</div>
    if (!invoice) return null

    const isLocked = invoice.status !== 'draft'

    const onSave = async (values: any, isFinalize: boolean) => {
        await handleUpdateInvoice(id, values, isFinalize, invoice.status, Number(invoice.amount_due))
        await loadInvoice()
        router.refresh()
    }

    const onVoid = async () => {
        await handleVoidInvoice(id)
        await loadInvoice()
    }

    const onRecordPayment = async (values: any) => {
        await handleRecordInvoicePayment(id, values, invoice.contact_id)
        await loadInvoice()
        router.refresh()
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

            {invoice.status === 'void' && (
                <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-900 rounded-lg p-6 flex items-start gap-4 mb-2 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <Ban className="h-24 w-24 text-red-600 rotate-12" />
                    </div>
                    <div className="bg-red-100 dark:bg-red-900/50 p-2 rounded-full">
                        <Ban className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-red-700 dark:text-red-400 uppercase tracking-tight">This Invoice is VOIDED</h3>
                        <p className="text-red-600/80 dark:text-red-400/70 text-sm mt-1">
                            Voided on {format(new Date(invoice.updated_at), 'PPP')}
                        </p>
                        {invoice.notes && (
                            <div className="mt-3 p-3 bg-white/50 dark:bg-black/20 rounded border border-red-100 dark:border-red-900/50 text-sm text-red-800 dark:text-red-300 italic">
                                "{invoice.notes}"
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">Invoice {invoice.number}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={invoice.status} />
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">Issued on {format(new Date(invoice.issue_date), 'MMM d, yyyy')}</span>
                        {invoice.sent_at && (
                            <>
                                <span className="text-muted-foreground">•</span>
                                <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50 font-medium text-[10px] py-0 px-2 uppercase tracking-wide">
                                    Sent on {format(new Date(invoice.sent_at), 'MMM d, yyyy')}
                                </Badge>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <InvoiceDownloadButton invoice={invoice} settings={settings} />
                    {!isViewer && invoice.status !== 'draft' && invoice.status !== 'void' && (
                        <Button 
                            variant="outline" 
                            className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                            onClick={() => setIsSendModalOpen(true)}
                        >
                            Send Invoice
                        </Button>
                    )}
                    {!isViewer && invoice.status !== 'void' && invoice.status !== 'paid' && (
                        <RecordPaymentModal
                            invoice={invoice}
                            bankAccounts={bankAccounts || []}
                            onRecord={onRecordPayment}
                            onSuccess={() => { router.refresh() }}
                            trigger={
                                <Button className="bg-green-600 hover:bg-green-700 text-white">Record Payment</Button>
                            }
                        />
                    )}
                    {!isViewer && invoice.status !== 'void' && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" className="text-destructive hover:bg-destructive hover:text-white">Void</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Void this Invoice?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action is irreversible. Voiding this invoice will reverse all associated journal entries and cannot be undone. Are you sure you want to proceed?
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
                        <CardTitle>Invoice Details</CardTitle>
                    </CardHeader>
                    <CardContent className={cn(
                        "space-y-6",
                        invoice.status === 'void' && "opacity-60 grayscale-[0.3]"
                    )}>
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Customer</h4>
                                <p className="mt-1 text-lg font-medium">{(invoice.contacts as any)?.name}</p>
                                <p className="text-zinc-600 dark:text-zinc-400">
                                    {(invoice.contacts as any)?.billing_address}<br />
                                    {(invoice.contacts as any)?.billing_city}, {(invoice.contacts as any)?.billing_state} {(invoice.contacts as any)?.billing_zip}
                                </p>
                            </div>
                            <div className="text-right">
                                <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Dates</h4>
                                <p className="mt-1">
                                    <span className="font-medium">Issued:</span> {format(new Date(invoice.issue_date), 'MMM d, yyyy')}
                                </p>
                                <p>
                                    <span className="font-medium">Due:</span> {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                                </p>
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
                                    {(invoice.invoice_line_items as any[]).map((item: any) => (
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
                                    <span>{formatCurrency(invoice.subtotal)}</span>
                                </div>
                                {Number(invoice.discount_amount) > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Discount</span>
                                        <span>-{formatCurrency(invoice.discount_amount)}</span>
                                    </div>
                                )}
                                {Number(invoice.tax_amount) > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Tax</span>
                                        <span>{formatCurrency(invoice.tax_amount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-xl pt-2 border-t">
                                    <span>Total</span>
                                    <span className="text-primary">{formatCurrency(invoice.total)}</span>
                                </div>
                                <div className="flex justify-between font-medium pt-2 text-zinc-500">
                                    <span>Paid</span>
                                    <span>{formatCurrency(invoice.amount_paid)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
                                    <span>Balance Due</span>
                                    <span>{formatCurrency(invoice.amount_due)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <InvoiceForm
                    initialData={{
                        number: invoice.number,
                        contact_id: invoice.contact_id,
                        issue_date: invoice.issue_date,
                        due_date: invoice.due_date,
                        notes: invoice.notes,
                        terms: invoice.terms,
                        footer: invoice.footer,
                        line_items: (invoice.invoice_line_items as any[]).map((li: any) => ({
                            ...li,
                            quantity: Number(li.quantity),
                            rate: Number(li.rate) / 100,
                            amount: Number(li.amount) / 100,
                            tax_rate: Number(li.tax_rate || 0)
                        })),
                        subtotal: Number(invoice.subtotal) / 100,
                        tax_amount: Number(invoice.tax_amount) / 100,
                        discount_amount: Number(invoice.discount_amount) / 100,
                        total: Number(invoice.total) / 100
                    }}
                    customers={customers}
                    items={items}
                    accounts={accounts}
                    nextNumber={invoice.number}
                    onSave={onSave}
                    onBack={() => router.push('/invoices')}
                />
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
