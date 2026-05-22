'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface Contact {
  id: string
  name: string
  type: 'customer' | 'vendor' | 'both'
}

interface Item {
  id: string
  name: string
  default_rate: number // cents
}

interface LineItem {
  id: string // temporary client ID
  description: string
  item_id: string | null
  quantity: number
  rate: number // cents
  amount: number // cents
}

export default function NewPurchaseOrderPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string | null>(null)
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: '1',
      description: '',
      item_id: null,
      quantity: 1,
      rate: 0,
      amount: 0,
    },
  ])

  // Fetch contacts and items on mount
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const supabase = createClient()

      // Fetch contacts (vendors and both)
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('id, name, type')
        .in('type', ['vendor', 'both'])
        .order('name')

      if (contactsError) throw contactsError
      setContacts(contactsData || [])

      // Fetch items
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('id, name, default_rate')
        .order('name')

      if (itemsError) throw itemsError
      setItems(itemsData || [])
    } catch (err: any) {
      console.error('Failed to fetch data:', err)
      setError('Failed to load suppliers and items')
    } finally {
      setLoading(false)
    }
  }

  // Calculate line item amount
  const calculateAmount = (quantity: number, rate: number): number => {
    return Math.round(quantity * rate)
  }

  // Handle line item changes
  const handleLineItemChange = (lineItemId: string, field: string, value: any) => {
    setLineItems(prev => {
      const updated = prev.map(item => {
        if (item.id === lineItemId) {
          const newItem = { ...item, [field]: value }

          // Recalculate amount if qty or rate changed
          if (field === 'quantity' || field === 'rate') {
            newItem.amount = calculateAmount(newItem.quantity, newItem.rate)
          }

          return newItem
        }
        return item
      })
      return updated
    })
  }

  // Add line item
  const handleAddLineItem = () => {
    const newId = `${Date.now()}-${Math.random()}`
    setLineItems(prev => [
      ...prev,
      {
        id: newId,
        description: '',
        item_id: null,
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ])
  }

  // Remove line item
  const handleRemoveLineItem = (lineItemId: string) => {
    if (lineItems.length <= 1) {
      setError('At least one line item is required')
      return
    }
    setLineItems(prev => prev.filter(item => item.id !== lineItemId))
  }

  // Calculate totals
  const { subtotal, total } = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
    const tax = 0 // Hardcoded for now
    return { subtotal, total: subtotal + tax }
  }, [lineItems])

  // Validate form
  const validateForm = (): boolean => {
    if (!supplierId) {
      setError('Please select a supplier')
      return false
    }

    if (lineItems.length === 0) {
      setError('At least one line item is required')
      return false
    }

    const hasValidLineItem = lineItems.some(item => item.description.trim() !== '' && item.amount > 0)
    if (!hasValidLineItem) {
      setError('At least one line item must have a description and amount greater than zero')
      return false
    }

    return true
  }

  // Submit form
  const handleSubmit = async (status: 'draft' | 'pending_approval') => {
    if (!validateForm()) return

    setSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()

      // Get user's company_id
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .limit(1)
        .maybeSingle() as { data: { company_id: string } | null }

      if (!profile?.company_id) throw new Error('User profile not found')

      // Create purchase order
      const { data: po, error: poError } = await (supabase.from('purchase_orders') as any)
        .insert({
          supplier_id: supplierId,
          issue_date: issueDate,
          expected_delivery_date: expectedDeliveryDate,
          reference_number: referenceNumber,
          notes,
          status,
          total,
          created_by: user.id,
          company_id: profile.company_id,
        })
        .select()
        .limit(1)
        .maybeSingle()

      if (poError || !po) throw poError || new Error('Failed to create purchase order')

      // Create line items
      const validLineItems = lineItems.filter(item => item.description.trim() !== '' && item.amount > 0)

      if (validLineItems.length > 0) {
        const { error: linesError } = await (supabase.from('purchase_order_line_items') as any)
          .insert(
            validLineItems.map(item => ({
              purchase_order_id: po.id,
              description: item.description,
              item_id: item.item_id,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
            }))
          )

        if (linesError) throw linesError
      }

      // Redirect to PO detail
      window.location.href = `/purchase-orders/${po.id}`
    } catch (err: any) {
      console.error('Failed to create purchase order:', err)
      setError(err.message || 'Failed to create purchase order')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/purchase-orders" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-3xl font-bold">New Purchase Order</h1>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Form */}
      <form className="space-y-6" onSubmit={e => e.preventDefault()}>
        {/* Supplier */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Supplier <span className="text-red-500">*</span>
          </label>
          <Select value={supplierId || ''} onValueChange={setSupplierId} disabled={submitting}>
            <SelectTrigger>
              <SelectValue placeholder="Select a supplier..." />
            </SelectTrigger>
            <SelectContent>
              {contacts.map(contact => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dates */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Issue Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={issueDate}
              onChange={e => setIssueDate(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Expected Delivery Date</label>
            <Input
              type="date"
              value={expectedDeliveryDate || ''}
              onChange={e => setExpectedDeliveryDate(e.target.value || null)}
              disabled={submitting}
            />
          </div>
        </div>

        {/* Reference and Notes */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Reference Number</label>
            <Input
              value={referenceNumber || ''}
              onChange={e => setReferenceNumber(e.target.value || null)}
              placeholder="e.g., PO-2024-001"
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={notes || ''}
              onChange={e => setNotes(e.target.value || null)}
              placeholder="Add any additional notes..."
              rows={3}
              disabled={submitting}
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Line Items</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLineItem}
              disabled={submitting}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Line
            </Button>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Description</TableHead>
                  <TableHead className="min-w-[150px]">Item</TableHead>
                  <TableHead className="min-w-[100px] text-right">Qty</TableHead>
                  <TableHead className="min-w-[100px] text-right">Rate ($)</TableHead>
                  <TableHead className="min-w-[100px] text-right">Amount ($)</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((lineItem, index) => (
                  <TableRow key={lineItem.id}>
                    <TableCell>
                      <Input
                        value={lineItem.description}
                        onChange={e => handleLineItemChange(lineItem.id, 'description', e.target.value)}
                        placeholder="Item description"
                        disabled={submitting}
                        className="border-0 bg-transparent p-0"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={lineItem.item_id || ''}
                        onValueChange={value => handleLineItemChange(lineItem.id, 'item_id', value || null)}
                        disabled={submitting}
                      >
                        <SelectTrigger className="border-0 bg-transparent">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {items.map(item => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={lineItem.quantity}
                        onChange={e => handleLineItemChange(lineItem.id, 'quantity', parseFloat(e.target.value) || 0)}
                        disabled={submitting}
                        className="border-0 bg-transparent p-0 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={(lineItem.rate / 100).toFixed(2)}
                        onChange={e => {
                          const value = parseFloat(e.target.value) || 0
                          handleLineItemChange(lineItem.id, 'rate', Math.round(value * 100))
                        }}
                        disabled={submitting}
                        className="border-0 bg-transparent p-0 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(lineItem.amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveLineItem(lineItem.id)}
                        disabled={lineItems.length <= 1 || submitting}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end gap-8">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Subtotal</p>
            <p className="text-xl font-semibold">{formatCurrency(subtotal)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Tax</p>
            <p className="text-xl font-semibold">$0.00</p>
          </div>
          <div className="space-y-2 border-l pl-8">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{formatCurrency(total)}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSubmit('draft')}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save as Draft
          </Button>
          <Button
            type="button"
            className="bg-violet-600 hover:bg-violet-700"
            onClick={() => handleSubmit('pending_approval')}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Submit for Approval
          </Button>
        </div>
      </form>
    </div>
  )
}
