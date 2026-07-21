import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/supabase/get-company-id'
import { ProjectDetailHeader } from '@/components/projects/ProjectDetailHeader'
import { ProjectKpiCards } from '@/components/projects/ProjectKpiCards'
import TransactionListClient from '@/app/(app)/reports/transactions/TransactionListClient'
import { Database } from '@/types/database.types'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type Project = ProjectRow & {
    contacts: { name: string } | null
}

export default async function ProjectDetailPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const { id } = params;
    const supabase = await createClient()
    const companyId = await getCompanyId()

    // 1. Fetch Project
    const { data: projectRow } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single()
        .overrideTypes<ProjectRow, { merge: false }>()

    if (!projectRow) {
        return <div>Project not found</div>
    }

    const { data: contact } = await supabase
        .from('contacts')
        .select('name')
        .eq('id', projectRow.contact_id)
        .single() as { data: { name: string } | null }

    const project: Project = {
        ...projectRow,
        contacts: contact,
    }

    // 2. Fetch Transactions (invoices, bills, expenses)
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
        .eq('project_id', id);

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
        .eq('project_id', id);

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
        .eq('project_id', id);

    // Normalize
    const transactions: any[] = []

    let totalRevenue = 0;
    let totalCosts = 0;

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
            if (inv.status !== 'void') {
                totalRevenue += inv.total;
            }
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
            if (bill.status !== 'void') {
                totalCosts += bill.total;
            }
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
            if (exp.status !== 'void') {
                totalCosts += exp.amount;
            }
        }
    }

    // Sort newest first
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id as string)
        .single() as any

    const isViewer = profile?.role === 'viewer'

    // Fetch customers for the project sheet
    const { data: customers } = await supabase
        .from('contacts')
        .select('id, name')
        .in('type', ['customer', 'both'])
        .eq('is_active', true)
        .eq('company_id', companyId)

    return (
        <div className="flex flex-col gap-6 p-6">
            <ProjectDetailHeader 
                project={project} 
                customers={customers || []}
                isViewer={isViewer} 
            />
            
            <ProjectKpiCards 
                revenue={totalRevenue} 
                costs={totalCosts} 
                budget={project.budget} 
            />

            <div className="mt-4">
                <h2 className="text-xl font-semibold mb-4">Project Transactions</h2>
                <TransactionListClient 
                    initialTransactions={transactions} 
                />
            </div>
        </div>
    )
}
