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
import { useEffect } from "react";
import { useUserRole } from "@/hooks/useUserRole";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];

export function normalizeContactType(value: any): "customer" | "vendor" | "both" {
    if (typeof value !== "string") return "customer";
    const normalized = value.trim().toLowerCase();
    if (["customer", "vendor", "both"].includes(normalized)) {
        return normalized as "customer" | "vendor" | "both";
    }
    return "customer";
}

const contactSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    type: z.preprocess(
        (val) => normalizeContactType(val),
        z.enum(["customer", "vendor", "both"])
    ),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
    phone: z.string().optional(),
    website: z.string().url("Invalid URL").optional().or(z.literal("")),
    billing_address: z.string().optional(),
    billing_city: z.string().optional(),
    billing_state: z.string().optional(),
    billing_zip: z.string().optional(),
    billing_country: z.string().optional(),
    tax_number: z.string().optional(),
    notes: z.string().optional(),
    is_active: z.boolean().optional().default(true),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contact?: Contact | null;
    onSuccess: () => void;
}

export function ContactSheet({ open, onOpenChange, contact, onSuccess }: ContactSheetProps) {
    const supabase = createClient();
    const { companyId } = useUserRole();
    const isEditing = !!contact;

    const form = useForm<ContactFormValues>({
        resolver: zodResolver(contactSchema) as any,
        defaultValues: {
            name: "",
            type: "customer",
            email: "",
            phone: "",
            website: "",
            billing_address: "",
            billing_city: "",
            billing_state: "",
            billing_zip: "",
            billing_country: "",
            tax_number: "",
            notes: "",
            is_active: true,
        },
    });

    useEffect(() => {
        if (contact) {
            form.reset({
                name: contact.name,
                type: normalizeContactType(contact.type),
                email: contact.email || "",
                phone: contact.phone || "",
                website: contact.website || "",
                billing_address: contact.billing_address || "",
                billing_city: contact.billing_city || "",
                billing_state: contact.billing_state || "",
                billing_zip: contact.billing_zip || "",
                billing_country: contact.billing_country || "",
                tax_number: contact.tax_number || "",
                notes: contact.notes || "",
                is_active: contact.is_active ?? true,
            });
        } else {
            form.reset({
                name: "",
                type: "customer",
                email: "",
                phone: "",
                website: "",
                billing_address: "",
                billing_city: "",
                billing_state: "",
                billing_zip: "",
                billing_country: "",
                tax_number: "",
                notes: "",
                is_active: true,
            });
        }
    }, [contact, form]);

    async function onSubmit(values: ContactFormValues) {
        try {
            if (isEditing) {
                const { error } = await (supabase.from("contacts") as any)
                    .update(values as any)
                    .eq("id", contact.id as any);

                if (error) throw error;
                toast.success("Contact updated successfully");
            } else {
                const { error } = await (supabase.from("contacts") as any)
                    .insert([{ ...values, company_id: companyId }] as any);

                if (error) throw error;
                toast.success("Contact created successfully");
            }
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || "Something went wrong");
        }
    }

    async function onDelete() {
        try {
            const { error } = await (supabase.from("contacts") as any)
                .delete()
                .eq("id", contact?.id as any);

            if (error) throw error;
            toast.success("Contact deleted successfully");
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to delete contact");
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[540px] overflow-y-auto p-6">
                <SheetHeader className="mb-6">
                    <SheetTitle>{isEditing ? "Edit Contact" : "New Contact"}</SheetTitle>
                    <SheetDescription>
                        {isEditing ? "Update contact information." : "Add a new customer or vendor to your contacts."}
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
                                        <Input placeholder="Acme Corp" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Type</FormLabel>
                                    <Select 
                                        onValueChange={field.onChange} 
                                        value={field.value || "customer"}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="customer">Customer</SelectItem>
                                            <SelectItem value="vendor">Vendor</SelectItem>
                                            <SelectItem value="both">Both</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input placeholder="contact@example.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone</FormLabel>
                                        <FormControl>
                                            <Input placeholder="+1 (555) 000-0000" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="website"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Website</FormLabel>
                                    <FormControl>
                                        <Input placeholder="https://example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="space-y-2">
                            <FormLabel>Billing Address</FormLabel>
                            <FormField
                                control={form.control}
                                name="billing_address"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input placeholder="Street Address" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="billing_city"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input placeholder="City" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="billing_state"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input placeholder="State" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="billing_zip"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input placeholder="ZIP / Postal Code" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="billing_country"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input placeholder="Country" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                        <FormField
                            control={form.control}
                            name="tax_number"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tax Number / VAT ID</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Tax ID" {...field} />
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
                                        <Input placeholder="Internal notes..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-between items-center pt-4">
                            {isEditing ? (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button type="button" variant="ghost" className="text-destructive hover:text-white hover:bg-destructive">
                                            Delete Contact
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Contact?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. Are you sure you want to delete this contact?
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
                                    {isEditing ? "Update Contact" : "Create Contact"}
                                </Button>
                            </div>
                        </div>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    );
}
