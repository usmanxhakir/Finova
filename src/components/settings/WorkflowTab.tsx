'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'

type TeamMember = {
  id: string
  full_name: string | null
  email: string
  role: string
  is_active: boolean
}

type WorkflowDto = {
  id: string
  name: string
  is_active: boolean
}

type StepDto = {
  id: string
  step_order: number
  step_label: string
  approver_user_id: string | null
  approver_email: string | null
  approver_user_email?: string | null
}

type TierDto = {
  id: string
  name: string
  min_amount: string | number | bigint
  max_amount: string | number | bigint | null
  steps: StepDto[]
}

type WorkflowResponse =
  | null
  | {
      workflow: WorkflowDto
      tiers: TierDto[]
    }

type StepState = {
  client_id: string
  step_order: number
  step_label: string
  approver_user_id: string | null
  approver_email: string
}

type TierState = {
  client_id: string
  name: string
  minAmount: string
  maxAmount: string
  steps: StepState[]
}

function newClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function centsToDollarsInput(cents: TierDto['min_amount'] | TierDto['max_amount']) {
  if (cents === null || cents === undefined) return ''
  const raw = typeof cents === 'bigint' ? cents.toString() : String(cents)
  if (!raw) return ''

  let value = raw.trim()
  if (value === '') return ''
  if (value.startsWith('-')) return ''

  const bigintValue = BigInt(value)
  const dollars = bigintValue / BigInt(100)
  const remainder = bigintValue % BigInt(100)
  const centsStr = remainder.toString().padStart(2, '0')
  return `${dollars.toString()}.${centsStr}`
}

function dollarsToCentsString(input: string) {
  const normalized = input.trim().replace(/,/g, '')
  if (normalized === '') throw new Error('Amount is required')
  if (!/^\d*(\.\d{0,2})?$/.test(normalized)) {
    throw new Error('Enter a valid dollar amount (up to 2 decimals)')
  }

  const [dollarsPartRaw, centsPartRaw = ''] = normalized.split('.')
  const dollarsPart = dollarsPartRaw === '' ? '0' : dollarsPartRaw
  const centsPart = centsPartRaw.padEnd(2, '0')

  const cents = BigInt(dollarsPart) * BigInt(100) + BigInt(centsPart)
  return cents.toString()
}

function normalizeStepOrders(steps: StepState[]) {
  return steps
    .filter(Boolean)
    .map((step, idx) => ({ ...step, step_order: idx + 1 }))
}

function WorkflowTabSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-9 w-full max-w-md" />
          <Skeleton className="h-5 w-40" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Amount Tiers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-9 w-32" />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  )
}

