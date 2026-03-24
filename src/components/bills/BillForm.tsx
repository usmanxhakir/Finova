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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/utils'
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

const billSchema = z.object({
    number: z.string().min(1, 'Bill number is required'),
    contact_id: z.string().min(1, 'Vendor is required'),
    reference_number: z.string().optional().nullable(),
    issue_date: z.string().min(1, 'Issue date is required'),
    due_date: z.string().min(1, 'Due date is required'),
    notes: z.string().optional().nullable(),
    line_items: z.array(lineItemSchema).min(1, 'At least one line item is required'),
    subtotal: z.number().default(0),
    tax_amount: z.number().default(0),
    discount_amount: z.number().default(0),
    total: z.number().default(0),
})

type BillFormValues = z.infer<typeof billSchema>

interface BillFormProps {
    initialData?: any
    vendors: any[]
    items: any[]
    accounts: any[]
    nextNumber: string
    onSave: (data: BillFormValues, isFinalize: boolean) => Promise<void>
    isLoading?: boolean
    isLocked?: boolean
    onBack?: () => void
}

export function BillForm({
    initialData,
    vendors,
    items,
    accounts,
    nextNumber,
    onSave,
    isLoading,
    isLocked = false,
    onBack,
}: BillFormProps) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showLeaveDialog, setShowLeaveDialog] = useState(false)
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)

    const form = useForm<BillFormValues>({
        resolver: zodResolver(billSchema) as any,
        defaultValues: initialData || {
            number: nextNumber,
            contact_id: '',
            reference_number: '',
            issue_date: new Date().toISOString().split('T')[0],
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            notes: '',
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
            form.setValue(`line_items.${index}.account_id`, item.expense_account_id)
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

    // Browser navigation protection (tab close / reload) // Unsaved changes check
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
            router.push('/bills')
        }
    }

const onSubmit = async (values: BillFormValues, isFinalize: boolean) => {
    try {
        setIsSubmitting(true)
        await onSave(values, isFinalize)
    } catch (error: any) {
        if (error.message === 'DUPLICATE_NUMBER') {
            setShowDuplicateDialog(true)
        } else {
            toast.error(error.message || 'Failed to save bill')
        }
    } finally {
        setIsSubmitting(false)
    }
}

    // Filter expense related accounts
    const expenseAccounts = accounts.filter(a => a.type === 'expense' || a.type === 'cost_of_goods_sold' || a.type === 'asset' || a.type === 'liability')

    return (
        <>
            <Form {...form}>
                <form className="space-y-8">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                        <FormField
                            control={form.control as any}
                            name="contact_id"
                            render={({ field }) => (
                                <FormItem className="lg:col-span-2">
                                    <FormLabel>Vendor</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLocked}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a vendor" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {vendors.map((v) => (
                                                <SelectItem key={v.id} value={v.id}>
                                                    {v.name}
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
                            name="number"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bill #</FormLabel>
                                    <FormControl>
                                        <Input {...field} value={field.value || ''} disabled={isLocked} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control as any}
                            name="reference_number"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reference #</FormLabel>
                                    <FormControl>
                                        <Input {...field} value={field.value || ''} placeholder="Vendor Inv #" disabled={isLocked} />
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
                                        <Input type="date" {...field} disabled={isLocked} />
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
                                        <Input type="date" {...field} disabled={isLocked} />
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
                                    {!isLocked && <TableHead className="w-[50px]"></TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell>
                                            <div className="flex flex-col gap-2">
                                                <Select
                                                    disabled={isLocked}
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
                                                        <Input {...field} value={field.value || ''} placeholder="Description" disabled={isLocked} />
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
                                                        disabled={isLocked}
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
                                                        disabled={isLocked}
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
                                                    <Select onValueChange={field.onChange} value={field.value} disabled={isLocked}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select Account" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {expenseAccounts.map((a) => (
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
                                        {!isLocked && (
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
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {!isLocked && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-4"
                                onClick={() => append({ description: '', quantity: 1, rate: 0, amount: 0, account_id: '', tax_rate: 0 })}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Line Item
                            </Button>
                        )}
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
                                            <Textarea placeholder="Internal notes" className="h-24" {...field} value={field.value || ''} disabled={isLocked} />
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
                            ← Back to Bills
                        </Button>
                        <div className="flex justify-end gap-2">
                            {!isLocked && (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={form.handleSubmit((values) => onSubmit(values as BillFormValues, false) as any)}
                                        disabled={isSubmitting || isLoading}
                                    >
                                        Save as Draft
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={form.handleSubmit((values) => onSubmit(values as BillFormValues, true) as any)}
                                        disabled={isSubmitting || isLoading}
                                    >
                                        {initialData?.status === 'draft' ? 'Finalize & Post' : 'Save & Finalize'}
                                    </Button>
                                </>
                            )}
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
                        <AlertDialogTitle>Bill Number Already Exists</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bill number <strong>{form.getValues('number')}</strong> is already in use.
                            Please update the Bill # field to a unique number and try again.
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
