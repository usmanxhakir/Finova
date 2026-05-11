'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Send, Loader2, UserX, UserCheck, Trash2, Users, MailOpen, UserPlus } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  created_at: string
  inviter: { full_name: string } | null
}

interface TeamMember {
  id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

// ─── Role Badge Helpers ────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  if (role === 'accountant') {
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-[11px] font-semibold uppercase">Accountant</Badge>
  }
  if (role === 'admin') {
    return <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 text-[11px] font-semibold uppercase">Admin</Badge>
  }
  return <Badge variant="secondary" className="text-[11px] font-semibold uppercase">Viewer</Badge>
}

function StatusBadge({ active }: { active: boolean }) {
  if (active) {
    return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-[11px] font-semibold uppercase">Active</Badge>
  }
  return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-[11px] font-semibold uppercase">Inactive</Badge>
}

function SkeletonRows({ cols, rows = 3 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function UsersTab({ currentUserProfile }: { currentUserProfile: any }) {
  const isAdmin = currentUserProfile?.role === 'admin'

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'accountant' | 'viewer'>('viewer')
  const [inviting, setInviting] = useState(false)

  // Pending invitations
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [invitationsLoading, setInvitationsLoading] = useState(true)

  // Cancel invite dialog
  const [cancelTarget, setCancelTarget] = useState<Invitation | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // Team members
  const [members, setMembers] = useState<TeamMember[]>([])
  const [membersLoading, setMembersLoading] = useState(true)

  // ── Fetch helpers ────────────────────────────────────────────────────────────

  const fetchInvitations = useCallback(async () => {
    setInvitationsLoading(true)
    try {
      const res = await fetch('/api/settings/invitations')
      if (!res.ok) throw new Error(await res.text())
      setInvitations(await res.json())
    } catch (e: any) {
      toast.error(e.message || 'Failed to load invitations')
    } finally {
      setInvitationsLoading(false)
    }
  }, [])

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true)
    try {
      const res = await fetch('/api/settings/users')
      if (!res.ok) throw new Error(await res.text())
      setMembers(await res.json())
    } catch (e: any) {
      toast.error(e.message || 'Failed to load team members')
    } finally {
      setMembersLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInvitations()
    fetchMembers()
  }, [fetchInvitations, fetchMembers])

  // ── Invite submit ────────────────────────────────────────────────────────────

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail) return
    setInviting(true)
    try {
      const res = await fetch('/api/settings/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to send invite')
      toast.success(`Invite sent to ${inviteEmail}`)
      setInviteEmail('')
      setInviteRole('viewer')
      fetchInvitations()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setInviting(false)
    }
  }

  // ── Cancel invite ────────────────────────────────────────────────────────────

  async function confirmCancelInvite() {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/settings/invitations/${cancelTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to cancel invitation')
      }
      toast.success(`Invitation to ${cancelTarget.email} cancelled`)
      setCancelTarget(null)
      fetchInvitations()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setCancelling(false)
    }
  }

  // ── Update member ────────────────────────────────────────────────────────────

  async function updateMember(id: string, patch: { role?: string; is_active?: boolean }) {
    try {
      const res = await fetch(`/api/settings/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update member')
      if (patch.role !== undefined) toast.success('Role updated')
      if (patch.is_active !== undefined)
        toast.success(patch.is_active ? 'User reactivated' : 'User deactivated')
      fetchMembers()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Section 1: Invite Form (admin only) ──────────────────────────────── */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-indigo-500" />
              <CardTitle className="text-base">Invite New User</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                required
                className="flex-1"
              />
              <Select
                value={inviteRole}
                onValueChange={v => setInviteRole(v as 'accountant' | 'viewer')}
              >
                <SelectTrigger id="invite-role" className="w-full sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accountant">Accountant</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="submit"
                disabled={inviting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shrink-0"
              >
                {inviting
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                  : <><Send className="h-4 w-4" /> Send Invite</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Section 2: Pending Invitations ───────────────────────────────────── */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <MailOpen className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-base">Pending Invitations</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-b-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-zinc-50/60">
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Invited By</TableHead>
                    <TableHead>Date Sent</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitationsLoading ? (
                    <SkeletonRows cols={isAdmin ? 5 : 4} />
                  ) : invitations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-10 text-sm text-muted-foreground">
                        No pending invitations
                      </TableCell>
                    </TableRow>
                  ) : (
                    invitations.map(inv => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium text-sm">{inv.email}</TableCell>
                        <TableCell><RoleBadge role={inv.role} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {inv.inviter?.full_name || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
                              onClick={() => setCancelTarget(inv)}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Cancel
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Section 3: Team Members ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-500" />
            <CardTitle className="text-base">Team Members</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-b-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50/60">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {membersLoading ? (
                  <SkeletonRows cols={isAdmin ? 5 : 4} />
                ) : members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-10 text-sm text-muted-foreground">
                      No team members found
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map(member => {
                    const isSelf = member.id === currentUserProfile?.id
                    return (
                      <TableRow key={member.id} className={!member.is_active ? 'opacity-60' : ''}>
                        <TableCell>
                          <span className="font-medium text-sm">
                            {member.full_name || 'Unnamed User'}
                            {isSelf && (
                              <span className="ml-2 text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">You</span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{member.email}</TableCell>
                        <TableCell>
                          {isAdmin && !isSelf ? (
                            <Select
                              defaultValue={member.role}
                              onValueChange={val => updateMember(member.id, { role: val })}
                            >
                              <SelectTrigger className="w-[130px] h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="accountant">Accountant</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <RoleBadge role={member.role} />
                          )}
                        </TableCell>
                        <TableCell><StatusBadge active={member.is_active} /></TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            {!isSelf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={
                                  member.is_active
                                    ? 'text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5'
                                    : 'text-green-600 hover:text-green-700 hover:bg-green-50 gap-1.5'
                                }
                                onClick={() => updateMember(member.id, { is_active: !member.is_active })}
                              >
                                {member.is_active
                                  ? <><UserX className="h-3.5 w-3.5" /> Deactivate</>
                                  : <><UserCheck className="h-3.5 w-3.5" /> Reactivate</>}
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Cancel Invitation Confirm Dialog ─────────────────────────────────── */}
      <Dialog open={!!cancelTarget} onOpenChange={open => { if (!open) setCancelTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Invitation</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the invitation sent to{' '}
              <span className="font-semibold text-foreground">{cancelTarget?.email}</span>?
              They will no longer be able to use this invite link.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Keep Invitation
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancelInvite}
              disabled={cancelling}
            >
              {cancelling ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Cancelling…</> : 'Yes, Cancel Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
