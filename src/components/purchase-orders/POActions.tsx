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

export default function POActions({
  poId,
  status,
  currentStepOrder,
  totalSteps,
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
    } catch (error: any) {
      toast.error(error.message || 'An error occurred while approving')
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
    } catch (error: any) {
      toast.error(error.message || 'An error occurred while rejecting')
    } finally {
      setIsRejecting(false)
    }
  }

  if (status === 'draft') {
    return null
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
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <Button type="button" className="w-full" disabled>
        Convert to Bill
      </Button>
    )
  }

  if (status === 'void' || status === 'converted' || status === 'rejected') {
    return (
      <p className="text-sm text-muted-foreground">
        No actions available for this purchase order status.
      </p>
    )
  }

  return null
}
