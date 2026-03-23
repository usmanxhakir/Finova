'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { 
    Sheet, 
    SheetContent, 
    SheetHeader, 
    SheetTitle, 
    SheetDescription,
    SheetFooter
} from '@/components/ui/sheet'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Lock } from 'lucide-react'

const accountSchema = z.object({
    code: z.string().min(1, 'Account code is required'),
    name: z.string().min(1, 'Account name is required'),
    type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
    sub_type: z.string().min(1, 'Account sub-type is required'),
    description: z.string().optional(),
    parent_account_id: z.string().nullable().optional(),
    is_active: z.boolean().default(true),
})

type AccountFormValues = z.infer<typeof accountSchema>

const SUB_TYPE_OPTIONS: Record<string, { label: string, value: string }[]> = {
    asset: [
        { label: 'Bank', value: 'bank' },
        { label: 'Cash', value: 'cash' },
        { label: 'Accounts Receivable', value: 'accounts_receivable' },
        { label: 'Other Current Asset', value: 'other_current_asset' },
        { label: 'Fixed Asset', value: 'fixed_asset' },
        { label: 'Other Asset', value: 'other_asset' },
    ],
    liability: [
        { label: 'Accounts Payable', value: 'accounts_payable' },
        { label: 'Credit Card', value: 'credit_card' },
        { label: 'Other Current Liability', value: 'other_current_liability' },
        { label: 'Long Term Liability', value: 'long_term_liability' },
    ],
    equity: [
        { label: 'Equity', value: 'equity' },
    ],
    revenue: [
        { label: 'Income', value: 'income' },
        { label: 'Other Income', value: 'other_income' },
    ],
    expense: [
        { label: 'Cost of Goods Sold', value: 'cost_of_goods_sold' },
        { label: 'Expense', value: 'expense' },
        { label: 'Other Expense', value: 'other_expense' },
    ]
}

interface AccountSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    account?: any
    onSuccess: () => void
    accounts?: any[] // To select parent accounts
}

