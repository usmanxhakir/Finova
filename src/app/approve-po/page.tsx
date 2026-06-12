import { Suspense } from 'react'
import ApprovalPageClient from './ApprovalPageClient'

export default function ApprovePOPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <ApprovalPageClient />
    </Suspense>
  )
}
