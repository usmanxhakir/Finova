import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StudioGate } from '@/components/ui/StudioGate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import POActions from '@/components/purchase-orders/POActions'

interface PurchaseOrderLineItem {
  id: string
  description: string | null
  item_id: string | null
  quantity: number | string | null
  rate: number | string | bigint | null
  amount: number | string | bigint | null
  items?: { name: string } | null
  item?: { name: string } | null
}

interface PurchaseOrderDetail {
  id: string
  number: string
  status: string
  created_at: string
  issue_date: string
  expected_delivery_date: string | null
  reference_number: string | null
  notes: string | null
  subtotal: number | string | bigint
  total: number | string | bigint
  contacts: { name: string } | null
  po_line_items: PurchaseOrderLineItem[]
  current_step_order: number | null
}

interface ApprovalRecord {
  id: string
  step_label: string
  step_order: number
  status: 'approved' | 'pending' | 'rejected' | string
  decided_at: string | null
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  converted: 'bg-violet-100 text-violet-800',
  void: 'bg-gray-100 text-gray-400 line-through',
}

const APPROVAL_DOT_COLORS: Record<string, string> = {
  approved: 'bg-violet-500',
  pending: 'bg-yellow-500',
  rejected: 'bg-red-500',
}

interface PurchaseOrderDetailPageProps {
  params: Promise<{ id: string }>
}

