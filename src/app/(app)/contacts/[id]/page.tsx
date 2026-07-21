import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/supabase/get-company-id'
import { ContactDetailHeader } from '@/components/contacts/ContactDetailHeader'
import { ContactTransactionsTab } from '@/components/contacts/ContactTransactionsTab'
import { ContactDetailsTab } from '@/components/contacts/ContactDetailsTab'
import { ContactProjectsTab } from '@/components/contacts/ContactProjectsTab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
type Contact = {
    name: string
    type: string | null
    [key: string]: unknown
}

export default async function ContactDetailPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const { id } = params;
    const supabase = await createClient()
    const companyId = await getCompanyId()

    // 1. Fetch Contact
    const { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single() as { data: Contact | null }

    if (!contact) {
        return <div>Contact not found</div>
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id as string)
        .single() as any

    const isViewer = profile?.role === 'viewer'

    // 2. Fetch Projects (if customer or both)
    let projects: any[] = []
    let showProjectsTab = ['customer', 'both'].includes((contact.type || '').toLowerCase())
    if (showProjectsTab) {
        const { data: projectsData } = await supabase
            .from('projects')
            .select('*')
            .eq('contact_id', id)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            
        projects = projectsData || []
    }

    // 3. Fetch Transactions (invoices, bills, expenses)
    const { data: invoicesData } = await supabase
        .from('invoices')
        .select(`
            id,
            number,
            issue_date,
            total,
            status,
            contact:contacts(id, name)
        `)
        .eq('contact_id', id)
        .eq('company_id', companyId);

    const { data: billsData } = await supabase
        .from('bills')
        .select(`
            id,
            number,
            issue_date,
            total,
            status,
            contact:contacts(id, name)
        `)
        .eq('contact_id', id)
        .eq('company_id', companyId);

    // We can't directly filter expenses by contact_id, we filter by payee name for now (or skip it here and only include invoices/bills)
    // Actually, expense doesn't have contact_id. It just has payee string. 
    // We will skip expenses for contact detail for now unless payee matches exactly.
    const { data: expensesData } = await supabase
        .from('expenses')
        .select(`
            id,
            date,
            amount,
            payee,
            expense_account:accounts!expense_account_id(name),
            status
        `)
        .ilike('payee', `%${contact.name}%`)
        .eq('company_id', companyId);

    // Normalize
    const transactions: any[] = []

    if (invoicesData) {
        for (const inv of invoicesData as any[]) {
            transactions.push({
                id: inv.id,
                date: inv.issue_date,
                type: 'Invoice',
                reference: inv.number,
                contactName: (inv.contact as any)?.name || 'Unknown',
                accountName: 'Accounts Receivable',
                amount: inv.total,
                status: inv.status,
                entityId: inv.id
            })
        }
    }

    if (billsData) {
        for (const bill of billsData as any[]) {
            transactions.push({
                id: bill.id,
                date: bill.issue_date,
                type: 'Bill',
                reference: bill.number,
                contactName: (bill.contact as any)?.name || 'Unknown',
                accountName: 'Accounts Payable',
                amount: bill.total,
                status: bill.status,
                entityId: bill.id
            })
        }
    }

    if (expensesData) {
        for (const exp of expensesData as any[]) {
            transactions.push({
                id: exp.id,
                date: exp.date,
                type: 'Expense',
                reference: `EXP-${exp.id.substring(0, 6)}`,
                contactName: exp.payee || 'Unknown Payee',
                accountName: (exp.expense_account as any)?.name || 'Expense',
                amount: exp.amount,
                status: exp.status === 'void' ? 'void' : 'Recorded',
                entityId: exp.id
            })
        }
    }

    // Sort newest first
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return (
        <div className="flex flex-col gap-6 p-6">
            <ContactDetailHeader 
                contact={contact} 
            />
            
            <Tabs defaultValue="transactions" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    {showProjectsTab && (
                        <TabsTrigger value="projects">Projects</TabsTrigger>
                    )}
                </TabsList>
                
                <TabsContent value="transactions">
                    <ContactTransactionsTab transactions={transactions} />
                </TabsContent>
                
                <TabsContent value="details">
                    <ContactDetailsTab contact={contact} isViewer={isViewer} />
                </TabsContent>
                
                {showProjectsTab && (
                    <TabsContent value="projects">
                        <ContactProjectsTab 
                            contact={contact} 
                            projects={projects} 
                            isViewer={isViewer} 
                        />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    )
}
