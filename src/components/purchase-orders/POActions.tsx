'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

interface POActionsProps {
  poId: string
  status: string
  currentStepOrder: number
  totalSteps: number
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function ConvertToBillButton({ poId }: { poId: string }) {
  const router = useRouter()
  const [isConverting, setIsConverting] = useState(false)

  const handleConvert = async () => {
    setIsConverting(true)
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/convert-to-bill`, {
        method: 'POST',
      })
      const data = await res.json() as { billId?: string; error?: string }

      if (!res.ok) throw new Error(data.error || 'Failed to convert')
      if (!data.billId) throw new Error('Bill was created but no bill ID was returned')

      toast.success('Purchase order converted to bill')
      router.push(`/bills/${data.billId}`)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'An error occurred'))
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <Button
      type="button"
      className="w-full bg-violet-600 hover:bg-violet-700"
      onClick={handleConvert}
      disabled={isConverting}
    >
      {isConverting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Convert to Bill
    </Button>
  )
}

function VoidButton({ poId }: { poId: string }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [isVoiding, setIsVoiding] = useState(false)

  const handleVoid = async () => {
    if (!showForm) {
      setShowForm(true)
      return
    }

    setIsVoiding(true)
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to void purchase order')
      }

      toast.success('Purchase order voided')
      router.refresh()
      setShowForm(false)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'An error occurred while voiding'))
    } finally {
      setIsVoiding(false)
    }
  }

  if (showForm) {
    return (
      <div className="space-y-2 mt-2">
        <p className="text-sm text-muted-foreground">
          This action cannot be undone. Optionally provide a reason.
        </p>
        <Textarea
          placeholder="Reason for voiding (optional)"
          value={voidReason}
          onChange={(e) => setVoidReason(e.target.value)}
          disabled={isVoiding}
          className="text-sm"
          rows={3}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setShowForm(false)}
            disabled={isVoiding}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={handleVoid}
            disabled={isVoiding}
          >
            {isVoiding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Void
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/40"
      onClick={handleVoid}
    >
      Void
    </Button>
  )
}

export default function POActions({
  poId,
  status,
}: POActionsProps) {
  const router = useRouter()
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/approve`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to approve purchase order')
      }

      toast.success('Purchase order approved successfully')
      router.refresh()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'An error occurred while approving'))
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    if (!showRejectForm) {
      setShowRejectForm(true)
      return
    }

    setIsRejecting(true)
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to reject purchase order')
      }

      toast.success('Purchase order rejected successfully')
      router.refresh()
      setShowRejectForm(false)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'An error occurred while rejecting'))
    } finally {
      setIsRejecting(false)
    }
  }

  if (status === 'draft') {
    return <VoidButton poId={poId} />
  }

  if (status === 'pending_approval') {
    return (
      <div className="grid gap-2">
        <Button
          type="button"
          className="w-full bg-violet-600 hover:bg-violet-700"
          onClick={handleApprove}
          disabled={isApproving || isRejecting}
        >
          {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Approve
        </Button>
        
        {showRejectForm ? (
          <div className="space-y-2 mt-2">
            <Textarea
              placeholder="Reason for rejection (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              disabled={isRejecting}
              className="text-sm"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowRejectForm(false)}
                disabled={isRejecting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={handleReject}
                disabled={isRejecting}
              >
                {isRejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Reject
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleReject}
            disabled={isApproving || isRejecting}
          >
            Reject
          </Button>
        )}

        <VoidButton poId={poId} />
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <div className="grid gap-2">
        <ConvertToBillButton poId={poId} />
        <VoidButton poId={poId} />
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="grid gap-2">
        <VoidButton poId={poId} />
      </div>
    )
  }

  if (status === 'void' || status === 'converted') {
    return (
      <p className="text-sm text-muted-foreground">
        No actions available for this purchase order status.
      </p>
    )
  }

  return null
}