function normalizeCents(value: number | string | bigint | null | undefined): number | bigint {
  if (typeof value === 'bigint' || typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

async function getApiUrl(path: string) {
  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http'

  if (host) return `${protocol}://${host}${path}`

  const fallback = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${fallback.replace(/\/$/, '')}${path}`
}

async function apiFetch(path: string, init?: RequestInit) {
  const url = await getApiUrl(path)
  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ')

  const requestHeaders = new Headers(init?.headers)
  if (cookieHeader) {
    requestHeaders.set('cookie', cookieHeader)
  }

  return fetch(url, {
    ...init,
    headers: requestHeaders,
    cache: 'no-store',
  })
}

async function fetchPurchaseOrder(id: string): Promise<PurchaseOrderDetail | null> {
  const response = await apiFetch(`/api/purchase-orders/${id}`)

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    let message = 'Failed to load purchase order'

    try {
      const payload = (await response.json()) as { error?: string }
      if (payload?.error) {
        message = payload.error
      }
    } catch {
      // Ignore JSON parsing errors and keep fallback message.
    }

    throw new Error(message)
  }

  return (await response.json()) as PurchaseOrderDetail
}

export default async function PurchaseOrderDetailPage({ params }: PurchaseOrderDetailPageProps) {
  const { id } = await params
  const purchaseOrder = await fetchPurchaseOrder(id)

  if (!purchaseOrder) {
    return (
      <StudioGate>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
          <Button asChild variant="ghost" className="h-auto w-fit px-0 text-muted-foreground hover:bg-transparent hover:text-foreground">
            <Link href="/purchase-orders">&larr; Purchase Orders</Link>
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>PO not found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The purchase order you requested does not exist or you do not have access to it.
              </p>
            </CardContent>
          </Card>
        </div>
      </StudioGate>
    )
  }

  const supabase = await createClient()
  const { data: approvalRecordsData, error: approvalsError } = await (supabase.from('po_approval_records') as any)
    .select('id, step_label, step_order, status, decided_at')
    .eq('po_id', id)
    .order('step_order', { ascending: true })

  if (approvalsError) {
    console.error('[PO Detail] approval timeline query error:', approvalsError)
  }

  const approvalRecords = ((approvalRecordsData || []) as ApprovalRecord[])
    .sort((a, b) => a.step_order - b.step_order)

  const submitForApproval = async (_formData: FormData) => {
    'use server'

    let redirectTo: string | null = null

    try {
      const applyResponse = await apiFetch('/api/settings/purchase-order-workflow/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ po_id: id }),
      })

      if (!applyResponse.ok) {
        let message = 'Failed to apply purchase order approval workflow'

        try {
          const payload = (await applyResponse.json()) as { error?: string }
          if (payload?.error) {
            message = payload.error
          }
        } catch {
          // Keep fallback message when response is not JSON.
        }

        throw new Error(message)
      }

      const updateResponse = await apiFetch(`/api/purchase-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending_approval' }),
      })

      if (!updateResponse.ok) {
        let message = 'Failed to submit purchase order for approval'

        try {
          const payload = (await updateResponse.json()) as { error?: string }
          if (payload?.error) {
            message = payload.error
          }
        } catch {
          // Keep fallback message when response is not JSON.
        }

        throw new Error(message)
      }

      revalidatePath(`/purchase-orders/${id}`)
      revalidatePath('/purchase-orders')
      redirectTo = `/purchase-orders/${id}`
    } catch (error) {
      console.error('[PO Detail] submit for approval error:', error)
      throw error
    }

    if (redirectTo) redirect(redirectTo)
  }

  return (
    <StudioGate>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
        <Button asChild variant="ghost" className="h-auto w-fit px-0 text-muted-foreground hover:bg-transparent hover:text-foreground">
          <Link href="/purchase-orders">&larr; Purchase Orders</Link>
        </Button>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>PO Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Supplier</p>
                    <p className="mt-1 font-medium">{purchaseOrder.contacts?.name || 'No supplier'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Issue Date</p>
                    <p className="mt-1 font-medium">{formatDate(purchaseOrder.issue_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Expected Delivery</p>
                    <p className="mt-1 font-medium">
                      {purchaseOrder.expected_delivery_date
                        ? formatDate(purchaseOrder.expected_delivery_date)
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Reference Number</p>
                    <p className="mt-1 font-medium">{purchaseOrder.reference_number || '-'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {purchaseOrder.notes || '-'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Line Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-[120px] text-right">Qty</TableHead>
                        <TableHead className="w-[140px] text-right">Rate</TableHead>
                        <TableHead className="w-[160px] text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseOrder.po_line_items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                            No line items
                          </TableCell>
                        </TableRow>
                      ) : (
                        purchaseOrder.po_line_items.map((lineItem) => (
                          <TableRow key={lineItem.id}>
                            <TableCell>{lineItem.description || '-'}</TableCell>
                            <TableCell>{lineItem.items?.name || lineItem.item?.name || '-'}</TableCell>
                            <TableCell className="text-right">{lineItem.quantity ?? '-'}</TableCell>
                            <TableCell className="text-right">{formatCurrency(normalizeCents(lineItem.rate))}</TableCell>
                            <TableCell className="text-right">{formatCurrency(normalizeCents(lineItem.amount))}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end">
                  <div className="w-full max-w-sm space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatCurrency(normalizeCents(purchaseOrder.subtotal))}</span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
                      <span>Total</span>
                      <span>{formatCurrency(normalizeCents(purchaseOrder.total))}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Comments & Discussion</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">No comments yet</p>
                <div className="space-y-3">
                  <Textarea placeholder="Add a comment..." rows={3} />
                  <div className="flex justify-end">
                    <Button type="button">Send</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{purchaseOrder.number}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={STATUS_COLORS[purchaseOrder.status] || STATUS_COLORS.draft}>
                    {formatStatusLabel(purchaseOrder.status)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">{formatDate(purchaseOrder.created_at)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Approval Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {approvalRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No approval workflow assigned</p>
                ) : (
                  <div className="space-y-4">
                    {approvalRecords.map((record) => (
                      <div key={record.id} className="flex items-start gap-3">
                        <span
                          className={cn(
                            'mt-2 h-2.5 w-2.5 rounded-full',
                            APPROVAL_DOT_COLORS[record.status] || 'bg-zinc-400'
                          )}
                        />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{record.step_label}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatStatusLabel(record.status)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {record.decided_at ? formatDate(record.decided_at) : 'Awaiting approval'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent>
                {purchaseOrder.status === 'draft' && (
                  <form action={submitForApproval}>
                    <Button className="w-full bg-violet-600 hover:bg-violet-700" type="submit">
                      Submit for Approval
                    </Button>
                  </form>
                )}
                
                <POActions 
                  poId={purchaseOrder.id}
                  status={purchaseOrder.status}
                  currentStepOrder={purchaseOrder.current_step_order ?? 1}
                  totalSteps={approvalRecords.length}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </StudioGate>
  )
}
