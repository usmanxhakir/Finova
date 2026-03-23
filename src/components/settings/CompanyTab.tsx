'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Upload, Trash2 } from 'lucide-react'
import Image from 'next/image'

const companySchema = z.object({
    name: z.string().min(1, 'Company name is required'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
    city: z.string().optional().or(z.literal('')),
    state: z.string().optional().or(z.literal('')),
    zip: z.string().optional().or(z.literal('')),
    country: z.string().optional().or(z.literal('')),
    website: z.string().optional().or(z.literal('')),
    tax_number: z.string().optional().or(z.literal('')),
    default_currency: z.string().min(1, 'Default currency is required'),
    fiscal_year_start: z.number().min(1).max(12), // Changed from z.coerce.number() to z.number()
    invoice_prefix: z.string().min(1, 'Invoice prefix is required'),
    bill_prefix: z.string().min(1, 'Bill prefix is required'),
    invoice_terms: z.string().optional().or(z.literal('')),
    invoice_footer: z.string().optional().or(z.literal('')),
})

type CompanyFormValues = z.infer<typeof companySchema>

export function CompanyTab({ initialSettings }: { initialSettings: any }) {
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [logoPreview, setLogoPreview] = useState<string | null>(initialSettings?.logo_url || null)
    const supabase = createClient()

    const form = useForm<CompanyFormValues>({
        resolver: zodResolver(companySchema),
        defaultValues: {
            name: initialSettings?.name || '',
            email: initialSettings?.email || '',
            phone: initialSettings?.phone || '',
            address: initialSettings?.address || '',
            city: initialSettings?.city || '',
            state: initialSettings?.state || '',
            zip: initialSettings?.zip || '',
            country: initialSettings?.country || '',
            website: initialSettings?.website || '',
            tax_number: initialSettings?.tax_number || '',
            default_currency: initialSettings?.default_currency || 'USD',
            fiscal_year_start: Number(initialSettings?.fiscal_year_start) || 1,
            invoice_prefix: initialSettings?.invoice_prefix || 'INV-',
            bill_prefix: initialSettings?.bill_prefix || 'BILL-',
            invoice_terms: initialSettings?.invoice_terms || '',
            invoice_footer: initialSettings?.invoice_footer || '',
        }
    })

    async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `logo-${Date.now()}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('company-logos')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('company-logos')
                .getPublicUrl(filePath)

            setLogoPreview(publicUrl)
            
            // Auto-save logo URL
            const { error: updateError } = await (supabase
                .from('company_settings') as any)
                .update({ logo_url: publicUrl })
                .eq('id', initialSettings.id)

            if (updateError) throw updateError
            toast.success('Logo updated successfully')
        } catch (error: any) {
            toast.error(error.message || 'Error uploading logo')
        } finally {
            setUploading(false)
        }
    }

    async function handleRemoveLogo() {
        try {
            const { error } = await (supabase
                .from('company_settings') as any)
                .update({ logo_url: null })
                .eq('id', initialSettings.id)

            if (error) throw error
            setLogoPreview(null)
            toast.success('Logo removed')
        } catch (error: any) {
            toast.error(error.message || 'Error removing logo')
        }
    }

    async function onSubmit(values: CompanyFormValues) {
        setLoading(true)
        try {
            const { error } = await (supabase
                .from('company_settings') as any)
                .update(values)
                .eq('id', initialSettings.id)

            if (error) throw error
            toast.success('Settings updated successfully')
        } catch (error: any) {
            toast.error(error.message || 'Error updating settings')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle>Company Information</CardTitle>
                    <CardDescription>Update your company details and document preferences.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Company Name</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Company Email</FormLabel>
                                            <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Phone Number</FormLabel>
                                            <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="website"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Website</FormLabel>
                                            <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="address"
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel>Address</FormLabel>
                                            <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="city"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>City</FormLabel>
                                            <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="state"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>State/Province</FormLabel>
                                            <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="zip"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Zip/Postal Code</FormLabel>
                                            <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="country"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Country</FormLabel>
                                            <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="border-t pt-6 grid gap-4 md:grid-cols-3">
                                <FormField
                                    control={form.control}
                                    name="default_currency"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Default Currency</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="invoice_prefix"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Invoice Prefix</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="bill_prefix"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Bill Prefix</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid gap-4">
                                <FormField
                                    control={form.control}
                                    name="invoice_terms"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Default Payment Terms</FormLabel>
                                            <FormControl><Textarea {...field} value={field.value || ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="invoice_footer"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Invoice Footer Notes</FormLabel>
                                            <FormControl><Textarea {...field} value={field.value || ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Button type="submit" disabled={loading} className="w-full md:w-auto">
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Card className="h-fit">
                <CardHeader>
                    <CardTitle>Company Logo</CardTitle>
                    <CardDescription>This logo will appear on your invoices and reports.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                    <div className="relative w-full aspect-square max-w-[200px] border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden bg-zinc-50">
                        {logoPreview ? (
                            <Image src={logoPreview} alt="Company Logo" fill className="object-contain p-2" />
                        ) : (
                            <Building2 className="h-12 w-12 text-zinc-300" />
                        )}
                        {uploading && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col w-full gap-2">
                        <Button variant="outline" className="w-full relative" disabled={uploading}>
                            {uploading ? 'Uploading...' : 'Upload New Logo'}
                            <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                disabled={uploading}
                            />
                        </Button>
                        {logoPreview && (
                            <Button variant="ghost" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleRemoveLogo}>
                                <Trash2 className="mr-2 h-4 w-4" /> Remove Logo
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

import { Building2 } from 'lucide-react'
