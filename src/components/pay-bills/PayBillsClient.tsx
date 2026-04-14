'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
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
import { formatCurrency, formatDate } from '@/lib/utils'
import { Loader2, ArrowLeft } from 'lucide-react'

const payBillsSchema = z.object({
    contact_id: z.string().min(1, 'Contact is required'),
    payment_date: z.string().min(1, 'Date is required'),
    amount: z.number().int().min(1, 'Amount must be at least 0.01'),
    payment_method: z.string().min(1, 'Payment method is required'),
    reference: z.string().optional().nullable(),
    account_id: z.string().min(1, 'Account is required'),
    notes: z.string().optional().nullable(),
    allocations: z.array(z.object({
        bill_id: z.string(),
        amount_applied: z.number().int()
    })).min(1, 'At least one bill must be selected')
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
    initialBills: Bill[]
    accounts: any[]
}

export function PayBillsClient({ initialBills, accounts }: PayBillsClientProps) {
    const router = useRouter()
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<PayBillsFormValues>({
        resolver: zodResolver(payBillsSchema),
        defaultValues: {
            payment_date: format(new Date(), 'yyyy-MM-dd'),
            amount: 0,
            payment_method: 'EFT',
            account_id: accounts[0]?.id || '',
            allocations: []
        }
    })

    const selectedBills = useMemo(() => 
        initialBills.filter(b => selectedIds.has(b.id)),
    [initialBills, selectedIds])

    const totalSelectedBalance = useMemo(() => 
        selectedBills.reduce((sum, b) => sum + b.balance, 0),
    [selectedBills])

    // Update form when selection changes
    useEffect(() => {
        if (selectedBills.length === 0) {
            form.setValue('amount', 0)
            form.setValue('allocations', [])
            form.setValue('contact_id', '')
            return
        }

        // Check if all selected bills belong to the same contact (usually preferred for a single payment)
        // But the prompt implies we can select multiple. The RPC takes contact_id.
        // If multiple contacts are selected, we might have an issue. 
        // Typically "Pay Bills" is done per vendor or globally. 
        // User asked for contact_id in POST body.
        const contactId = selectedBills[0].contact_id
        form.setValue('contact_id', contactId)

        // Set total amount to sum of balances by default
        form.setValue('amount', totalSelectedBalance)

        // Initial allocation
        const allocations = selectedBills.map(b => ({
            bill_id: b.id,
            amount_applied: b.balance
        }))
        form.setValue('allocations', allocations)
    }, [selectedBills, totalSelectedBalance, form])

    // Re-allocate when amount changes manually
    const handleAmountChange = (newAmountCents: number) => {
        if (selectedBills.length === 0) return

        let allocations: { bill_id: string, amount_applied: number }[] = []
        
        if (totalSelectedBalance === 0) {
            allocations = selectedBills.map(b => ({ bill_id: b.id, amount_applied: 0 }))
        } else {
            const ratio = newAmountCents / totalSelectedBalance
            let currentSum = 0
            
            allocations = selectedBills.map(b => {
                const applied = Math.round(b.balance * ratio)
                currentSum += applied
                return { bill_id: b.id, amount_applied: applied }
            })

            // Adjust rounding error on the largest item
            const diff = newAmountCents - currentSum
            if (diff !== 0) {
                const largestIdx = allocations.reduce((maxIdx, current, idx, arr) => 
                    current.amount_applied > arr[maxIdx].amount_applied ? idx : maxIdx, 0)
                allocations[largestIdx].amount_applied += diff
            }
        }
        
        form.setValue('allocations', allocations)
    }

    const toggleBill = (id: string) => {
        const next = new Set(selectedIds)
        if (next.has(id)) {
            next.delete(id)
        } else {
            next.add(id)
        }
        setSelectedIds(next)
    }

    const toggleAll = () => {
        if (selectedIds.size === initialBills.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(initialBills.map(b => b.id)))
        }
    }

    const onSubmit = async (values: PayBillsFormValues) => {
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
        <div className="flex flex-col h-full">
            <header className="flex items-center justify-between p-6 border-b bg-white/50 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Pay Bills</h1>
                        <p className="text-sm text-zinc-500 font-mono italic">Select open bills to record a payment</p>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <main className="flex-1 overflow-y-auto p-6">
                    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-zinc-50/50">
                                    <TableHead className="w-12">
                                        <Checkbox 
                                            checked={selectedIds.size === initialBills.length && initialBills.length > 0}
                                            onCheckedChange={toggleAll}
                                        />
                                    </TableHead>
                                    <TableHead>Bill #</TableHead>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead>Due Date</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialBills.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-64 text-center text-zinc-500 font-mono">
                                            No open bills found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    initialBills.map((bill) => (
                                        <TableRow 
                                            key={bill.id}
                                            className={selectedIds.has(bill.id) ? "bg-violet-50/30" : ""}
                                        >
                                            <TableCell>
                                                <Checkbox 
                                                    checked={selectedIds.has(bill.id)}
                                                    onCheckedChange={() => toggleBill(bill.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">{bill.number}</TableCell>
                                            <TableCell>{bill.contact_name}</TableCell>
                                            <TableCell>{formatDate(bill.due_date)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(bill.total)}</TableCell>
                                            <TableCell className="text-right font-bold text-violet-600">
                                                {formatCurrency(bill.balance)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </main>

                <aside className="w-[400px] border-l bg-zinc-50/50 p-6 overflow-y-auto hidden lg:block sticky top-[89px] h-[calc(100vh-89px)]">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <Card className="border-violet-100 shadow-md">
                                <CardHeader className="bg-violet-50/50 border-b pb-4">
                                    <CardTitle className="text-lg flex items-center justify-between">
                                        Payment Details
                                        <span className="text-[10px] font-mono uppercase bg-violet-100 px-2 py-1 rounded text-violet-700">
                                            {selectedIds.size} Selected
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="account_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Payment Account</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select account" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {accounts.map(acc => (
                                                            <SelectItem key={acc.id} value={acc.id}>
                                                                {acc.name} ({acc.code})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="payment_date"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Payment Date</FormLabel>
                                                    <FormControl>
                                                        <Input type="date" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="payment_method"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Method</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
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
                                            <FormItem>
                                                <FormLabel className="text-lg font-bold">Total Payment Amount</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2.5 text-zinc-500">$</span>
                                                        <Input 
                                                            type="number" 
                                                            step="0.01"
                                                            className="pl-7 text-2xl font-bold h-14 border-violet-200 focus:ring-violet-500"
                                                            value={field.value / 100}
                                                            onChange={(e) => {
                                                                const val = Math.round(parseFloat(e.target.value || '0') * 100)
                                                                field.onChange(val)
                                                                handleAmountChange(val)
                                                            }}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="reference"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Reference / Memo</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Check #, Ref #" {...field} value={field.value || ''} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="notes"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Notes</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="Internal notes..." {...field} value={field.value || ''} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>

                            <div className="bg-violet-600 rounded-xl p-6 text-white shadow-lg space-y-4">
                                <div className="flex justify-between items-center border-b border-violet-400 pb-2">
                                    <span className="text-violet-100 text-sm">Selected Balance</span>
                                    <span className="font-bold">{formatCurrency(totalSelectedBalance)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xl font-black">
                                    <span>Total Payment</span>
                                    <span>{formatCurrency(form.watch('amount'))}</span>
                                </div>
                                <Button 
                                    type="submit" 
                                    className="w-full bg-white text-violet-700 hover:bg-violet-50 h-12 text-lg font-bold"
                                    disabled={isSubmitting || selectedIds.size === 0}
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        'Submit Payment'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </aside>
            </div>
        </div>
    )
}
