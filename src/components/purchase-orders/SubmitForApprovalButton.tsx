'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SubmitForApprovalButtonProps {
  poId: string
}

export default function SubmitForApprovalButton({ poId }: SubmitForApprovalButtonProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/purchase-orders/${poId}/submit`, {
        method: 'POST',
      })

      if (!response.ok) {
        let message = 'Failed to submit purchase order for approval'

        try {
          const payload = (await response.json()) as { error?: string }
          if (payload?.error) {
            message = payload.error
          }
        } catch {
          // Keep fallback message when response is not JSON.
        }

        throw new Error(message)
      }

      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit purchase order for approval')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Button
      type="button"
      className="w-full bg-violet-600 hover:bg-violet-700"
      onClick={handleSubmit}
      disabled={isSubmitting}
    >
      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Submit for Approval
    </Button>
  )
}
