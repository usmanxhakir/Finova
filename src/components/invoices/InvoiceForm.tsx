'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
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
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn, formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { Database } from '@/types/database.types'

const lineItemSchema = z.object({
    id: z.string().optional(),
    item_id: z.string().optional().nullable(),
    description: z.string().min(1, 'Description is required'),
    quantity: z.number().min(0.01, 'Quantity must be at least 0.01'),
    rate: z.number().min(0, 'Rate must be at least 0'),
    amount: z.number(),
    account_id: z.string().min(1, 'Account is required'),
    tax_rate: z.number().min(0).max(100),
})

const invoiceSchema = z.object({
    number: z.string().optional(),
    contact_id: z.string().min(1, 'Customer is required'),
    customer_reference: z.string().optional().nullable(),
    issue_date: z.string().min(1, 'Issue date is required'),
    due_date: z.string().min(1, 'Due date is required'),
    notes: z.string().optional().nullable(),
    terms: z.string().optional().nullable(),
    footer: z.string().optional().nullable(),
    line_items: z.array(lineItemSchema).min(1, 'At least one line item is required'),
    subtotal: z.number().default(0),
    tax_amount: z.number().default(0),
    discount_amount: z.number().default(0),
    total: z.number().default(0),
})

type InvoiceFormValues = z.infer<typeof invoiceSchema>

interface InvoiceFormProps {
    initialData?: any
    customers: any[]
    items: any[]
    accounts: any[]
    nextNumber: string
    onSave: (data: InvoiceFormValues, isFinalize: boolean) => Promise<void>
    isLoading?: boolean
    isLocked?: boolean
    /** Called when the user wants to navigate back (after dirty-check passes) */
    onBack?: () => void
}

