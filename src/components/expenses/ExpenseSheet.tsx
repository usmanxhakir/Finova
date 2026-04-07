'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format } from 'date-fns'
import { CalendarIcon, Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
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
import { cn } from '@/lib/utils'
import { handleSaveExpense, handleDeleteExpense } from '@/app/(app)/expenses/actions'
import { toast } from 'sonner'

const expenseSchema = z.object({
    id: z.string().optional(),
    date: z.date(),
    payee: z.string().min(1, "Payee is required"),
    expense_account_id: z.string().min(1, "Expense account is required"),
    payment_account_id: z.string().min(1, "Payment account is required"),
    amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: "Amount must be a positive number",
    }),
    notes: z.string().optional(),
    receipt: z.any().optional(),
    receipt_url: z.string().optional(),
})

type ExpenseFormValues = z.infer<typeof expenseSchema>

interface ExpenseSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    expense?: any // For editing
    accounts: any[]
}

export function ExpenseSheet({
    open,
    onOpenChange,
    expense,
    accounts,
}: ExpenseSheetProps) {
    const [submitting, setSubmitting] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    const form = useForm<ExpenseFormValues>({
        resolver: zodResolver(expenseSchema) as any,
        defaultValues: expense ? {
            id: expense.id,
            date: new Date(expense.date),
            payee: expense.payee,
            expense_account_id: expense.expense_account_id,
            payment_account_id: expense.payment_account_id,
            amount: (expense.amount / 100).toString(),
            notes: expense.notes || "",
            receipt_url: expense.receipt_url || "",
        } : {
            date: new Date(),
            payee: "",
            expense_account_id: "",
            payment_account_id: "",
            amount: "",
            notes: "",
        },
    })

    const onSubmit = async (values: ExpenseFormValues) => {
        setSubmitting(true)
        try {
            const formData = new FormData()
            if (values.id) formData.append('id', values.id)
            formData.append('date', format(values.date, 'yyyy-MM-dd'))
            formData.append('payee', values.payee)
            formData.append('expense_account_id', values.expense_account_id)
            formData.append('payment_account_id', values.payment_account_id)
            formData.append('amount', values.amount)
            formData.append('notes', values.notes || '')
            if (selectedFile) formData.append('receipt', selectedFile)
            if (values.receipt_url) formData.append('receipt_url', values.receipt_url)

            const result = await handleSaveExpense(formData)
            if (result.success) {
                toast.success(values.id ? 'Expense updated' : 'Expense recorded')
                onOpenChange(false)
                form.reset()
                setSelectedFile(null)
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to save expense')
        } finally {
            setSubmitting(false)
        }
    }

    const onVoid = async () => {
        if (!expense?.id) return
        setSubmitting(true)
        try {
            const result = await handleDeleteExpense(expense.id)
            if (result.success) {
                toast.success('Expense voided successfully')
                onOpenChange(false)
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to void expense')
        } finally {
            setSubmitting(false)
        }
    }

    const expenseAccounts = accounts.filter(a =>
        ['expense', 'cost_of_goods_sold', 'other_expense'].includes(a.sub_type)
    )

    const paymentAccounts = accounts.filter(a =>
        ['bank', 'cash', 'credit_card'].includes(a.sub_type)
    )

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-md overflow-y-auto p-6">
                <SheetHeader className="mb-6">
                    <SheetTitle>{expense ? 'Edit Expense' : 'New Expense'}</SheetTitle>
                    <SheetDescription>
                        Record a direct expense without an Accounts Payable step.
                    </SheetDescription>
                </SheetHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full pl-3 text-left font-normal",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "PPP")
                                                    ) : (
                                                        <span>Pick a date</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                disabled={(date) =>
                                                    date > new Date() || date < new Date("1900-01-01")
                                                }
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="payee"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Payee</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Uber, Rent, etc." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="payment_account_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Payment Account</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select payment account" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {paymentAccounts.map((account) => (
                                                <SelectItem key={account.id} value={account.id}>
                                                    {account.code} - {account.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="expense_account_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Expense Account</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select expense account" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {expenseAccounts.map((account) => (
                                                <SelectItem key={account.id} value={account.id}>
                                                    {account.code} - {account.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                            <Input
                                                className="pl-7"
                                                placeholder="0.00"
                                                {...field}
                                            />
                                        </div>
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
                                        <Textarea
                                            placeholder="Description of the expense"
                                            className="resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-2">
                            <FormLabel>Receipt</FormLabel>
                            {form.getValues('receipt_url') && !selectedFile ? (
                                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                                    <span className="text-xs truncate flex-1">Existing receipt</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => form.setValue('receipt_url', '')}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        className="hidden"
                                        id="receipt-upload"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) setSelectedFile(file)
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full flex gap-2"
                                        onClick={() => document.getElementById('receipt-upload')?.click()}
                                    >
                                        <Upload className="h-4 w-4" />
                                        {selectedFile ? selectedFile.name : 'Upload Receipt'}
                                    </Button>
                                    {selectedFile && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setSelectedFile(null)}
                                        >
                                            <X className="h-4 w-4 text-destructive" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center pt-4">
                            {expense && expense.status !== 'void' ? (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button type="button" variant="ghost" className="text-destructive hover:text-white hover:bg-destructive" disabled={submitting}>
                                            Void Expense
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Void this Expense?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action is irreversible. Voiding this expense will reverse associated journal entries (if implemented) and cannot be undone. Are you sure?
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
                            ) : <div />}
                            <div className="flex gap-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                    disabled={submitting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={submitting || expense?.status === 'void'}
                                >
                                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {expense ? 'Update Expense' : 'Save Expense'}
                                </Button>
                            </div>
                        </div>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    )
}
