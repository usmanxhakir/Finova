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
import { useEffect } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { Textarea } from "@/components/ui/textarea";

const projectSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    code: z.string().optional(),
    contact_id: z.string().min(1, "Customer is required"),
    description: z.string().optional(),
    status: z.enum(["active", "completed", "archived"]),
    start_date: z.string().optional().nullable().or(z.literal("")),
    end_date: z.string().optional().nullable().or(z.literal("")),
    budget: z.number().min(0).default(0),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface ProjectSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project?: any | null;
    customers: any[];
    initialContactId?: string;
    onSuccess: () => void;
}

export function ProjectSheet({ open, onOpenChange, project, customers, initialContactId, onSuccess }: ProjectSheetProps) {
    const supabase = createClient();
    const { companyId } = useUserRole();
    const isEditing = !!project;

    const form = useForm<ProjectFormValues>({
        resolver: zodResolver(projectSchema) as any,
        defaultValues: {
            name: "",
            code: "",
            contact_id: initialContactId || "",
            description: "",
            status: "active",
            start_date: "",
            end_date: "",
            budget: 0,
        },
    });

    useEffect(() => {
        if (project) {
            form.reset({
                name: project.name,
                code: project.code || "",
                contact_id: project.contact_id,
                description: project.description || "",
                status: project.status,
                start_date: project.start_date || "",
                end_date: project.end_date || "",
                budget: project.budget ? Number(project.budget) / 100 : 0,
            });
        } else {
            form.reset({
                name: "",
                code: "",
                contact_id: initialContactId || "",
                description: "",
                status: "active",
                start_date: "",
                end_date: "",
                budget: 0,
            });
        }
    }, [project, form, initialContactId]);

    async function onSubmit(values: ProjectFormValues) {
        try {
            const payload = {
                ...values,
                start_date: values.start_date || null,
                end_date: values.end_date || null,
                budget: Math.round(values.budget * 100), // convert to cents
                company_id: companyId,
            };

            if (isEditing) {
                const { error } = await (supabase.from("projects") as any)
                    .update(payload)
                    .eq("id", project.id);

                if (error) throw error;
                toast.success("Project updated successfully");
            } else {
                const { error } = await (supabase.from("projects") as any)
                    .insert([payload]);

                if (error) throw error;
                toast.success("Project created successfully");
            }
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || "Something went wrong");
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[540px] overflow-y-auto p-6">
                <SheetHeader className="mb-6">
                    <SheetTitle>{isEditing ? "Edit Project" : "New Project"}</SheetTitle>
                    <SheetDescription>
                        {isEditing ? "Update project details." : "Create a new project for a customer."}
                    </SheetDescription>
                </SheetHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Project Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="E.g. Website Redesign" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Project Code (Optional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="E.g. PRJ-001" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="contact_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Customer</FormLabel>
                                    <Select 
                                        onValueChange={field.onChange} 
                                        value={field.value}
                                        disabled={!!initialContactId && !isEditing}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select customer" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {customers.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
                                        <Textarea placeholder="Project details..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select 
                                            onValueChange={field.onChange} 
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="completed">Completed</SelectItem>
                                                <SelectItem value="archived">Archived</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="start_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Start Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} value={field.value || ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="end_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>End Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} value={field.value || ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="budget"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Budget ($)</FormLabel>
                                    <FormControl>
                                        <Input 
                                            type="number" 
                                            step="0.01" 
                                            min="0"
                                            value={field.value || ""}
                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} 
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                {isEditing ? "Update Project" : "Create Project"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    );
}
