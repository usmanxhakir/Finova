'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChevronDown, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface PurchaseOrder {
  id: string
  po_number: string
  status: string
  created_at: string
  total_amount: number // BIGINT cents
  contacts: { name: string } | null
}

interface POListProps {
  initialData: PurchaseOrder[]
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  converted: 'bg-violet-100 text-violet-800',
  void: 'bg-gray-100 text-gray-400 line-through',
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'converted', label: 'Converted' },
  { value: 'void', label: 'Void' },
]

export default function POList({ initialData }: POListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Client-side filtering
  const filteredPOs = useMemo(() => {
    let filtered = [...initialData]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (po) =>
          po.po_number.toLowerCase().includes(term) ||
          (po.contacts?.name?.toLowerCase().includes(term) ?? false)
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((po) => po.status === statusFilter)
    }

    return filtered
  }, [initialData, searchTerm, statusFilter])

  if (filteredPOs.length === 0 && initialData.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-600 mb-4">
          No purchase orders found
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Start by creating your first purchase order
        </p>
        <Button asChild className="bg-violet-600 hover:bg-violet-700">
          <Link href="/purchase-orders/new">
            <Plus className="mr-2 h-4 w-4" />
            New Purchase Order
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-4 md:flex-row md:items-center flex-1">
          <div className="relative flex-1 md:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search PO # or supplier..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchTerm(e.target.value)
              }
              className="pl-10"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full md:w-48">
                {
                  STATUS_OPTIONS.find((opt) => opt.value === statusFilter)
                    ?.label
                }
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {STATUS_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setStatusFilter(option.value)}
                  className="cursor-pointer"
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button asChild className="bg-violet-600 hover:bg-violet-700">
          <Link href="/purchase-orders/new">
            <Plus className="mr-2 h-4 w-4" />
            New PO
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO #</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPOs.map((po) => (
              <TableRow
                key={po.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => {
                  window.location.href = `/purchase-orders/${po.id}`
                }}
              >
                <TableCell className="font-medium">{po.po_number}</TableCell>
                <TableCell>{po.contacts?.name || 'No supplier'}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(po.total_amount)}
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[po.status] || STATUS_COLORS.draft}>
                    {po.status.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {new Date(po.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}