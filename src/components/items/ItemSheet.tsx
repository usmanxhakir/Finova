"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
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
} from "@/components/ui/alert-dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Database } from "@/types/database.types";
import { useEffect, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";

type Item = Database["public"]["Tables"]["items"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

const itemSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    description: z.string().optional(),
    type: z.enum(["product", "service"]),
    unit: z.string().optional(),
    default_rate: z.number().min(0).default(0), // Input in dollars, will convert to cents
    income_account_id: z.string().min(1, "Please select an income account"),
    expense_account_id: z.string().min(1, "Please select an expense account"),
    is_active: z.boolean().default(true),
});

type ItemFormValues = z.infer<typeof itemSchema>;

interface ItemSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item?: Item | null;
    accounts: Account[];
    onSuccess: () => void;
}

export function ItemSheet({ open, onOpenChange, item, accounts, onSuccess }: ItemSheetProps) {
    const supabase = createClient();
    const { companyId } = useUserRole();
    const isEditing = !!item;

    const form = useForm<ItemFormValues>({
        resolver: zodResolver(itemSchema) as any,
        defaultValues: {
            name: "",
            description: "",
            type: "service",
            unit: "hrs",
            default_rate: 0,
            income_account_id: "",
            expense_account_id: "",
            is_active: true,
        },
    });


    useEffect(() => {
        if (item) {
            form.reset({
                name: item.name,
                description: item.description || "",
                type: item.type as "product" | "service",
                unit: item.unit || "hrs",
                default_rate: (item.default_rate || 0) / 100, // Convert cents to dollars for display
                income_account_id: item.income_account_id || "",
                expense_account_id: item.expense_account_id || "",
                is_active: item.is_active ?? true,
            });
        } else {
            form.reset({
                name: "",
                description: "",
                type: "service",
                unit: "hrs",
                default_rate: 0,
                income_account_id: "",
                expense_account_id: "",
                is_active: true,
            });
        }
    }, [item, form]);

    async function onSubmit(values: ItemFormValues) {
        try {
            const dataToSave = {
                ...values,
                default_rate: Math.round(values.default_rate * 100), // Convert dollars to cents
            };

            if (isEditing) {
                const { error } = await (supabase.from("items") as any)
                    .update(dataToSave as any)
                    .eq("id", item.id as any);

                if (error) throw error;
                toast.success("Item updated successfully");
            } else {
                const { error } = await (supabase.from("items") as any)
                    .insert([{ ...dataToSave, company_id: companyId }] as any);

                if (error) throw error;
                toast.success("Item created successfully");
            }
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || "Something went wrong");
        }
    }
    async function onDelete() {
        try {
            const { error } = await (supabase.from("items") as any)
                .delete()
                .eq("id", item?.id as any);

            if (error) throw error;
            toast.success("Item deleted successfully");
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to delete item");
        }
    }

    const incomeAccounts = accounts.filter(a => a.type === "revenue");
    const expenseAccounts = accounts.filter(a => a.type === "expense");

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[480px] p-6">
                <SheetHeader className="mb-6">
                    <SheetTitle>{isEditing ? "Edit Item" : "New Item"}</SheetTitle>
                    <SheetDescription>
                        {isEditing ? "Update product or service details." : "Add a new product or service."}
                    </SheetDescription>
                </SheetHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Consulting" {...field} />
                                    </FormControl>
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
                                        <Input placeholder="Professional consulting services" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Type</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="product">Product</SelectItem>
                                                <SelectItem value="service">Service</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="unit"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Unit</FormLabel>
                                        <FormControl>
                                            <Input placeholder="hrs, pcs, etc." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="default_rate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Default Rate</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            {...field}
                                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="income_account_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Income Account</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select revenue account" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {incomeAccounts.map(account => (
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
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select expense account" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {expenseAccounts.map(account => (
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
                        <div className="flex justify-between items-center pt-4">
                            {isEditing ? (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button type="button" variant="ghost" className="text-destructive hover:text-white hover:bg-destructive">
                                            Delete Item
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Item?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. Are you sure you want to delete this item?
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            ) : <div />}
                            <div className="flex gap-3">
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit">
                                    {isEditing ? "Update Item" : "Create Item"}
                                </Button>
                            </div>
                        </div>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    );
}
