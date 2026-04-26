'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

const step1Schema = z.object({
    fullName: z.string().min(2, { message: 'Full name is required' }),
    email: z.string().email({ message: 'Invalid email address' }),
    password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
    confirmPassword: z.string().min(6),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
})

const step2Schema = z.object({
    companyName: z.string().min(2, { message: 'Company name is required' }),
    companyEmail: z.string().email({ message: 'Invalid company email' }),
    phone: z.string().optional(),
    address: z.string().optional(),
})

export default function RegisterPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [isLoading, setIsLoading] = useState(false)
    const [adminId, setAdminId] = useState<string | null>(null)
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const supabase = createClient()

    const step1Form = useForm<z.infer<typeof step1Schema>>({
        resolver: zodResolver(step1Schema),
        defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
    })

    const step2Form = useForm<z.infer<typeof step2Schema>>({
        resolver: zodResolver(step2Schema),
        defaultValues: { companyName: '', companyEmail: '', phone: '', address: '' },
    })

    async function onStep1Submit(values: z.infer<typeof step1Schema>) {
        setIsLoading(true)
        const { data, error } = await supabase.auth.signUp({
            email: values.email,
            password: values.password,
            options: {
                data: {
                    full_name: values.fullName,
                },
            },
        })

        if (error) {
            toast.error(error.message)
            setIsLoading(false)
            return
        }

        if (data.user) {
            setAdminId(data.user.id)
            setStep(2)
            toast.success('Admin account created. Now setup your company.')
        }
        setIsLoading(false)
    }

    async function onStep2Submit(values: z.infer<typeof step2Schema>) {
        if (!adminId) return
        setIsLoading(true)

        let logoUrl = null
        if (logoFile) {
            const fileExt = logoFile.name.split('.').pop()
            const fileName = `${adminId}-${Math.random()}.${fileExt}`
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('company-logos')
                .upload(fileName, logoFile)

            if (uploadError) {
                toast.error('Failed to upload logo: ' + uploadError.message)
            } else {
                const { data: publicUrl } = supabase.storage
                    .from('company-logos')
                    .getPublicUrl(fileName)
                logoUrl = publicUrl.publicUrl
            }
        }

        // 1. Create Company
        const { data: company, error: companyError } = await (supabase.from('companies') as any).insert({
            name: values.companyName,
            email: values.companyEmail,
            phone: values.phone,
            address: values.address,
            logo_url: logoUrl,
        }).select().single()

        if (companyError || !company) {
            toast.error('Error creating company: ' + companyError?.message)
            setIsLoading(false)
            return
        }

        const companyId = company.id

        // 2. Create Profile linked to Company
        const { error: profileError } = await (supabase.from('profiles') as any).upsert({
            id: adminId,
            full_name: step1Form.getValues().fullName,
            role: 'admin',
            company_id: companyId
        }, { onConflict: 'id' })

        if (profileError) {
            toast.error('Error creating profile: ' + profileError.message)
            // Cleanup company if profile fails? (Optional, but RLS might prevent further steps anyway)
            setIsLoading(false)
            return
        }

        // 3. Seed Default Chart of Accounts
        const defaultAccounts = [
            { company_id: companyId, code: '1100', name: 'Accounts Receivable', type: 'asset', sub_type: 'current_asset', is_active: true },
            { company_id: companyId, code: '1200', name: 'Cash', type: 'asset', sub_type: 'cash', is_active: true },
            { company_id: companyId, code: '1300', name: 'Main Bank Account', type: 'asset', sub_type: 'bank', is_active: true },
            { company_id: companyId, code: '2100', name: 'Accounts Payable', type: 'liability', sub_type: 'current_liability', is_active: true },
            { company_id: companyId, code: '3100', name: 'Retained Earnings', type: 'equity', sub_type: 'equity', is_active: true },
            { company_id: companyId, code: '4100', name: 'Sales', type: 'revenue', sub_type: 'revenue', is_active: true },
            { company_id: companyId, code: '5100', name: 'Cost of Goods Sold', type: 'expense', sub_type: 'cost_of_goods_sold', is_active: true },
            { company_id: companyId, code: '6100', name: 'General Expenses', type: 'expense', sub_type: 'expense', is_active: true },
            { company_id: companyId, code: '2200', name: 'Tax Payable', type: 'liability', sub_type: 'current_liability', is_active: true },
        ]

        const { error: coaError } = await (supabase.from('accounts') as any).insert(defaultAccounts)
        
        if (coaError) {
            toast.error('Warning: Company created but failed to seed Chart of Accounts. You may need to add accounts manually.')
            console.error('COA Seeding Error:', coaError)
        }

        toast.success('Onboarding complete!')
        router.push('/dashboard')
        router.refresh()
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
            <Card className="w-full max-w-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Registration</CardTitle>
                    <CardDescription>
                        {step === 1 ? 'Step 1: Create Admin Account' : 'Step 2: Company Profile'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {step === 1 ? (
                        <Form {...step1Form} key="step1">
                            <form onSubmit={step1Form.handleSubmit(onStep1Submit)} className="space-y-4">
                                <FormField
                                    control={step1Form.control}
                                    name="fullName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Full Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="John Doe" {...field} disabled={isLoading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={step1Form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input placeholder="john@example.com" {...field} disabled={isLoading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={step1Form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Password</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={step1Form.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Confirm Password</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? 'Creating account...' : 'Next Step'}
                                </Button>
                            </form>
                        </Form>
                    ) : (
                        <Form {...step2Form} key="step2">
                            <form onSubmit={step2Form.handleSubmit(onStep2Submit)} className="space-y-4">
                                <FormField
                                    control={step2Form.control}
                                    name="companyName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Company Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Acme Inc." {...field} disabled={isLoading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={step2Form.control}
                                    name="companyEmail"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Company Email</FormLabel>
                                            <FormControl>
                                                <Input placeholder="billing@acme.com" {...field} disabled={isLoading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={step2Form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Phone</FormLabel>
                                            <FormControl>
                                                <Input placeholder="+1 (555) 000-0000" {...field} disabled={isLoading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={step2Form.control}
                                    name="address"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Address</FormLabel>
                                            <FormControl>
                                                <Input placeholder="123 Business St." {...field} disabled={isLoading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormItem>
                                    <FormLabel>Company Logo</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                                            disabled={isLoading}
                                        />
                                    </FormControl>
                                </FormItem>
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? 'Finishing setup...' : 'Complete Setup'}
                                </Button>
                            </form>
                        </Form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