export function WorkflowTab({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [workflow, setWorkflow] = useState<WorkflowDto | null>(null)
  const [tiers, setTiers] = useState<TierState[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  const activeTeamMembers = useMemo(
    () => teamMembers.filter((member) => member.is_active),
    [teamMembers]
  )

  const fetchWorkflow = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/purchase-order-workflow')
      const json = (await res.json()) as WorkflowResponse
      if (!res.ok) {
        const message = (json as any)?.error || 'Failed to load workflow'
        throw new Error(message)
      }

      if (!json) {
        setWorkflow(null)
        setTiers([])
        return
      }

      setWorkflow(json.workflow)
      setTiers(
        (json.tiers || []).map((tier) => ({
          client_id: tier.id || newClientId(),
          name: tier.name || '',
          minAmount: centsToDollarsInput(tier.min_amount),
          maxAmount: tier.max_amount === null ? '' : centsToDollarsInput(tier.max_amount),
          steps: normalizeStepOrders((tier.steps || []).map((step) => ({
            client_id: step.id || newClientId(),
            step_order: step.step_order,
            step_label: step.step_label || '',
            approver_user_id: step.approver_user_id,
            approver_email: step.approver_email || '',
          }))),
        }))
      )
    } catch (error: any) {
      toast.error(error.message || 'Failed to load workflow')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/users')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load users')
      setTeamMembers(Array.isArray(json) ? (json as TeamMember[]) : [])
    } catch (error: any) {
      toast.error(error.message || 'Failed to load users')
    }
  }, [])

  useEffect(() => {
    fetchWorkflow()
    fetchUsers()
  }, [fetchWorkflow, fetchUsers])

  const createWorkflowDraft = () => {
    setWorkflow({
      id: `draft:${companyId}`,
      name: 'Purchase Order Workflow',
      is_active: true,
    })
    setTiers([
      {
        client_id: newClientId(),
        name: 'Standard',
        minAmount: '0.00',
        maxAmount: '',
        steps: [
          {
            client_id: newClientId(),
            step_order: 1,
            step_label: 'Approval',
            approver_user_id: null,
            approver_email: '',
          },
        ],
      },
    ])
  }

  const updateTier = (clientId: string, patch: Partial<TierState>) => {
    setTiers((prev) => prev.map((tier) => (tier.client_id === clientId ? { ...tier, ...patch } : tier)))
  }

  const deleteTier = (clientId: string) => {
    setTiers((prev) => prev.filter((tier) => tier.client_id !== clientId))
  }

  const addTier = () => {
    setTiers((prev) => [
      ...prev,
      {
        client_id: newClientId(),
        name: 'New Tier',
        minAmount: '',
        maxAmount: '',
        steps: [],
      },
    ])
  }

  const addStep = (tierClientId: string) => {
    setTiers((prev) =>
      prev.map((tier) => {
        if (tier.client_id !== tierClientId) return tier
        const nextSteps = normalizeStepOrders([
          ...tier.steps,
          {
            client_id: newClientId(),
            step_order: tier.steps.length + 1,
            step_label: '',
            approver_user_id: null,
            approver_email: '',
          },
        ])
        return { ...tier, steps: nextSteps }
      })
    )
  }

  const updateStep = (tierClientId: string, stepClientId: string, patch: Partial<StepState>) => {
    setTiers((prev) =>
      prev.map((tier) => {
        if (tier.client_id !== tierClientId) return tier
        return {
          ...tier,
          steps: tier.steps.map((step) => (step.client_id === stepClientId ? { ...step, ...patch } : step)),
        }
      })
    )
  }

  const deleteStep = (tierClientId: string, stepClientId: string) => {
    setTiers((prev) =>
      prev.map((tier) => {
        if (tier.client_id !== tierClientId) return tier
        const remaining = tier.steps.filter((step) => step.client_id !== stepClientId)
        return { ...tier, steps: normalizeStepOrders(remaining) }
      })
    )
  }

  const saveWorkflow = async () => {
    if (!workflow) return

    try {
      if (!workflow.name.trim()) throw new Error('Workflow name is required')
      if (tiers.length === 0) throw new Error('Add at least one tier')

      const payload = {
        name: workflow.name.trim(),
        is_active: Boolean(workflow.is_active),
        tiers: tiers.map((tier) => {
          if (!tier.name.trim()) throw new Error('Tier name is required')

          const minCents = dollarsToCentsString(tier.minAmount)
          const maxCents = tier.maxAmount.trim() === '' ? null : dollarsToCentsString(tier.maxAmount)

          if (maxCents !== null) {
            const min = BigInt(minCents)
            const max = BigInt(maxCents)
            if (max < min) throw new Error(`Tier "${tier.name}" max amount must be >= min amount`)
          }

          const steps = normalizeStepOrders(tier.steps).map((step) => {
            if (!step.step_label.trim()) throw new Error('Step label is required')

            const approverUserId = step.approver_user_id
            const approverEmail = step.approver_email.trim()

            if (!approverUserId && !approverEmail) {
              throw new Error(`Step "${step.step_label}" needs an approver`)
            }
            if (approverUserId && approverEmail) {
              throw new Error(`Step "${step.step_label}" cannot have both a user and an external email`)
            }

            return {
              step_order: step.step_order,
              step_label: step.step_label.trim(),
              approver_user_id: approverUserId,
              approver_email: approverUserId ? null : approverEmail,
            }
          })

          return {
            name: tier.name.trim(),
            min_amount: minCents,
            max_amount: maxCents,
            steps,
          }
        }),
      }

      setSaving(true)
      const res = await fetch('/api/settings/purchase-order-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to save workflow')

      toast.success('Workflow saved')
      fetchWorkflow()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save workflow')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <WorkflowTabSkeleton />

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!workflow ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">No workflow configured</p>
                <p className="text-sm text-muted-foreground">Create an approval workflow for purchase orders.</p>
              </div>
              <Button onClick={createWorkflowDraft}>
                <Plus className="h-4 w-4" />
                Create Workflow
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="po-workflow-name">Workflow name</Label>
                  <Input
                    id="po-workflow-name"
                    value={workflow.name}
                    onChange={(e) => setWorkflow((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                    placeholder="Purchase Order Approvals"
                  />
                </div>

                <div className="flex items-end">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="po-workflow-active"
                      checked={workflow.is_active}
                      onCheckedChange={(checked) =>
                        setWorkflow((prev) => (prev ? { ...prev, is_active: Boolean(checked) } : prev))
                      }
                    />
                    <Label htmlFor="po-workflow-active">Active</Label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {workflow && (
        <Card>
          <CardHeader>
            <CardTitle>Amount Tiers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {tiers.map((tier) => (
              <div key={tier.client_id} className="rounded-lg border p-4 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 space-y-2">
                    <Label>Tier name</Label>
                    <Input
                      value={tier.name}
                      onChange={(e) => updateTier(tier.client_id, { name: e.target.value })}
                      placeholder="Standard"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button variant="destructive" size="sm" onClick={() => deleteTier(tier.client_id)}>
                      <Trash2 className="h-4 w-4" />
                      Delete Tier
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Min amount (USD)</Label>
                    <Input
                      inputMode="decimal"
                      value={tier.minAmount}
                      onChange={(e) => updateTier(tier.client_id, { minAmount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max amount (USD)</Label>
                    <Input
                      inputMode="decimal"
                      value={tier.maxAmount}
                      onChange={(e) => updateTier(tier.client_id, { maxAmount: e.target.value })}
                      placeholder="No limit"
                    />
                    <p className="text-xs text-muted-foreground">Leave blank for no limit.</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Approval Steps</p>
                    <Button variant="outline" size="sm" onClick={() => addStep(tier.client_id)}>
                      <Plus className="h-4 w-4" />
                      Add Step
                    </Button>
                  </div>

                  {tier.steps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No steps yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {tier.steps.map((step) => {
                        const selectedApproverValue = step.approver_user_id
                          ? `user:${step.approver_user_id}`
                          : 'external'

                        return (
                          <div key={step.client_id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[80px_1fr_260px_auto]">
                            <div className="space-y-2">
                              <Label>Order</Label>
                              <Input value={String(step.step_order)} disabled />
                            </div>

                            <div className="space-y-2">
                              <Label>Label</Label>
                              <Input
                                value={step.step_label}
                                onChange={(e) => updateStep(tier.client_id, step.client_id, { step_label: e.target.value })}
                                placeholder="Team Lead Approval"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Approver</Label>
                              <Select
                                value={selectedApproverValue}
                                onValueChange={(value) => {
                                  if (value === 'external') {
                                    updateStep(tier.client_id, step.client_id, {
                                      approver_user_id: null,
                                    })
                                    return
                                  }
                                  if (value.startsWith('user:')) {
                                    updateStep(tier.client_id, step.client_id, {
                                      approver_user_id: value.slice('user:'.length),
                                      approver_email: '',
                                    })
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select approver" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="external">External email</SelectItem>
                                  {activeTeamMembers.map((member) => (
                                    <SelectItem key={member.id} value={`user:${member.id}`}>
                                      {member.email}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {!step.approver_user_id && (
                                <Input
                                  value={step.approver_email}
                                  onChange={(e) => updateStep(tier.client_id, step.client_id, { approver_email: e.target.value })}
                                  placeholder="approver@vendor.com"
                                />
                              )}
                            </div>

                            <div className="flex items-end justify-end">
                              <Button
                                variant="destructive"
                                size="icon-sm"
                                onClick={() => deleteStep(tier.client_id, step.client_id)}
                                aria-label="Delete step"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div className="flex justify-end">
              <Button variant="outline" onClick={addTier}>
                <Plus className="h-4 w-4" />
                Add Tier
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {workflow && (
        <div className="flex justify-end">
          <Button onClick={saveWorkflow} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      )}
    </div>
  )
}