export function AccountSheet({ 
    open, 
    onOpenChange, 
    account, 
    onSuccess,
    accounts = []
}: AccountSheetProps) {
    const [loading, setLoading] = useState(false)
    const supabase = createClient()
    const isEdit = !!account
    const isSystem = account?.is_system

    const form = useForm<AccountFormValues>({
        resolver: zodResolver(accountSchema as any),
        defaultValues: {
            code: '',
            name: '',
            type: 'asset',
            sub_type: '',
            description: '',
            parent_account_id: null,
            is_active: true,
        }
    })

    const selectedType = form.watch('type')

    useEffect(() => {
        if (account) {
            form.reset({
                code: account.code || '',
                name: account.name || '',
                type: account.type || 'asset',
                sub_type: account.sub_type || '',
                description: account.description || '',
                parent_account_id: account.parent_account_id || null,
                is_active: account.is_active ?? true,
            })
        } else {
            form.reset({
                code: '',
                name: '',
                type: 'asset',
                sub_type: '',
                description: '',
                parent_account_id: null,
                is_active: true,
            })
        }
    }, [account, form, open])

    // Reset sub_type when type changes if current sub_type isn't valid for new type
    useEffect(() => {
        if (!open) return
        const currentSubType = form.getValues('sub_type')
        const validOptions = SUB_TYPE_OPTIONS[selectedType] || []
        if (!validOptions.find(opt => opt.value === currentSubType)) {
            form.setValue('sub_type', validOptions[0]?.value || '')
        }
    }, [selectedType, form, open])

    const onSubmit = async (values: AccountFormValues) => {
        setLoading(true)
        try {
            if (isEdit) {
                if (isSystem) {
                    toast.error('System accounts cannot be edited')
                    return
                }

                const { error } = await (supabase
                    .from('accounts') as any)
                    .update({
                        code: values.code,
                        name: values.name,
                        type: values.type,
                        sub_type: values.sub_type,
                        description: values.description,
                        parent_account_id: values.parent_account_id,
                        is_active: values.is_active,
                        updated_at: new Date().toISOString()
                    } as any)
                    .eq('id', account.id)

                if (error) throw error
                toast.success('Account updated successfully')
            } else {
                const { error } = await (supabase
                    .from('accounts') as any)
                    .insert({
                        code: values.code,
                        name: values.name,
                        type: values.type,
                        sub_type: values.sub_type,
                        description: values.description,
                        parent_account_id: values.parent_account_id,
                        is_active: values.is_active,
                    } as any)

                if (error) {
                    if (error.code === '23505') {
                        form.setError('code', { message: 'Account code already exists' })
                        return
                    }
                    throw error
                }
                toast.success('Account created successfully')
            }
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error('Error saving account:', error)
            toast.error(error.message || 'Error saving account')
        } finally {
            setLoading(false)
        }
    }

    const parentAccountOptions = accounts.filter(acc => 
        acc.type === selectedType && 
        acc.id !== account?.id &&
        !acc.parent_account_id // Only allow top-level accounts as parents for simplicity
    )

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-md overflow-y-auto p-6">
                <SheetHeader className="mb-6">
                    <SheetTitle>
                        {isEdit ? 'Edit Account' : 'New Account'}
                    </SheetTitle>
                    <SheetDescription>
                        {isEdit 
                            ? 'Update the details of your financial account.' 
                            : 'Create a new account in your chart of accounts.'
                        }
                    </SheetDescription>
                </SheetHeader>

                {isSystem && (
                    <div className="mt-4 p-3 bg-zinc-50 border rounded-lg flex gap-3 text-zinc-600 animate-in fade-in slide-in-from-top-2 duration-300">
                        <Lock className="h-5 w-5 text-zinc-400 mt-0.5 shrink-0" />
                        <div className="text-xs space-y-1">
                            <p className="font-bold uppercase tracking-tight text-zinc-500">System Account</p>
                            <p>This is a foundational account (A/R or A/P) required by the system. It cannot be renamed, moved, or deactivated.</p>
                        </div>
                    </div>
                )}

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Account Code</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. 1100" {...field} disabled={isSystem || loading} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Account Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Petty Cash" {...field} disabled={isSystem || loading} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Type</FormLabel>
                                        <Select 
                                            onValueChange={field.onChange} 
                                            value={field.value} 
                                            disabled={isSystem || loading}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="asset">Asset</SelectItem>
                                                <SelectItem value="liability">Liability</SelectItem>
                                                <SelectItem value="equity">Equity</SelectItem>
                                                <SelectItem value="revenue">Revenue</SelectItem>
                                                <SelectItem value="expense">Expense</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="sub_type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Sub-type</FormLabel>
                                        <Select 
                                            onValueChange={field.onChange} 
                                            value={field.value} 
                                            disabled={isSystem || loading}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select sub-type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {(SUB_TYPE_OPTIONS[selectedType] || []).map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="parent_account_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Parent Account (Optional)</FormLabel>
                                    <Select 
                                        onValueChange={field.onChange} 
                                        value={field.value || "none"}
                                        disabled={isSystem || loading}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="None (Top Level)" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">None (Top Level)</SelectItem>
                                            {parentAccountOptions.map((acc) => (
                                                <SelectItem key={acc.id} value={acc.id}>
                                                    {acc.code} - {acc.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Group this account under another of the same type.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea 
                                            placeholder="Purpose of this account..." 
                                            className="resize-none"
                                            disabled={loading}
                                            {...field} 
                                            value={field.value || ''}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="is_active"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 space-y-0">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Active Status</FormLabel>
                                        <FormDescription>
                                            Inactive accounts are hidden from choices in forms.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={isSystem || loading}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <SheetFooter className="pt-4">
                            {!isSystem && (
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isEdit ? 'Save Changes' : 'Create Account'}
                                </Button>
                            )}
                        </SheetFooter>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    )
}