export function InvoiceForm({
    initialData,
    customers,
    items,
    accounts,
    nextNumber,
    onSave,
    isLoading,
    isLocked = false,
    onBack,
}: InvoiceFormProps) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showLeaveDialog, setShowLeaveDialog] = useState(false)
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)

    const form = useForm<InvoiceFormValues>({
        resolver: zodResolver(invoiceSchema) as any,
        defaultValues: initialData || {
            number: '',
            contact_id: '',
            customer_reference: '',
            issue_date: new Date().toISOString().split('T')[0],
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            notes: '',
            terms: '',
            footer: '',
            line_items: [{ description: '', quantity: 1, rate: 0, amount: 0, account_id: '', tax_rate: 0 }],
            subtotal: 0,
            tax_amount: 0,
            discount_amount: 0,
            total: 0,
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'line_items',
    })

    const onItemSelect = useCallback((index: number, val: string) => {
        const item = items.find(i => i.id === val)
        if (item) {
            const rate = Number(item.default_rate) / 100
            form.setValue(`line_items.${index}.item_id`, item.id)
            form.setValue(`line_items.${index}.description`, item.description || item.name)
            form.setValue(`line_items.${index}.rate`, rate)
            form.setValue(`line_items.${index}.account_id`, item.income_account_id)
            const qty = Number(form.getValues(`line_items.${index}.quantity`))
            form.setValue(`line_items.${index}.amount`, Number((qty * rate).toFixed(2)))
        }
    }, [items, form])

    const watchLineItems = useWatch({
        control: form.control,
        name: 'line_items',
    })
    const watchDiscount = useWatch({
        control: form.control,
        name: 'discount_amount',
    })

    const { subtotal, taxAmount, total } = useMemo(() => {
        const lineItems = watchLineItems || []
        const sub = lineItems.reduce((acc, item) => acc + (Number(item?.quantity || 0) * Number(item?.rate || 0)), 0)
        const tax = lineItems.reduce((acc, item) => {
            const itemAmount = Number(item?.quantity || 0) * Number(item?.rate || 0)
            const rate = Number(item?.tax_rate || 0)
            return acc + (itemAmount * (rate / 100))
        }, 0)
        const disc = Number(watchDiscount || 0)
        return {
            subtotal: sub,
            taxAmount: tax,
            total: sub + tax - disc
        }
    }, [watchLineItems, watchDiscount])

    useEffect(() => {
        form.setValue('subtotal', subtotal)
        form.setValue('tax_amount', taxAmount)
        form.setValue('total', total)
    }, [subtotal, taxAmount, total, form])

    // Browser navigation protection (tab close / reload)
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (form.formState.isDirty) {
                e.preventDefault()
            }
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [form.formState.isDirty])

    const handleBack = () => {
        if (form.formState.isDirty) {
            setShowLeaveDialog(true)
        } else {
            navigateBack()
        }
    }

    const navigateBack = () => {
        if (onBack) {
            onBack()
        } else {
            router.push('/invoices')
        }
    }

    const onSubmit = async (values: InvoiceFormValues, isFinalize: boolean) => {
        try {
            setIsSubmitting(true)
            await onSave(values, isFinalize)
        } catch (error: any) {
            if (error.message === 'DUPLICATE_NUMBER') {
                setShowDuplicateDialog(true)
            } else {
                toast.error(error.message || 'Failed to save invoice')
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <>
            <Form {...form}>
                <form className="space-y-8">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        <FormField
                            control={form.control as any}
                            name="contact_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Customer</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a customer" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {customers.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormItem className="flex flex-col justify-end pb-1">
                            <FormLabel className="mb-2">Invoice #</FormLabel>
                            <div className="h-10 flex items-center">
                                {form.getValues('number') ? (
                                    <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md font-mono font-medium border border-zinc-200 dark:border-zinc-700">
                                        {form.getValues('number')}
                                    </span>
                                ) : (
                                    <span className="text-sm text-muted-foreground italic">
                                        Auto-assigned on save
                                    </span>
                                )}
                            </div>
                        </FormItem>
                        <FormField
                            control={form.control as any}
                            name="customer_reference"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Customer Reference</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. PO-1234 or customer order number" {...field} value={field.value || ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control as any}
                            name="issue_date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Issue Date</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control as any}
                            name="due_date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Due Date</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="rounded-md border p-4">
                        <h3 className="mb-4 text-lg font-medium">Line Items</h3>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[300px]">Item / Description</TableHead>
                                    <TableHead className="w-[100px]">Qty</TableHead>
                                    <TableHead className="w-[150px]">Rate</TableHead>
                                    <TableHead className="w-[200px]">Account</TableHead>
                                    <TableHead className="text-right w-[150px]">Amount</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell>
                                            <div className="flex flex-col gap-2">
                                                <Select
                                                    onValueChange={(val) => onItemSelect(index, val)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Item (Optional)" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {items.map((i) => (
                                                            <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormField
                                                    control={form.control as any}
                                                    name={`line_items.${index}.description`}
                                                    render={({ field }) => (
                                                        <Input {...field} value={field.value || ''} placeholder="Description" />
                                                    )}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <FormField
                                                control={form.control as any}
                                                name={`line_items.${index}.quantity`}
                                                render={({ field }) => (
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        {...field}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0
                                                            field.onChange(val)
                                                            const rate = Number(form.getValues(`line_items.${index}.rate`))
                                                            form.setValue(`line_items.${index}.amount`, Number((val * rate).toFixed(2)))
                                                        }}
                                                    />
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormField
                                                control={form.control as any}
                                                name={`line_items.${index}.rate`}
                                                render={({ field }) => (
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        {...field}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0
                                                            field.onChange(val)
                                                            const qty = Number(form.getValues(`line_items.${index}.quantity`))
                                                            form.setValue(`line_items.${index}.amount`, Number((qty * val).toFixed(2)))
                                                        }}
                                                    />
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormField
                                                control={form.control as any}
                                                name={`line_items.${index}.account_id`}
                                                render={({ field }) => (
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select Account" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {accounts.filter(a => a.type === 'revenue').map((a) => (
                                                                <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right align-top pt-4">
                                            {formatCurrency((Number(form.watch(`line_items.${index}.amount`)) || 0) * 100)}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => remove(index)}
                                                disabled={fields.length === 1}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() => append({ description: '', quantity: 1, rate: 0, amount: 0, account_id: '', tax_rate: 0 })} // Added tax_rate default
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Line Item
                        </Button>
                    </div>

                    <div className="flex flex-col gap-6 lg:flex-row">
                        <div className="flex-1 space-y-4">
                            <FormField
                                control={form.control as any}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notes</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Notes for the customer" className="h-24" {...field} value={field.value || ''} disabled={isLocked} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control as any}
                                name="terms"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Terms & Conditions</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Terms and conditions" className="h-24" {...field} value={field.value || ''} disabled={isLocked} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="w-full lg:w-[350px] space-y-4 bg-zinc-50 dark:bg-zinc-900 p-6 rounded-lg">
                            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                                <span>Subtotal</span>
                                <span>{formatCurrency(subtotal * 100)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-600 dark:text-zinc-400">Discount</span>
                                <div className="flex items-center w-32">
                                    <Input
                                        type="number"
                                        className="h-8 text-right"
                                        {...form.register('discount_amount', {
                                            valueAsNumber: true,
                                            onChange: (e) => {
                                                form.setValue('discount_amount', parseFloat(e.target.value) || 0)
                                            }
                                        })}
                                        disabled={isLocked}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-600 dark:text-zinc-400">Tax</span>
                                <span className="font-medium">{formatCurrency(taxAmount * 100)}</span>
                            </div>
                            <div className="pt-4 border-t flex items-center justify-between font-bold text-lg">
                                <span>Total</span>
                                <span className="text-primary">{formatCurrency(total * 100)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-t pt-8">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleBack}
                            disabled={isSubmitting}
                        >
                            ← Back to Invoices
                        </Button>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={form.handleSubmit((values) => onSubmit(values as InvoiceFormValues, false) as any)}
                                disabled={isSubmitting || isLoading || isLocked}
                            >
                                Save as Draft
                            </Button>
                            <Button
                                type="button"
                                onClick={form.handleSubmit((values) => onSubmit(values as InvoiceFormValues, true) as any)}
                                disabled={isSubmitting || isLoading || isLocked}
                            >
                                {initialData?.status === 'draft' ? 'Finalize & Post' : 'Save & Finalize'}
                            </Button>
                        </div>
                    </div>
                </form>
            </Form>

            <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have unsaved changes that will be lost. Are you sure you want to leave?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Stay</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={navigateBack}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Leave Without Saving
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Invoice Number Already Exists</AlertDialogTitle>
                        <AlertDialogDescription>
                            Invoice number <strong>{form.getValues('number')}</strong> is already in use.
                            Please update the Invoice # field to a unique number and try again.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setShowDuplicateDialog(false)}>
                            Got it
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
