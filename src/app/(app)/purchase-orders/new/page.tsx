'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'

type SubmitStatus = 'draft' | 'pending_approval'

interface Contact {
  id: string
  name: string
}

interface Item {
  id: string
  name: string
  default_rate?: number | null
}

interface LineItem {
  id: string
  description: string
  item_id: string | null
  quantity: number
  rateInput: string
  rate: number
  amount: number
}

const today = () => new Date().toISOString().slice(0, 10)

function dollarsToCents(value: string) {
  const sanitized = value.replace(/[^\d.]/g, '')
  const [wholeRaw = '0', centsRaw = ''] = sanitized.split('.')
  const whole = Number(wholeRaw || '0')
  const cents = Number((centsRaw + '00').slice(0, 2))

  if (!Number.isFinite(whole) || !Number.isFinite(cents)) return 0

  return whole * 100 + cents
}

function calculateAmount(quantity: number, rateCents: number) {
  if (!Number.isFinite(quantity) || !Number.isFinite(rateCents)) return 0
  return Math.round(quantity * rateCents)
}

function newLineItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    item_id: null,
    quantity: 1,
    rateInput: '',
    rate: 0,
    amount: 0,
  }
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [issueDate, setIssueDate] = useState(today)
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()])
  const [loading, setLoading] = useState(true)
  const [submittingStatus, setSubmittingStatus] = useState<SubmitStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadOptions = async () => {
      const supabase = createClient()
      const [contactsResult, itemsResult] = await Promise.all([
        supabase
          .from('contacts')
          .select('id, name')
          .in('type', ['vendor', 'both'])
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('items')
          .select('id, name, default_rate')
          .order('name'),
      ])

      if (contactsResult.error) throw contactsResult.error
      if (itemsResult.error) throw itemsResult.error

      setContacts(contactsResult.data || [])
      setItems(itemsResult.data || [])
    }

    loadOptions()
      .catch((loadError) => {
        console.error('[New PO] option load error:', loadError)
        setError('Failed to load suppliers and items')
      })
      .finally(() => setLoading(false))
  }, [])

  const selectedSupplier = contacts.find((contact) => contact.id === supplierId)

  const subtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + item.amount, 0),
    [lineItems]
  )
  const total = subtotal

  const updateLineItem = (id: string, updates: Partial<LineItem>) => {
    setLineItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item

        const next = { ...item, ...updates }
        return {
          ...next,
          amount: calculateAmount(next.quantity, next.rate),
        }
      })
    )
  }

  const handleItemChange = (lineItem: LineItem, itemId: string) => {
    if (itemId === 'none') {
      updateLineItem(lineItem.id, { item_id: null })
      return
    }

    const selectedItem = items.find((item) => item.id === itemId)
    const nextRate = Number(selectedItem?.default_rate ?? lineItem.rate)

    updateLineItem(lineItem.id, {
      item_id: itemId,
      rate: Number.isFinite(nextRate) ? nextRate : lineItem.rate,
      rateInput: Number.isFinite(nextRate) && nextRate > 0 ? (nextRate / 100).toFixed(2) : lineItem.rateInput,
    })
  }

  const removeLine = (id: string) => {
    setLineItems((current) => (current.length === 1 ? current : current.filter((item) => item.id !== id)))
  }

  const validate = () => {
    if (!supplierId) return 'Supplier selected is required'
    if (!lineItems.some((item) => item.amount > 0)) {
      return 'At least one line item must have an amount greater than $0.00'
    }

    return null
  }

  const submit = async (status: SubmitStatus) => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setSubmittingStatus(status)

    try {
      const line_items = lineItems
        .filter((item) => item.amount > 0)
        .map((item) => ({
          description: item.description.trim(),
          item_id: item.item_id,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          account_id: null,
        }))

      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: supplierId,
          issue_date: issueDate,
          expected_delivery_date: expectedDeliveryDate || null,
          reference_number: referenceNumber.trim() || null,
          notes: notes.trim() || null,
          status,
          line_items,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to create purchase order')

      router.push(`/purchase-orders/${result.id}`)
    } catch (submitError: any) {
      console.error('[New PO] submit error:', submitError)
      setError(submitError.message || 'Failed to create purchase order')
    } finally {
      setSubmittingStatus(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-3">
        <Button asChild variant="ghost" className="h-auto px-0 text-muted-foreground hover:bg-transparent hover:text-foreground">
          <Link href="/purchase-orders">← Purchase Orders</Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
          New Purchase Order
        </h1>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Supplier</label>
            <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={supplierOpen}
                  className="w-full justify-between"
                  disabled={!!submittingStatus}
                >
                  {selectedSupplier?.name || 'Select supplier...'}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search suppliers..." />
                  <CommandList>
                    <CommandEmpty>No suppliers found.</CommandEmpty>
                    <CommandGroup>
                      {contacts.map((contact) => (
                        <CommandItem
                          key={contact.id}
                          value={contact.name}
                          onSelect={() => {
                            setSupplierId(contact.id)
                            setSupplierOpen(false)
                          }}
                        >
                          <Check className={cn('h-4 w-4', supplierId === contact.id ? 'opacity-100' : 'opacity-0')} />
                          {contact.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Reference Number</label>
            <Input
              value={referenceNumber}
              onChange={(event) => setReferenceNumber(event.target.value)}
              disabled={!!submittingStatus}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Issue Date</label>
            <Input
              type="date"
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
              disabled={!!submittingStatus}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Expected Delivery Date</label>
            <Input
              type="date"
              value={expectedDeliveryDate}
              onChange={(event) => setExpectedDeliveryDate(event.target.value)}
              disabled={!!submittingStatus}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Notes</label>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={!!submittingStatus}
            rows={4}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Line Items</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setLineItems((current) => [...current, newLineItem()])}>
              <Plus className="mr-2 h-4 w-4" />
              Add Line
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">Description</TableHead>
                  <TableHead className="min-w-[180px]">Item</TableHead>
                  <TableHead className="w-[110px] text-right">Qty</TableHead>
                  <TableHead className="w-[130px] text-right">Rate ($)</TableHead>
                  <TableHead className="w-[140px] text-right">Amount</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((lineItem) => (
                  <TableRow key={lineItem.id}>
                    <TableCell>
                      <Input
                        value={lineItem.description}
                        onChange={(event) => updateLineItem(lineItem.id, { description: event.target.value })}
                        disabled={!!submittingStatus}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={lineItem.item_id || 'none'}
                        onValueChange={(value) => handleItemChange(lineItem, value)}
                        disabled={!!submittingStatus}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {items.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={lineItem.quantity}
                        onChange={(event) => updateLineItem(lineItem.id, { quantity: Number(event.target.value) || 0 })}
                        className="text-right"
                        disabled={!!submittingStatus}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        inputMode="decimal"
                        value={lineItem.rateInput}
                        onChange={(event) => {
                          const rate = dollarsToCents(event.target.value)
                          updateLineItem(lineItem.id, {
                            rateInput: event.target.value,
                            rate,
                          })
                        }}
                        className="text-right"
                        disabled={!!submittingStatus}
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
                        onClick={() => removeLine(lineItem.id)}
                        disabled={lineItems.length === 1 || !!submittingStatus}
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

        <div className="flex justify-end">
          <div className="w-full max-w-sm space-y-3 rounded-md bg-zinc-50 p-4 dark:bg-zinc-900">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium">$0.00</span>
            </div>
            <div className="flex items-center justify-between border-t pt-3 text-lg font-semibold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => submit('draft')}
            disabled={!!submittingStatus}
          >
            {submittingStatus === 'draft' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save as Draft
          </Button>
          <Button
            type="button"
            className="bg-violet-600 hover:bg-violet-700"
            onClick={() => submit('pending_approval')}
            disabled={!!submittingStatus}
          >
            {submittingStatus === 'pending_approval' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit for Approval
          </Button>
        </div>
      </form>
    </div>
  )
}
