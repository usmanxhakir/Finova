"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeContactType } from "@/components/contacts/ContactSheet";

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

interface ContactDetailsTabProps {
    contact: any;
    isViewer?: boolean;
}

export function ContactDetailsTab({ contact, isViewer }: ContactDetailsTabProps) {
    const supabase = createClient();
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);

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
        }
    }, [contact, form]);

    async function onSubmit(values: ContactFormValues) {
        try {
            const { error } = await (supabase.from("contacts") as any)
                .update(values as any)
                .eq("id", contact.id as any);

            if (error) throw error;
            toast.success("Contact updated successfully");
            setIsEditing(false);
            router.refresh();
        } catch (error: any) {
            toast.error(error.message || "Something went wrong");
        }
    }

    return (
        <div className="mt-4 max-w-2xl bg-white dark:bg-zinc-950 p-6 rounded-md border shadow-sm">
            {!isViewer && (
                <div className="flex justify-end mb-4">
                    {isEditing ? (
                        <Button variant="outline" onClick={() => {
                            setIsEditing(false);
                            form.reset(); // reset to saved values
                        }}>
                            Cancel Edit
                        </Button>
                    ) : (
                        <Button onClick={() => setIsEditing(true)}>
                            Edit Details
                        </Button>
                    )}
                </div>
            )}

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="Acme Corp" {...field} disabled={!isEditing} />
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
                                    disabled={!isEditing}
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
                                        <Input placeholder="contact@example.com" {...field} disabled={!isEditing} />
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
                                        <Input placeholder="+1 (555) 000-0000" {...field} disabled={!isEditing} />
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
                                    <Input placeholder="https://example.com" {...field} disabled={!isEditing} />
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
                                        <Input placeholder="Street Address" {...field} disabled={!isEditing} />
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
                                            <Input placeholder="City" {...field} disabled={!isEditing} />
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
                                            <Input placeholder="State" {...field} disabled={!isEditing} />
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
                                            <Input placeholder="ZIP / Postal Code" {...field} disabled={!isEditing} />
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
                                            <Input placeholder="Country" {...field} disabled={!isEditing} />
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
                                    <Input placeholder="Tax ID" {...field} disabled={!isEditing} />
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
                                    <Input placeholder="Internal notes..." {...field} disabled={!isEditing} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    {isEditing && (
                        <div className="flex justify-end pt-4">
                            <Button type="submit">
                                Save Changes
                            </Button>
                        </div>
                    )}
                </form>
            </Form>
        </div>
    );
}
