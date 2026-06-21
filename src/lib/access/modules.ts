export type ModuleId =
  | 'dashboard'
  | 'agent'
  | 'invoices'
  | 'bills'
  | 'purchase_orders'
  | 'expenses'
  | 'contacts'
  | 'items'
  | 'accounts'
  | 'journal_entries'
  | 'banking'
  | 'payments'
  | 'reports'
  | 'settings'

export type UserRole = 'admin' | 'accountant' | 'viewer' | 'procurement'
export type CompanyPlan = 'free' | 'pro' | 'studio' | 'po_only'

export const ALL_MODULES: ModuleId[] = [
  'dashboard',
  'agent',
  'invoices',
  'bills',
  'purchase_orders',
  'expenses',
  'contacts',
  'items',
  'accounts',
  'journal_entries',
  'banking',
  'payments',
  'reports',
  'settings',
]

export const PROCUREMENT_MODULES: ModuleId[] = [
  'dashboard',
  'purchase_orders',
  'contacts',
  'items',
  'accounts',
  'settings',
]

export function getAllowedModules(
  role?: string | null,
  plan?: string | null,
): Set<ModuleId> {
  if (role === 'procurement' || plan === 'po_only') {
    return new Set(PROCUREMENT_MODULES)
  }

  return new Set(ALL_MODULES)
}

export function isModuleAllowed(
  moduleId: ModuleId,
  role?: string | null,
  plan?: string | null,
) {
  return getAllowedModules(role, plan).has(moduleId)
}

export function canAccessPurchaseOrders(plan?: string | null) {
  return plan === 'studio' || plan === 'po_only'
}

export function getModuleForPath(pathname: string): ModuleId | null {
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return 'dashboard'
  if (pathname === '/agent' || pathname.startsWith('/agent/')) return 'agent'
  if (pathname === '/invoices' || pathname.startsWith('/invoices/')) return 'invoices'
  if (pathname === '/bills' || pathname.startsWith('/bills/')) return 'bills'
  if (pathname === '/purchase-orders' || pathname.startsWith('/purchase-orders/')) return 'purchase_orders'
  if (pathname === '/expenses' || pathname.startsWith('/expenses/')) return 'expenses'
  if (pathname === '/contacts' || pathname.startsWith('/contacts/')) return 'contacts'
  if (pathname === '/items' || pathname.startsWith('/items/')) return 'items'
  if (pathname === '/accounts' || pathname.startsWith('/accounts/')) return 'accounts'
  if (pathname === '/journal-entries' || pathname.startsWith('/journal-entries/')) return 'journal_entries'
  if (pathname === '/banking' || pathname.startsWith('/banking/')) return 'banking'
  if (pathname === '/pay-bills' || pathname.startsWith('/pay-bills/')) return 'payments'
  if (pathname === '/receive-payments' || pathname.startsWith('/receive-payments/')) return 'payments'
  if (pathname === '/reports' || pathname.startsWith('/reports/')) return 'reports'
  if (pathname === '/settings' || pathname.startsWith('/settings/')) return 'settings'

  return null
}
