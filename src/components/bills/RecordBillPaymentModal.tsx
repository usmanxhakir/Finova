'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/utils'

const paymentSchema = z.object({
    date: z.string().min(1, 'Date is required'),
    amount: z.coerce.number().min(1, 'Amount must be greater than zero'),
    account_id: z.string().min(1, 'Payment account is required'),
    reference: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

interface RecordBillPaymentModalProps {
    bill: any
    bankAccounts: any[]
    onRecord: (values: any) => Promise<void>
    onSuccess?: () => void
    trigger?: React.ReactNode
}

export function RecordBillPaymentModal({ bill, bankAccounts, onRecord, onSuccess, trigger }: RecordBillPaymentModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<PaymentFormValues>({
        resolver: zodResolver(paymentSchema) as any,
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            amount: Number((bill as any).amount_due || 0) / 100,
            account_id: bankAccounts[0]?.id || '',
            reference: '',
            notes: '',
        },
    })

    const onSubmitHandler = async (values: PaymentFormValues) => {
        try {
            setIsSubmitting(true)
            await onRecord(values)
            toast.success('Payment recorded successfully')
            setIsOpen(false)
            if (onSuccess) {
                onSuccess()
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to record payment')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline">Record Payment</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Record Payment</DialogTitle>
                    <DialogDescription>
                        Record a payment for Bill {(bill as any).number}.
                        Current balance due: {formatCurrency(Number((bill as any).amount_due || 0))}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmitHandler as any)} className="space-y-4 py-4">
                        <FormField
                            control={form.control as any}
                            name="date"
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
                            control={form.control as any}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control as any}
                            name="account_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Pay From</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select bank account" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {bankAccounts.map((a) => (
                                                <SelectItem key={a.id} value={a.id}>
                                                    {a.code} - {a.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control as any}
                            name="reference"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reference / Transaction #</FormLabel>
                                    <FormControl>
                                        <Input {...field} value={field.value || ''} placeholder="Check #, Wire ID, etc." />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control as any}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} value={field.value || ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Recording...' : 'Record Payment'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
