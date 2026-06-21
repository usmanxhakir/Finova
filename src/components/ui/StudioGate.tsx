import { createClient } from '@/lib/supabase/server'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { canAccessPurchaseOrders } from '@/lib/access/modules'

interface StudioGateProps {
  children: React.ReactNode
}

export async function StudioGate({ children }: StudioGateProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .limit(1)
    .maybeSingle() as { data: { company_id: string | null } | null }

  if (!profile?.company_id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 max-w-md w-full">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-violet-50 flex items-center justify-center">
              <Lock className="h-6 w-6 text-violet-600" />
            </div>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800 mb-4">
            Studio Feature
          </span>
          <h2 className="text-2xl font-bold text-gray-900 mt-2">Purchase Orders</h2>
          <p className="text-gray-500 mt-2 mb-8">
            Upgrade to Studio to unlock purchase orders, approval workflows, and more.
          </p>
          <Button asChild className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-6">
            <a href="/settings/billing">Upgrade to Studio</a>
          </Button>
        </div>
      </div>
    )
  }

  const { data: company } = await supabase
    .from('companies')
    .select('plan')
    .eq('id', profile.company_id)
    .limit(1)
    .maybeSingle() as { data: { plan: string } | null }

  if (canAccessPurchaseOrders(company?.plan)) {
    return <>{children}</>
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 max-w-md w-full">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-violet-50 flex items-center justify-center">
            <Lock className="h-6 w-6 text-violet-600" />
          </div>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800 mb-4">
          Studio Feature
        </span>
        <h2 className="text-2xl font-bold text-gray-900 mt-2">Purchase Orders</h2>
        <p className="text-gray-500 mt-2 mb-8">
          Upgrade to Studio to unlock purchase orders, approval workflows, and more.
        </p>
        <Button asChild className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-6">
          <a href="/settings/billing">Upgrade to Studio</a>
        </Button>
      </div>
    </div>
  )
}
