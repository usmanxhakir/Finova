'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
    Form, 
    FormControl, 
    FormField, 
    FormItem, 
    FormLabel, 
    FormMessage 
} from '@/components/ui/form'
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Loader2, ArrowLeft, Search } from 'lucide-react'

const receivePaymentSchema = z.object({
    contact_id: z.string().min(1, 'Customer is required'),
    payment_date: z.string().min(1, 'Date is required'),
    amount: z.number().int().min(0, 'Amount must be at least 0'),
    payment_method: z.string().min(1, 'Payment method is required'),
    reference: z.string().optional().nullable(),
    account_id: z.string().min(1, 'Deposit account is required'),
    notes: z.string().optional().nullable(),
    allocations: z.array(z.object({
        invoice_id: z.string(),
        amount_applied: z.number().int().min(0)
    }))
})

type ReceivePaymentFormValues = z.infer<typeof receivePaymentSchema>

interface Invoice {
    id: string
    number: string
    issue_date: string
    due_date: string
    total: number
    balance: number
    contact_id: string
    contact_name: string
}

interface ReceivePaymentsClientProps {
    customers: { id: string, name: string }[]
    accounts: any[]
}

export function ReceivePaymentsClient({ customers, accounts }: ReceivePaymentsClientProps) {
    const router = useRouter()
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [isLoadingInvoices, setIsLoadingInvoices] = useState(false)
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<ReceivePaymentFormValues>({
        resolver: zodResolver(receivePaymentSchema),
        defaultValues: {
            contact_id: '',
            payment_date: format(new Date(), 'yyyy-MM-dd'),
            amount: 0,
            payment_method: 'Check',
            account_id: accounts[0]?.id || '',
            allocations: []
        }
    })

    const { fields, replace, update } = useFieldArray({
        control: form.control,
        name: 'allocations'
    })

    // Fetch invoices when customer changes
    useEffect(() => {
        if (!selectedCustomerId) {
            setInvoices([])
            replace([])
            setSelectedIds(new Set())
            form.setValue('contact_id', '')
            return
        }

        const fetchInvoices = async () => {
            try {
                setIsLoadingInvoices(true)
                const res = await fetch(`/api/invoices/open?contactId=${selectedCustomerId}`)
                if (!res.ok) throw new Error('Failed to fetch invoices')
                const data = await res.json()
                setInvoices(data)
                form.setValue('contact_id', selectedCustomerId)
                replace([])
                setSelectedIds(new Set())
            } catch (error) {
                toast.error('Error loading invoices')
            } finally {
                setIsLoadingInvoices(false)
            }
        }

        fetchInvoices()
    }, [selectedCustomerId, replace, form])

    // Update total amount when allocations change
    const allocations = form.watch('allocations')
    const totalReceivedAmount = useMemo(() => {
        return allocations.reduce((sum, alloc) => sum + (alloc.amount_applied || 0), 0)
    }, [allocations])

    useEffect(() => {
        form.setValue('amount', totalReceivedAmount)
    }, [totalReceivedAmount, form])

    const toggleInvoice = (invoice: Invoice) => {
        const next = new Set(selectedIds)
        if (next.has(invoice.id)) {
            next.delete(invoice.id)
            const newAllocations = allocations.filter(a => a.invoice_id !== invoice.id)
            replace(newAllocations)
        } else {
            next.add(invoice.id)
            replace([...allocations, { invoice_id: invoice.id, amount_applied: invoice.balance }])
        }
        setSelectedIds(next)
    }

    const toggleAll = () => {
        if (selectedIds.size === invoices.length && invoices.length > 0) {
            setSelectedIds(new Set())
            replace([])
        } else {
            const allIds = new Set(invoices.map(i => i.id))
            setSelectedIds(allIds)
            replace(invoices.map(i => ({ invoice_id: i.id, amount_applied: i.balance })))
        }
    }

    const handleRowAmountChange = (invoiceId: string, amountCents: number) => {
        const idx = allocations.findIndex(a => a.invoice_id === invoiceId)
        if (idx !== -1) {
            update(idx, { ...allocations[idx], amount_applied: amountCents })
        } else if (amountCents > 0) {
            const invoice = invoices.find(i => i.id === invoiceId)
            if (invoice) {
                setSelectedIds(prev => new Set(prev).add(invoiceId))
                replace([...allocations, { invoice_id: invoiceId, amount_applied: amountCents }])
            }
        }
    }

    const onSubmit = async (values: ReceivePaymentFormValues) => {
        if (values.allocations.length === 0) {
            toast.error('Please select at least one invoice')
            return
        }

        try {
            setIsSubmitting(true)
            const response = await fetch('/api/invoices/receive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to process payment')
            }

            toast.success('Payment received successfully')
            router.push('/invoices')
            router.refresh()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-emerald-50/10">
            <header className="flex-shrink-0 flex items-center justify-between px-8 py-4 border-b bg-white z-20">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ArrowLeft className="h-5 w-5 text-emerald-600" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-emerald-900">Receive Payments</h1>
                        <p className="text-sm text-zinc-500 font-medium">Log customer payments and apply them to open invoices</p>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden p-6 gap-6">
                <div className="flex-1 flex flex-col gap-6 min-w-0">
                    <Card className="border-none shadow-sm bg-white overflow-hidden flex flex-col h-full">
                        <div className="p-6 border-b flex flex-col gap-4 bg-emerald-50/20">
                            <div className="flex flex-col gap-2 max-w-md">
                                <Label htmlFor="customer-select" className="text-sm font-semibold text-emerald-900">Customer</Label>
                                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                                    <SelectTrigger id="customer-select" className="bg-white border-emerald-100 focus:ring-emerald-500">
                                        <SelectValue placeholder="Select a customer..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customers.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                    <TableRow className="bg-emerald-50/10 border-b">
                                        <TableHead className="w-[50px] pl-6">
                                            <Checkbox 
                                                checked={selectedIds.size === invoices.length && invoices.length > 0}
                                                onCheckedChange={toggleAll}
                                                disabled={invoices.length === 0}
                                                className="border-emerald-200 data-[state=checked]:bg-emerald-600"
                                            />
                                        </TableHead>
                                        <TableHead className="font-semibold text-emerald-900">Invoice #</TableHead>
                                        <TableHead className="font-semibold text-emerald-900">Due Date</TableHead>
                                        <TableHead className="text-right font-semibold text-emerald-900">Balance</TableHead>
                                        <TableHead className="text-right font-semibold text-emerald-900 pr-6 w-[180px]">Amount Received</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingInvoices ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-64 text-center">
                                                <div className="flex flex-col items-center gap-2 text-emerald-600">
                                                    <Loader2 className="h-8 w-8 animate-spin" />
                                                    <span className="font-mono text-sm">Loading invoices...</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : !selectedCustomerId ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-64 text-center">
                                                <div className="flex flex-col items-center gap-4 text-emerald-600/40 px-12">
                                                    <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center">
                                                        <Search className="h-8 w-8" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="font-bold text-emerald-900/60">No customer selected</p>
                                                        <p className="text-sm max-w-[240px]">Select a customer to view their outstanding invoices.</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : invoices.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-64 text-center text-zinc-500 font-mono">
                                                No open invoices found for this customer.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        invoices.map((invoice) => {
                                            const allocation = allocations.find(a => a.invoice_id === invoice.id)
                                            const isSelected = selectedIds.has(invoice.id)
                                            return (
                                                <TableRow 
                                                    key={invoice.id}
                                                    className={`${isSelected ? "bg-emerald-50/40" : "hover:bg-emerald-50/10"} transition-colors`}
                                                >
                                                    <TableCell className="pl-6">
                                                        <Checkbox 
                                                            checked={isSelected}
                                                            onCheckedChange={() => toggleInvoice(invoice)}
                                                            className="border-emerald-200 data-[state=checked]:bg-emerald-600"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium text-emerald-900">{invoice.number}</TableCell>
                                                    <TableCell className="text-zinc-600">{formatDate(invoice.due_date)}</TableCell>
                                                    <TableCell className="text-right font-medium text-emerald-900">{formatCurrency(invoice.balance)}</TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <div className="relative inline-block w-full">
                                                            <span className="absolute left-3 top-2.5 text-xs text-emerald-400">$</span>
                                                            <Input 
                                                                type="number" 
                                                                step="0.01"
                                                                className={`pl-6 text-right h-9 border-emerald-100 focus-visible:ring-emerald-500 ${!isSelected && 'opacity-50'}`}
                                                                value={allocation ? allocation.amount_applied / 100 : ''}
                                                                placeholder="0.00"
                                                                onChange={(e) => {
                                                                    const val = Math.round(parseFloat(e.target.value || '0') * 100)
                                                                    handleRowAmountChange(invoice.id, val)
                                                                }}
                                                            />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>

                <aside className="w-[420px] flex-shrink-0 flex flex-col gap-6 overflow-y-auto pb-6 scrollbar-hide">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-emerald-900 text-white p-6">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg font-bold">Receive Details</CardTitle>
                                        <div className="px-3 py-1 bg-white/10 rounded-full border border-white/20">
                                            <span className="text-xs font-mono font-bold">{selectedIds.size} Selected</span>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-8 space-y-8">
                                    <FormField
                                        control={form.control}
                                        name="account_id"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel className="text-xs uppercase tracking-wider font-bold text-emerald-600">Deposit Account</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-12 border-emerald-100 focus:ring-emerald-500">
                                                            <SelectValue placeholder="Select account" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {accounts.map(acc => (
                                                            <SelectItem key={acc.id} value={acc.id}>
                                                                <div className="flex flex-col items-start py-0.5">
                                                                    <span className="font-semibold">{acc.name}</span>
                                                                    <span className="text-[10px] text-emerald-400 font-mono tracking-tighter">CODE: {acc.code}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="payment_date"
                                            render={({ field }) => (
                                                <FormItem className="space-y-3">
                                                    <FormLabel className="text-xs uppercase tracking-wider font-bold text-emerald-600">Date</FormLabel>
                                                    <FormControl>
                                                        <Input type="date" {...field} className="h-12 border-emerald-100 focus:ring-emerald-500" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="payment_method"
                                            render={({ field }) => (
                                                <FormItem className="space-y-3">
                                                    <FormLabel className="text-xs uppercase tracking-wider font-bold text-emerald-600">Method</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-12 border-emerald-100 focus:ring-emerald-500">
                                                                <SelectValue placeholder="Method" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Check">Check</SelectItem>
                                                            <SelectItem value="EFT">EFT / Wire</SelectItem>
                                                            <SelectItem value="Cash">Cash</SelectItem>
                                                            <SelectItem value="Credit Card">Credit Card</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="amount"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3 group">
                                                <FormLabel className="text-xs uppercase tracking-wider font-bold text-emerald-600 group-hover:text-emerald-700 transition-colors">Amount Received</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-emerald-400">$</span>
                                                        <Input 
                                                            readOnly
                                                            className="pl-10 text-3xl font-black h-20 border-2 border-emerald-50 bg-emerald-50/30 text-emerald-900 rounded-2xl shadow-inner cursor-default"
                                                            value={formatCurrency(field.value).replace('$', '')}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <p className="text-[10px] text-emerald-400 font-medium italic">Auto-calculated from items selected</p>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="reference"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel className="text-xs uppercase tracking-wider font-bold text-emerald-600">Reference #</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Check #, Auth #" {...field} value={field.value || ''} className="h-12 border-emerald-100 focus:ring-emerald-500" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="notes"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel className="text-xs uppercase tracking-wider font-bold text-emerald-600">Notes</FormLabel>
                                                <FormControl>
                                                    <Textarea 
                                                        placeholder="Payment notes..." 
                                                        {...field} 
                                                        value={field.value || ''} 
                                                        className="min-h-[100px] border-emerald-100 focus:ring-emerald-500 resize-none"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>

                            <Button 
                                type="submit" 
                                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all text-white h-16 text-xl font-black rounded-2xl shadow-xl shadow-emerald-200 disabled:opacity-50 disabled:grayscale"
                                disabled={isSubmitting || selectedIds.size === 0 || totalReceivedAmount === 0}
                            >
                                {isSubmitting ? (
                                    <div className="flex items-center gap-3">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        <span>RECORDING...</span>
                                    </div>
                                ) : (
                                    `RECEIVE : ${formatCurrency(totalReceivedAmount)}`
                                )}
                            </Button>
                        </form>
                    </Form>
                </aside>
            </div>
        </div>
    )
}
