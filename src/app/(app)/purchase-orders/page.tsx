import { createClient } from '@/lib/supabase/server'
import { StudioGate } from '@/components/ui/StudioGate'
import POList from './POList'

export default async function PurchaseOrdersPage() {
  const supabase = await createClient()

  // Fetch purchase orders with contact names
  // RLS automatically filters by company_id
  const { data: purchaseOrders, error } = await supabase
    .from('purchase_orders')
    .select(`
      id,
      po_number,
      status,
      created_at,
      total_amount,
      contacts (
        name
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching purchase orders:', error)
    return <div>Error loading purchase orders</div>
  }

  return (
    <StudioGate>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Purchase Orders
          </h1>
          <p className="text-muted-foreground">
            Manage your purchase orders and supplier relationships.
          </p>
        </div>
        <POList initialData={purchaseOrders || []} />
      </div>
    </StudioGate>
  )
}