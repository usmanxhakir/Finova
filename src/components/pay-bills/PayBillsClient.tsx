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

const payBillsSchema = z.object({
    contact_id: z.string().min(1, 'Vendor is required'),
    payment_date: z.string().min(1, 'Date is required'),
    amount: z.number().int().min(0, 'Amount must be at least 0'),
    payment_method: z.string().min(1, 'Payment method is required'),
    reference: z.string().optional().nullable(),
    account_id: z.string().min(1, 'Account is required'),
    notes: z.string().optional().nullable(),
    allocations: z.array(z.object({
        bill_id: z.string(),
        amount_applied: z.number().int().min(0)
    }))
})

type PayBillsFormValues = z.infer<typeof payBillsSchema>

interface Bill {
    id: string
    number: string
    issue_date: string
    due_date: string
    total: number
    balance: number
    contact_id: string
    contact_name: string
}

interface PayBillsClientProps {
    vendors: { id: string, name: string }[]
    accounts: any[]
}

export function PayBillsClient({ vendors, accounts }: PayBillsClientProps) {
    const router = useRouter()
    const [bills, setBills] = useState<Bill[]>([])
    const [isLoadingBills, setIsLoadingBills] = useState(false)
    const [selectedVendorId, setSelectedVendorId] = useState<string>('')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<PayBillsFormValues>({
        resolver: zodResolver(payBillsSchema),
        defaultValues: {
            contact_id: '',
            payment_date: format(new Date(), 'yyyy-MM-dd'),
            amount: 0,
            payment_method: 'EFT',
            account_id: accounts[0]?.id || '',
            allocations: []
        }
    })

    const { fields, replace, update } = useFieldArray({
        control: form.control,
        name: 'allocations'
    })

    // Fetch bills when vendor changes
    useEffect(() => {
        if (!selectedVendorId) {
            setBills([])
            replace([])
            setSelectedIds(new Set())
            form.setValue('contact_id', '')
            return
        }

        const fetchBills = async () => {
            try {
                setIsLoadingBills(true)
                const res = await fetch(`/api/bills/open?contactId=${selectedVendorId}`)
                if (!res.ok) throw new Error('Failed to fetch bills')
                const data = await res.json()
                setBills(data)
                form.setValue('contact_id', selectedVendorId)
                // Clear existing allocations
                replace([])
                setSelectedIds(new Set())
            } catch (error) {
                toast.error('Error loading bills')
            } finally {
                setIsLoadingBills(false)
            }
        }

        fetchBills()
    }, [selectedVendorId, replace, form])

    // Update total amount when allocations change
    const allocations = form.watch('allocations')
    const totalPaymentAmount = useMemo(() => {
        return allocations.reduce((sum, alloc) => sum + (alloc.amount_applied || 0), 0)
    }, [allocations])

    useEffect(() => {
        form.setValue('amount', totalPaymentAmount)
    }, [totalPaymentAmount, form])

    const toggleBill = (bill: Bill) => {
        const next = new Set(selectedIds)
        if (next.has(bill.id)) {
            next.delete(bill.id)
            const idx = fields.findIndex(f => f.bill_id === bill.id)
            if (idx !== -1) {
                // Remove allocation if bill is deselected
                const newAllocations = allocations.filter(a => a.bill_id !== bill.id)
                replace(newAllocations)
            }
        } else {
            next.add(bill.id)
            // Add allocation with full balance
            replace([...allocations, { bill_id: bill.id, amount_applied: bill.balance }])
        }
        setSelectedIds(next)
    }

    const toggleAll = () => {
        if (selectedIds.size === bills.length && bills.length > 0) {
            setSelectedIds(new Set())
            replace([])
        } else {
            const allIds = new Set(bills.map(b => b.id))
            setSelectedIds(allIds)
            replace(bills.map(b => ({ bill_id: b.id, amount_applied: b.balance })))
        }
    }

    const handleRowAmountChange = (billId: string, amountCents: number) => {
        const idx = allocations.findIndex(a => a.bill_id === billId)
        if (idx !== -1) {
            update(idx, { ...allocations[idx], amount_applied: amountCents })
        } else if (amountCents > 0) {
            // If they type an amount but it wasn't selected, select it? 
            // Better to only allow editing selected ones or auto-select on edit.
            const bill = bills.find(b => b.id === billId)
            if (bill) {
                setSelectedIds(prev => new Set(prev).add(billId))
                replace([...allocations, { bill_id: billId, amount_applied: amountCents }])
            }
        }
    }

    const onSubmit = async (values: PayBillsFormValues) => {
        if (values.allocations.length === 0) {
            toast.error('Please select at least one bill to pay')
            return
        }

        try {
            setIsSubmitting(true)
            const response = await fetch('/api/bills/pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to process payment')
            }

            toast.success('Payment recorded successfully')
            router.push('/bills')
            router.refresh()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-zinc-50/30">
            <header className="flex-shrink-0 flex items-center justify-between px-8 py-4 border-b bg-white z-20">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Pay Bills</h1>
                        <p className="text-sm text-zinc-500 font-medium">Record vendor payments and clear outstanding balances</p>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden p-6 gap-6">
                {/* Left panel — bill list */}
                <div className="flex-1 flex flex-col gap-6 min-w-0">
                    <Card className="border-none shadow-sm bg-white overflow-hidden flex flex-col h-full">
                        <div className="p-6 border-b flex flex-col gap-4 bg-zinc-50/50">
                            <div className="flex flex-col gap-2 max-w-md">
                                <Label htmlFor="vendor-select" className="text-sm font-semibold text-zinc-700">Vendor</Label>
                                <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                                    <SelectTrigger id="vendor-select" className="bg-white border-zinc-200">
                                        <SelectValue placeholder="Select a vendor..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vendors.map(v => (
                                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                    <TableRow className="bg-zinc-50/50 border-b">
                                        <TableHead className="w-[50px] pl-6">
                                            <Checkbox 
                                                checked={selectedIds.size === bills.length && bills.length > 0}
                                                onCheckedChange={toggleAll}
                                                disabled={bills.length === 0}
                                            />
                                        </TableHead>
                                        <TableHead className="font-semibold text-zinc-700">Bill #</TableHead>
                                        <TableHead className="font-semibold text-zinc-700">Due Date</TableHead>
                                        <TableHead className="text-right font-semibold text-zinc-700">Balance</TableHead>
                                        <TableHead className="text-right font-semibold text-zinc-700 pr-6 w-[180px]">Payment</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingBills ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-64 text-center">
                                                <div className="flex flex-col items-center gap-2 text-zinc-400">
                                                    <Loader2 className="h-8 w-8 animate-spin" />
                                                    <span className="font-mono text-sm">Searching for open bills...</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : !selectedVendorId ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-64 text-center">
                                                <div className="flex flex-col items-center gap-4 text-zinc-400 px-12">
                                                    <div className="h-16 w-16 rounded-full bg-zinc-100 flex items-center justify-center">
                                                        <Search className="h-8 w-8" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="font-bold text-zinc-600">No vendor selected</p>
                                                        <p className="text-sm max-w-[240px]">Select a vendor from the dropdown above to view their outstanding bills.</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : bills.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-64 text-center text-zinc-500 font-mono">
                                                No open bills found for this vendor.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        bills.map((bill) => {
                                            const allocation = allocations.find(a => a.bill_id === bill.id)
                                            const isSelected = selectedIds.has(bill.id)
                                            return (
                                                <TableRow 
                                                    key={bill.id}
                                                    className={`${isSelected ? "bg-violet-50/30" : "hover:bg-zinc-50/50"} transition-colors`}
                                                >
                                                    <TableCell className="pl-6">
                                                        <Checkbox 
                                                            checked={isSelected}
                                                            onCheckedChange={() => toggleBill(bill)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium text-zinc-900">{bill.number}</TableCell>
                                                    <TableCell className="text-zinc-600">{formatDate(bill.due_date)}</TableCell>
                                                    <TableCell className="text-right font-medium text-zinc-900">{formatCurrency(bill.balance)}</TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <div className="relative inline-block w-full">
                                                            <span className="absolute left-3 top-2.5 text-xs text-zinc-400">$</span>
                                                            <Input 
                                                                type="number" 
                                                                step="0.01"
                                                                className={`pl-6 text-right h-9 border-zinc-200 focus-visible:ring-violet-500 ${!isSelected && 'opacity-50'}`}
                                                                value={allocation ? allocation.amount_applied / 100 : ''}
                                                                placeholder="0.00"
                                                                onChange={(e) => {
                                                                    const val = Math.round(parseFloat(e.target.value || '0') * 100)
                                                                    handleRowAmountChange(bill.id, val)
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
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

                {/* Right panel — payment details */}
                <aside className="w-[420px] flex-shrink-0 flex flex-col gap-6 overflow-y-auto pb-6 scrollbar-hide">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-zinc-900 text-white p-6">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg font-bold">Payment Summary</CardTitle>
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
                                                <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">Payment Account</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-12 border-zinc-200">
                                                            <SelectValue placeholder="Select account" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {accounts.map(acc => (
                                                            <SelectItem key={acc.id} value={acc.id}>
                                                                <div className="flex flex-col items-start py-0.5">
                                                                    <span className="font-semibold">{acc.name}</span>
                                                                    <span className="text-[10px] text-zinc-400 font-mono tracking-tighter">CODE: {acc.code} • {acc.sub_type.toUpperCase()}</span>
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
                                                    <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">Date</FormLabel>
                                                    <FormControl>
                                                        <Input type="date" {...field} className="h-12 border-zinc-200" />
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
                                                    <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">Method</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-12 border-zinc-200">
                                                                <SelectValue placeholder="Method" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="EFT">EFT / Wire</SelectItem>
                                                            <SelectItem value="Check">Check</SelectItem>
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
                                                <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500 group-hover:text-violet-600 transition-colors">Total Payment Amount</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-zinc-400">$</span>
                                                        <Input 
                                                            readOnly
                                                            className="pl-10 text-3xl font-black h-20 border-2 border-zinc-100 bg-zinc-50/50 text-zinc-900 rounded-2xl shadow-inner cursor-default"
                                                            value={formatCurrency(field.value).replace('$', '')}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <p className="text-[10px] text-zinc-400 font-medium italic">Auto-calculated from items selected in the table</p>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="reference"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">Reference / Memo</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Check #, Ref #" {...field} value={field.value || ''} className="h-12 border-zinc-200" />
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
                                                <FormLabel className="text-xs uppercase tracking-wider font-bold text-zinc-500">Notes</FormLabel>
                                                <FormControl>
                                                    <Textarea 
                                                        placeholder="Internal notes for this payment..." 
                                                        {...field} 
                                                        value={field.value || ''} 
                                                        className="min-h-[100px] border-zinc-200 resize-none"
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
                                className="w-full bg-violet-600 hover:bg-violet-700 active:scale-[0.98] transition-all text-white h-16 text-xl font-black rounded-2xl shadow-xl shadow-violet-200 disabled:opacity-50 disabled:grayscale"
                                disabled={isSubmitting || selectedIds.size === 0 || totalPaymentAmount === 0}
                            >
                                {isSubmitting ? (
                                    <div className="flex items-center gap-3">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        <span>PROCESSING</span>
                                    </div>
                                ) : (
                                    `POST PAYMENT : ${formatCurrency(totalPaymentAmount)}`
                                )}
                            </Button>
                        </form>
                    </Form>
                </aside>
            </div>
        </div>
    )
}
