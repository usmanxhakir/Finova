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
import { Trash2 } from 'lucide-react'

const paymentSchema = z.object({
    date: z.string().min(1, 'Date is required'),
    amount: z.coerce.number().min(0.01, 'Amount must be greater than zero'),
    account_id: z.string().min(1, 'Payment account is required'),
    reference: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

interface EditBillPaymentModalProps {
    payment: any
    billNumber: string
    bankAccounts: any[]
    onEdit: (values: any) => Promise<void>
    onDelete: () => Promise<void>
    trigger?: React.ReactNode
}

export function EditBillPaymentModal({ payment, billNumber, bankAccounts, onEdit, onDelete, trigger }: EditBillPaymentModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const form = useForm<PaymentFormValues>({
        resolver: zodResolver(paymentSchema) as any,
        defaultValues: {
            date: payment.date || new Date().toISOString().split('T')[0],
            amount: Number(payment.amount || 0) / 100,
            account_id: payment.account_id || bankAccounts[0]?.id || '',
            reference: payment.reference || '',
            notes: payment.notes || '',
        },
    })

    const onSubmitHandler = async (values: PaymentFormValues) => {
        try {
            setIsSubmitting(true)
            await onEdit(values)
            toast.success('Payment updated successfully')
            setIsOpen(false)
        } catch (error: any) {
            toast.error(error.message || 'Failed to update payment')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this payment? This action cannot be undone.')) return
        try {
            setIsDeleting(true)
            await onDelete()
            toast.success('Payment deleted successfully')
            setIsOpen(false)
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete payment')
        } finally {
            setIsDeleting(false)
        }
    }

    // Reset form when modal opens with latest payment data
    const handleOpenChange = (open: boolean) => {
        if (open) {
            form.reset({
                date: payment.date || new Date().toISOString().split('T')[0],
                amount: Number(payment.amount || 0) / 100,
                account_id: payment.account_id || bankAccounts[0]?.id || '',
                reference: payment.reference || '',
                notes: payment.notes || '',
            })
        }
        setIsOpen(open)
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline" size="sm">Edit</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Payment</DialogTitle>
                    <DialogDescription>
                        Edit payment for Bill {billNumber}.
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
                        <DialogFooter className="flex justify-between items-center w-full">
                            <Button 
                                type="button" 
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={handleDelete}
                                disabled={isSubmitting || isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : <><Trash2 className="w-4 h-4 mr-2"/> Delete</>}
                            </Button>
                            <Button type="submit" disabled={isSubmitting || isDeleting}>
                                {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
