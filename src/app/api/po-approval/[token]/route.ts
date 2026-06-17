/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendExternalApprovalEmailForCurrentStep } from '@/lib/purchase-orders/approval-notifications'

function isExpired(expiresAt: string | null | undefined) {
  return Boolean(expiresAt && new Date(expiresAt) < new Date())
}

async function getApprovalRecord(token: string) {
  const supabase = createAdminClient()

  const { data: record, error } = await (supabase.from('po_approval_records') as any)
    .select('*')
    .eq('approval_token', token)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)

  return { supabase, record }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { supabase, record } = await getApprovalRecord(token)

    if (!record) return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 404 })

    // Guard against stale links: check the parent PO is still pending_approval
    const { data: parentPo, error: parentPoError } = await (supabase.from('purchase_orders') as any)
      .select('status')
      .eq('id', record.po_id)
      .limit(1)
      .maybeSingle()

    if (parentPoError) throw new Error(parentPoError.message)
    if (!parentPo || parentPo.status !== 'pending_approval') {
      return NextResponse.json(
        { error: 'This purchase order is no longer pending approval.' },
        { status: 410 }
      )
    }

    if (record.status !== 'pending') {
      return NextResponse.json({
        error: 'This approval link has already been used.',
        status: record.status,
        decided_at: record.decided_at,
      }, { status: 409 })
    }

    if (isExpired(record.token_expires_at)) {
      return NextResponse.json({ error: 'This approval link has expired.' }, { status: 410 })
    }

    const { data: po, error: poError } = await (supabase.from('purchase_orders') as any)
      .select(`
        id, number, status, issue_date, expected_delivery_date,
        currency, subtotal, tax_amount, total, notes,
        contacts!purchase_orders_contact_id_fkey(id, name, email),
        po_line_items(id, description, quantity, rate, amount, items(name))
      `)
      .eq('id', record.po_id)
      .limit(1)
      .maybeSingle()

    if (poError) throw new Error(poError.message)
    if (!po) return NextResponse.json({ error: 'Purchase order not found.' }, { status: 404 })

    // ── A) Approval timeline ──────────────────────────────────────────────────
    const { data: approvalRecords, error: arError } = await (supabase.from('po_approval_records') as any)
      .select('id, step_order, step_label, status, decided_at, decision_notes, approver_user_id, approver_email')
      .eq('po_id', record.po_id)
      .order('step_order', { ascending: true })

    if (arError) throw new Error(arError.message)

    const timelineRows: any[] = approvalRecords || []

    // Resolve approver names in bulk (two-step fetch)
    const approverUserIds = [...new Set(
      timelineRows.map((r: any) => r.approver_user_id).filter(Boolean)
    )]
    let approverProfileMap: Record<string, string> = {}
    if (approverUserIds.length > 0) {
      const { data: approverProfiles } = await (supabase.from('profiles') as any)
        .select('id, full_name')
        .in('id', approverUserIds)
      for (const p of approverProfiles || []) {
        approverProfileMap[p.id] = p.full_name
      }
    }

    const timeline = timelineRows.map((r: any) => ({
      step_order: r.step_order,
      step_label: r.step_label,
      status: r.status,
      decided_at: r.decided_at,
      decision_notes: r.decision_notes,
      approver_name: r.approver_user_id
        ? (approverProfileMap[r.approver_user_id] ?? r.approver_email)
        : r.approver_email,
    }))

    // ── B) Comment thread ─────────────────────────────────────────────────────
    const { data: rawComments, error: commentsError } = await (supabase.from('po_comments') as any)
      .select('id, content, created_at, user_id, author_email')
      .eq('po_id', record.po_id)
      .order('created_at', { ascending: true })

    if (commentsError) throw new Error(commentsError.message)

    const commentRows: any[] = rawComments || []

    const commentUserIds = [...new Set(
      commentRows.map((c: any) => c.user_id).filter(Boolean)
    )]
    let commentProfileMap: Record<string, string> = {}
    if (commentUserIds.length > 0) {
      const { data: commentProfiles } = await (supabase.from('profiles') as any)
        .select('id, full_name')
        .in('id', commentUserIds)
      for (const p of commentProfiles || []) {
        commentProfileMap[p.id] = p.full_name
      }
    }

    const comments = commentRows.map((c: any) => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      author: c.user_id
        ? (commentProfileMap[c.user_id] ?? 'Unknown')
        : (c.author_email ? `External — ${c.author_email}` : 'External'),
    }))

    return NextResponse.json({
      record: {
        id: record.id,
        step_label: record.step_label,
        step_order: record.step_order,
        approver_email: record.approver_email,
      },
      po,
      timeline,
      comments,
    })
  } catch (error) {
    console.error('[PO Approval GET]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { action, comment } = await request.json().catch(() => ({}))

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
    }

    if (action === 'reject' && !String(comment || '').trim()) {
      return NextResponse.json({ error: 'Rejection comment is required.' }, { status: 400 })
    }

    const { supabase, record } = await getApprovalRecord(token)

    if (!record) return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 404 })

    // Guard against stale links: check the parent PO is still pending_approval
    const { data: parentPo, error: parentPoError } = await (supabase.from('purchase_orders') as any)
      .select('status')
      .eq('id', record.po_id)
      .limit(1)
      .maybeSingle()

    if (parentPoError) throw new Error(parentPoError.message)
    if (!parentPo || parentPo.status !== 'pending_approval') {
      return NextResponse.json(
        { error: 'This purchase order is no longer pending approval.' },
        { status: 410 }
      )
    }

    if (record.status !== 'pending') return NextResponse.json({ error: 'Already decided.' }, { status: 409 })
    if (isExpired(record.token_expires_at)) {
      return NextResponse.json({ error: 'This link has expired.' }, { status: 410 })
    }

    const now = new Date().toISOString()
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const trimmedComment = typeof comment === 'string' ? comment.trim() : ''

    const { data: updatedRecord, error: updateRecordError } = await (supabase.from('po_approval_records') as any)
      .update({
        status: newStatus,
        decided_at: now,
        decision_notes: trimmedComment || null,
      })
      .eq('id', record.id)
      .eq('status', 'pending')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (updateRecordError) throw new Error(updateRecordError.message)
    if (!updatedRecord) return NextResponse.json({ error: 'Already decided.' }, { status: 409 })

    if (trimmedComment) {
      try {
        const label = action === 'approve' ? 'Approved' : 'Rejected'
        await (supabase.from('po_comments') as any).insert({
          po_id: record.po_id,
          company_id: record.company_id,
          user_id: null,
          author_email: record.approver_email,
          content: `${label} (${record.step_label}): ${trimmedComment}`,
        })
      } catch (commentError) {
        console.error('[PO Approval POST] comment insert failed:', commentError)
      }
    }

    if (action === 'reject') {
      const { error: updatePoError } = await (supabase.from('purchase_orders') as any)
        .update({ status: 'rejected' })
        .eq('id', record.po_id)

      if (updatePoError) throw new Error(updatePoError.message)
    } else {
      const { data: nextRecord, error: nextRecordError } = await (supabase.from('po_approval_records') as any)
        .select('step_order')
        .eq('po_id', record.po_id)
        .eq('status', 'pending')
        .order('step_order', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (nextRecordError) throw new Error(nextRecordError.message)

      const updatePoData = nextRecord
        ? { current_step_order: nextRecord.step_order }
        : { status: 'approved' }

      const { error: updatePoError } = await (supabase.from('purchase_orders') as any)
        .update(updatePoData)
        .eq('id', record.po_id)

      if (updatePoError) throw new Error(updatePoError.message)

      if (nextRecord) {
        try {
          await sendExternalApprovalEmailForCurrentStep(record.po_id)
        } catch (emailError) {
          console.error('[PO Approval POST] email send failed:', emailError)
        }
      }
    }

    return NextResponse.json({ success: true, action })
  } catch (error) {
    console.error('[PO Approval POST]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
