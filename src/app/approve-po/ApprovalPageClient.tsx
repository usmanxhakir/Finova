'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle, Loader2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type PageState = 'loading' | 'ready' | 'already_decided' | 'expired' | 'invalid' | 'submitting' | 'done' | 'error'

type ApprovalRecord = {
  id: string
  step_label: string
  step_order: number
  approver_email: string | null
}

type PurchaseOrderLineItem = {
  id: string
  description: string | null
  quantity: number | string | null
  rate: number | string | null
  amount: number | string | null
  items?: { name: string | null } | null
}

type PurchaseOrder = {
  id: string
  number: string
  status: string
  issue_date: string | null
  expected_delivery_date: string | null
  currency: string | null
  subtotal: number | string | null
  tax_amount?: number | string | null
  total: number | string | null
  notes: string | null
  contacts?: { name: string | null } | null
  po_line_items?: PurchaseOrderLineItem[]
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function formatCurrency(cents: number | string | null | undefined, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(toNumber(cents) / 100)
}

function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export default function ApprovalPageClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [state, setState] = useState<PageState>('loading')
  const [poData, setPoData] = useState<PurchaseOrder | null>(null)
  const [recordData, setRecordData] = useState<ApprovalRecord | null>(null)
  const [comment, setComment] = useState('')
  const [decidedAction, setDecidedAction] = useState<'approve' | 'reject' | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setState('invalid')
      return
    }

    fetch(`/api/po-approval/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))

        if (response.status === 404) {
          setState('invalid')
          return
        }
        if (response.status === 409) {
          setState('already_decided')
          return
        }
        if (response.status === 410) {
          setState('expired')
          return
        }
        if (!response.ok) {
          setErrorMsg(data.error || 'Failed to load purchase order.')
          setState('error')
          return
        }

        setPoData(data.po)
        setRecordData(data.record)
        setState('ready')
      })
      .catch(() => {
        setErrorMsg('Network error. Please try again.')
        setState('error')
      })
  }, [token])

  const handleDecision = async (action: 'approve' | 'reject') => {
    if (!token) return

    if (action === 'reject' && !comment.trim()) {
      setErrorMsg('Please provide a reason for rejection.')
      return
    }

    setState('submitting')
    setErrorMsg('')

    try {
      const response = await fetch(`/api/po-approval/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: comment.trim() || null }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setErrorMsg(data.error || 'Failed to submit your decision.')
        setState('ready')
        return
      }

      setDecidedAction(action)
      setState('done')
    } catch {
      setErrorMsg('Network error. Please try again.')
      setState('ready')
    }
  }

  if (state === 'loading') {
    return (
      <Screen>
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          <p>Loading purchase order...</p>
        </div>
      </Screen>
    )
  }

  if (state === 'invalid' || state === 'error') {
    return (
      <Screen>
        <StatusCard icon={<AlertCircle className="h-10 w-10 text-red-500" />} title="Invalid Link">
          <p className="text-center text-sm text-gray-500">
            {errorMsg || 'This approval link is invalid or does not exist.'}
          </p>
        </StatusCard>
      </Screen>
    )
  }

  if (state === 'expired') {
    return (
      <Screen>
        <StatusCard icon={<AlertCircle className="h-10 w-10 text-amber-500" />} title="Link Expired">
          <p className="text-center text-sm text-gray-500">
            This approval link has expired. Please contact the sender to request a new one.
          </p>
        </StatusCard>
      </Screen>
    )
  }

  if (state === 'already_decided') {
    return (
      <Screen>
        <StatusCard icon={<CheckCircle className="h-10 w-10 text-gray-400" />} title="Already Decided">
          <p className="text-center text-sm text-gray-500">
            This approval link has already been used. No further action is needed.
          </p>
        </StatusCard>
      </Screen>
    )
  }

  if (state === 'done') {
    const isApproved = decidedAction === 'approve'
    return (
      <Screen>
        <StatusCard
          icon={isApproved
            ? <CheckCircle className="h-12 w-12 text-green-500" />
            : <XCircle className="h-12 w-12 text-red-500" />}
          title={isApproved ? `You approved ${poData?.number}` : `You rejected ${poData?.number}`}
        >
          <p className="text-center text-sm text-gray-500">
            {isApproved
              ? 'Your approval has been recorded.'
              : 'Your rejection has been recorded.'}
          </p>
        </StatusCard>
      </Screen>
    )
  }

  const po = poData
  const lineItems = po?.po_line_items ?? []
  const currency = po?.currency || 'USD'
  const isSubmitting = state === 'submitting'

  return (
    <Screen>
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-violet-600">
            <span className="text-sm font-bold text-white">PO</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Purchase Order Review</h1>
          <p className="mt-1 text-sm text-gray-500">
            You have been requested to review this purchase order as <strong>{recordData?.step_label}</strong>.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Purchase Order</p>
              <p className="text-lg font-bold text-gray-900">{po?.number}</p>
            </div>
            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-600">
              Pending Approval
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b border-gray-100 px-6 py-4">
            <SummaryItem label="Vendor" value={po?.contacts?.name ?? '-'} />
            <SummaryItem label="Issue Date" value={formatDate(po?.issue_date)} />
            <SummaryItem label="Expected Delivery" value={formatDate(po?.expected_delivery_date)} />
            <SummaryItem label="Total Amount" value={formatCurrency(po?.total, currency)} strong />
          </div>

          <div className="px-6 py-4">
            <p className="mb-3 text-xs uppercase tracking-wide text-gray-400">Line Items</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400">
                    <th className="pb-2 text-left font-medium">Item</th>
                    <th className="pb-2 text-right font-medium">Qty</th>
                    <th className="pb-2 text-right font-medium">Rate</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-gray-500">No line items</td>
                    </tr>
                  ) : (
                    lineItems.map((lineItem) => (
                      <tr key={lineItem.id}>
                        <td className="py-2 text-gray-800">{lineItem.items?.name || lineItem.description || '-'}</td>
                        <td className="py-2 text-right text-gray-600">{lineItem.quantity ?? '-'}</td>
                        <td className="py-2 text-right text-gray-600">{formatCurrency(lineItem.rate, currency)}</td>
                        <td className="py-2 text-right font-medium text-gray-800">{formatCurrency(lineItem.amount, currency)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td colSpan={3} className="pt-3 text-right text-sm font-semibold text-gray-700">Total</td>
                    <td className="pt-3 text-right text-sm font-bold text-gray-900">{formatCurrency(po?.total, currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {po?.notes && (
            <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
              <p className="mb-1 text-xs text-gray-400">Notes</p>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{po.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-700">
            Comment <span className="font-normal text-gray-400">(required for rejection, optional for approval)</span>
          </p>
          <Textarea
            placeholder="Add a comment..."
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            disabled={isSubmitting}
            className="resize-none text-sm"
          />

          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

          <div className="flex gap-3">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => handleDecision('approve')}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Approve
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => handleDecision('reject')}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Reject
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">Powered by Fyntrax</p>
      </div>
    </Screen>
  )
}

function SummaryItem({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={strong ? 'text-sm font-bold text-gray-900' : 'text-sm font-medium text-gray-900'}>{value}</p>
    </div>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      {children}
    </div>
  )
}

function StatusCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-gray-200 bg-white p-8">
      {icon}
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  )
}
