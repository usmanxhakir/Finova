/* eslint-disable @typescript-eslint/no-explicit-any */
import { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendApprovalEmail } from '@/lib/purchase-orders/send-approval-email'

type ApprovalRecord = {
  id: string
  po_id: string
  step_label: string
  step_order: number
  approval_token: string
  approver_email: string | null
  approver_user_id: string | null
}

function toNumberCents(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

async function fetchPurchaseOrderEmailContext(supabase: SupabaseClient, poId: string) {
  const { data: po } = await (supabase.from('purchase_orders') as any)
    .select('number, total, currency, created_by, contacts!purchase_orders_contact_id_fkey(name), companies(name)')
    .eq('id', poId)
    .limit(1)
    .maybeSingle()

  let submitterName = 'A team member'
  if (po?.created_by) {
    const { data: submitterProfile } = await (supabase.from('profiles') as any)
      .select('full_name')
      .eq('id', po.created_by)
      .limit(1)
      .maybeSingle()

    submitterName = submitterProfile?.full_name || submitterName
  }

  return {
    poNumber: po?.number ?? 'N/A',
    poTotal: toNumberCents(po?.total),
    currency: po?.currency ?? 'USD',
    vendorName: po?.contacts?.name ?? 'Unknown Vendor',
    submittedByName: submitterName,
    companyName: po?.companies?.name ?? 'Your Company',
  }
}

export async function sendExternalApprovalEmailForRecord(record: ApprovalRecord) {
  if (!record.approver_email || record.approver_user_id) return false

  const supabase = createAdminClient()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error: updateError } = await (supabase.from('po_approval_records') as any)
    .update({
      token_expires_at: expiresAt,
      email_sent_at: now.toISOString(),
    })
    .eq('id', record.id)

  if (updateError) throw new Error(updateError.message)

  const emailContext = await fetchPurchaseOrderEmailContext(supabase, record.po_id)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  await sendApprovalEmail({
    to: record.approver_email,
    approvalToken: record.approval_token,
    stepLabel: record.step_label,
    appUrl,
    ...emailContext,
  })

  return true
}

export async function sendExternalApprovalEmailForCurrentStep(poId: string) {
  const supabase = createAdminClient()

  const { data: record, error } = await (supabase.from('po_approval_records') as any)
    .select('id, po_id, step_label, step_order, approval_token, approver_email, approver_user_id')
    .eq('po_id', poId)
    .eq('status', 'pending')
    .order('step_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!record) return false

  return sendExternalApprovalEmailForRecord(record)
}
