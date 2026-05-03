'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, ArrowRight, Loader2, Trash2, AlertTriangle, CheckCircle2, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentEntry {
  type: 'BILL' | 'INVOICE' | 'EXPENSE'
  description: string
  contact_name: string
  contact_id: string
  account_name: string
  account_id: string
  payment_account_id: string   // for EXPENSE only
  payment_account_name: string
  amount: number               // BIGINT cents
  date: string                 // YYYY-MM-DD
  due_date: string             // YYYY-MM-DD
  notes: string
}

interface AccountOption {
  id: string
  code: string
  name: string
  type: string
  sub_type: string
}

interface ContactOption {
  id: string
  name: string
  type: string
}

interface ExecuteResult {
  success: boolean
  record_id?: string
  error?: string
  intent: string
}

// ─── Date NLP (client-side, runs before AI call) ──────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function resolveRelativeDates(text: string): string {
  const n = new Date()
  const y = n.getFullYear()
  const mo = n.getMonth()
  const d = n.getDate()

  const lastOfMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0)

  const mondayOf = (date: Date) => {
    const day = date.getDay()
    const diff = day === 0 ? -6 : 1 - day
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff)
  }

  const replacements: [RegExp, string | ((...args: any[]) => string)][] = [
    [/\btoday\b/gi,          isoDate(n)],
    [/\byesterday\b/gi,      isoDate(new Date(y, mo, d - 1))],
    [/\btomorrow\b/gi,       isoDate(new Date(y, mo, d + 1))],
    [/\bthis week\b/gi,      isoDate(mondayOf(n))],
    [/\blast week\b/gi,      isoDate(mondayOf(new Date(y, mo, d - 7)))],
    [/\bthis month\b/gi,     isoDate(lastOfMonth(y, mo))],
    [/\blast month\b/gi,     isoDate(lastOfMonth(y, mo - 1))],
    [/\bthis quarter\b/gi,   isoDate(lastOfMonth(y, Math.floor(mo / 3) * 3 + 2))],
    [/\blast quarter\b/gi,   isoDate(lastOfMonth(y, Math.floor(mo / 3) * 3 - 1))],
    [/\bthis year\b/gi,      `${y}-12-31`],
    [/\blast year\b/gi,      `${y - 1}-12-31`],
    [/\bin (\d+) days?\b/gi, (_, num) => isoDate(new Date(y, mo, d + parseInt(num)))],
    [/\bdue in (\d+) days?\b/gi, (_, num) => isoDate(new Date(y, mo, d + parseInt(num)))],
    [/\bnext (\d+) days?\b/gi, (_, num) => isoDate(new Date(y, mo, d + parseInt(num)))],
  ]

  let out = text
  for (const [re, date] of replacements) {
    out = typeof date === 'string'
      ? out.replace(re, date)
      : out.replace(re, date as unknown as string)
  }
  return out
}

// ─── Fuzzy match ──────────────────────────────────────────────────────────────

function fuzzyScore(q: string, t: string): number {
  const a = q.toLowerCase().trim()
  const b = t.toLowerCase().trim()
  if (!a || !b) return 0
  if (b.includes(a) || a.includes(b)) return 1
  const aw = a.split(/\s+/)
  const bw = b.split(/\s+/)
  const hits = aw.filter(w => w.length > 2 && bw.some((bx: string) => bx.includes(w) || w.includes(bx)))
  return hits.length / Math.max(aw.length, bw.length)
}

function fuzzyFindContact(query: string, list: ContactOption[]): ContactOption | null {
  if (!query) return null
  let best: ContactOption | null = null
  let top = 0
  for (const item of list) {
    const s = fuzzyScore(query, item.name)
    if (s > top) { top = s; best = item }
  }
  return top >= 0.35 ? best : null
}

function fuzzyFindAccount(query: string, list: AccountOption[]): AccountOption | null {
  if (!query) return null
  let best: AccountOption | null = null
  let top = 0
  for (const item of list) {
    const s = fuzzyScore(query, item.name)
    if (s > top) { top = s; best = item }
  }
  return top >= 0.35 ? best : null
}

// ─── Account filter helpers ───────────────────────────────────────────────────

function expenseAccounts(accounts: AccountOption[]) {
  return accounts.filter(a =>
    ['expense', 'cost_of_goods_sold', 'other_expense'].includes(a.sub_type)
  )
}

function revenueAccounts(accounts: AccountOption[]) {
  return accounts.filter(a =>
    ['income', 'other_income'].includes(a.sub_type)
  )
}

function bankAccounts(accounts: AccountOption[]) {
  return accounts.filter(a =>
    ['bank', 'cash', 'credit_card', 'other_current_asset'].includes(a.sub_type)
  )
}

function vendorContacts(contacts: ContactOption[]) {
  return contacts.filter(c => c.type === 'vendor' || c.type === 'both')
}

function customerContacts(contacts: ContactOption[]) {
  return contacts.filter(c => c.type === 'customer' || c.type === 'both')
}

const todayISO = new Date().toISOString().split('T')[0]
const in30Days = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0]

const BETA_KEY = 'finova_agent_beta_seen'

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentPage() {
  const supabase = createClient()

  const [showBeta, setShowBeta] = useState<boolean>(false)
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isExecuting, setIsExecuting] = useState<boolean>(false)
  const [entries, setEntries] = useState<AgentEntry[]>([])
  const [results, setResults] = useState<ExecuteResult[] | null>(null)
  const [clarification, setClarification] = useState<string | null>(null)
  const [phase, setPhase] = useState<'input' | 'review' | 'done'>('input')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Beta modal on first visit
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(BETA_KEY)) {
      setShowBeta(true)
    }
  }, [])

  // Load accounts and contacts once
  useEffect(() => {
    async function load() {
      // eslint-disable-next-line
      const { data: accs } = await (supabase as any)
        .from('accounts')
        .select('id, code, name, type, sub_type')
        .eq('is_active', true) as unknown as { data: AccountOption[] | null }

      // eslint-disable-next-line
      const { data: cons } = await (supabase as any)
        .from('contacts')
        .select('id, name, type')
        .eq('is_active', true) as unknown as { data: ContactOption[] | null }

      if (accs) setAccounts(accs)
      if (cons) setContacts(cons)
    }
    load()
  // eslint-disable-next-line
  }, [])

  function dismissBeta() {
    localStorage.setItem(BETA_KEY, '1')
    setShowBeta(false)
  }

  function buildEntry(raw: {
    type?: string
    description?: string
    contact_name?: string
    account_name?: string
    amount?: number
    date?: string
    due_date?: string
    notes?: string
  }): AgentEntry {
    const type = (['BILL', 'INVOICE', 'EXPENSE'].includes(raw.type ?? '') ? raw.type : 'EXPENSE') as AgentEntry['type']

    // Resolve account
    const accountPool = type === 'INVOICE' ? revenueAccounts(accounts) : expenseAccounts(accounts)
    let account: AccountOption | null = null
    if (raw.account_name) {
      account = accounts.find(a => a.name.toLowerCase() === raw.account_name!.toLowerCase()) ?? null
      if (!account) account = fuzzyFindAccount(raw.account_name, accountPool)
    }

    // Resolve contact
    const contactPool = type === 'INVOICE' ? customerContacts(contacts) : vendorContacts(contacts)
    let contact: ContactOption | null = null
    if (raw.contact_name) {
      contact = contacts.find(c => c.name.toLowerCase() === raw.contact_name!.toLowerCase()) ?? null
      if (!contact) contact = fuzzyFindContact(raw.contact_name, contactPool)
    }

    // Default payment account: first bank account
    const defaultBank = bankAccounts(accounts)[0]

    // Normalize amount to cents — if AI returned dollars accidentally, fix it
    let amount = typeof raw.amount === 'number' ? raw.amount : 0
    if (amount > 0 && amount < 500 && amount % 1 !== 0) {
      amount = Math.round(amount * 100)
    }

    return {
      type,
      description: raw.description ?? '',
      contact_name: contact?.name ?? raw.contact_name ?? '',
      contact_id: contact?.id ?? '',
      account_name: account?.name ?? raw.account_name ?? '',
      account_id: account?.id ?? '',
      payment_account_id: defaultBank?.id ?? '',
      payment_account_name: defaultBank?.name ?? '',
      amount,
      date: raw.date ?? todayISO,
      due_date: raw.due_date ?? in30Days,
      notes: raw.notes ?? '',
    }
  }

  async function handleSubmit() {
    if (!input.trim() || isLoading) return
    setIsLoading(true)
    setClarification(null)

    const resolved = resolveRelativeDates(input)

    try {
      const res = await fetch('/api/agent/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: resolved }),
      })
      const data = await res.json() as {
        entries?: unknown[]
        clarification_needed?: string | null
      }

      if (data.clarification_needed) {
        setClarification(data.clarification_needed)
        setIsLoading(false)
        return
      }

      const built = (data.entries ?? []).map((e) => buildEntry(e as Parameters<typeof buildEntry>[0]))
      setEntries(built)
      setPhase(built.length > 0 ? 'review' : 'input')
    } catch {
      setClarification("Couldn't connect to the AI. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  function updateEntry(idx: number, patch: Partial<AgentEntry>) {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e))
  }

  function removeEntry(idx: number) {
    setEntries(prev => {
      const next = prev.filter((_, i) => i !== idx)
      if (next.length === 0) setPhase('input')
      return next
    })
  }

  async function executeAll() {
    if (!entries.length || isExecuting) return
    setIsExecuting(true)

    // Map entries to the format the execute route expects (ResolvedIntent[])
    const intents = entries.map(e => ({
      intent: e.type === 'BILL' ? 'CREATE_BILL' : e.type === 'INVOICE' ? 'CREATE_INVOICE' : 'CREATE_EXPENSE',
      display_summary: e.description,
      data: e.type === 'BILL' ? {
        vendor_name: e.contact_name,
        line_items: [{ description: e.description, quantity: 1, rate: e.amount, amount: e.amount }],
        due_date: e.due_date,
        notes: e.notes,
        account_id: e.account_id,
      } : e.type === 'INVOICE' ? {
        contact_name: e.contact_name,
        line_items: [{ description: e.description, quantity: 1, rate: e.amount, amount: e.amount }],
        due_date: e.due_date,
        notes: e.notes,
        account_id: e.account_id,
      } : {
        payee: e.contact_name || e.description,
        amount: e.amount,
        description: e.description,
        account_id: e.account_id,
        payment_account_id: e.payment_account_id,
        date: e.date,
        notes: e.notes,
      },
      resolved: {
        contact_id: e.contact_id || null,
        account_id: e.account_id || null,
        payment_account_id: e.payment_account_id || null,
      },
    }))

    try {
      const res = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intents }),
      })
      const data = await res.json() as { results: ExecuteResult[] }
      setResults(data.results)
      setPhase('done')
    } catch {
      setClarification('Execution failed. Please try again.')
    } finally {
      setIsExecuting(false)
    }
  }

  function resetSession() {
    setEntries([])
    setResults(null)
    setClarification(null)
    setInput('')
    setPhase('input')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const totalCents = entries.reduce((s, e) => s + e.amount, 0)
  const fmtCents = (c: number) =>
    (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  const typeBadge = (type: AgentEntry['type']) => {
    if (type === 'BILL')    return { label: 'BILL',    bg: '#eff6ff', color: '#2563eb' }
    if (type === 'INVOICE') return { label: 'INVOICE', bg: '#ede9fe', color: '#7c3aed' }
    return                           { label: 'EXPENSE', bg: '#fffbeb', color: '#d97706' }
  }

  const suggestions = [
    "Bill from AWS $340 for cloud hosting, due in 30 days",
    "Invoice Acme Corp $1,500 for web design, due next month",
    "Paid lunch $45 from checking today",
    "Bill from supplier $800 and expense $120 software yesterday",
  ]

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">

      {/* ── Beta Modal ── */}
      {showBeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <AlertTriangle size={18} className="text-amber-500" />
              </div>
              <div>
                <div className="font-semibold text-[#111118]">AI Agent — Beta Feature</div>
                <div className="text-[11px] text-[#9ca3af]">Powered by Llama 3.3 via Groq</div>
              </div>
            </div>
            <p className="text-sm text-[#374151] mb-3">
              The AI agent can parse natural language into accounting entries, but it's still learning. Before executing any transaction, please:
            </p>
            <ul className="text-sm text-[#374151] space-y-1.5 mb-5 list-none">
              {[
                'Verify all amounts are correct',
                'Confirm the right account is selected',
                'Check dates before posting',
                'Review vendor/customer names',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-[#7c3aed] mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[#9ca3af] mb-4">All records are created as drafts. You can review and finalize them in the respective pages.</p>
            <button
              onClick={dismissBeta}
              className="w-full bg-[#7c3aed] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#6d28d9]"
            >
              I understand — let's go
            </button>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight text-[#111118] font-serif">AI Agent</h1>
            <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full tracking-wide">BETA</span>
          </div>
          <p className="text-[#6b7280] mt-1 text-sm">Describe transactions in plain English — review and post them in seconds.</p>
        </div>
        {phase !== 'input' && (
          <button onClick={resetSession} className="text-sm text-[#6b7280] hover:text-[#111118] border border-[#e5e7eb] rounded-lg px-3 py-1.5">
            ← New entry
          </button>
        )}
      </div>

      {/* ── Input Phase ── */}
      {phase === 'input' && (
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-[#7c3aed]" />
            <span className="text-sm font-medium text-[#111118]">What happened?</span>
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
            placeholder='"Bill from AWS $340 for cloud hosting due in 30 days and paid $45 lunch from checking today"'
            className="w-full border border-[#e5e7eb] rounded-xl p-3.5 text-sm text-[#111118] resize-none focus:outline-none focus:border-[#7c3aed] min-h-[100px]"
            rows={3}
            autoFocus
          />

          {clarification && (
            <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">{clarification}</p>
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <p className="text-[11px] text-[#9ca3af]">⌘↵ to submit · Records created as drafts</p>
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className="flex items-center gap-2 bg-[#7c3aed] text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-[#6d28d9] disabled:opacity-50"
            >
              {isLoading
                ? <><Loader2 size={14} className="animate-spin" /> Analyzing...</>
                : <>Parse entries <ArrowRight size={14} /></>}
            </button>
          </div>

          <div className="mt-6 border-t border-[#f3f4f6] pt-5">
            <p className="text-[11px] text-[#9ca3af] mb-3 uppercase tracking-wide font-medium">Try an example</p>
            <div className="grid grid-cols-2 gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setInput(s)}
                  className="text-left text-[13px] text-[#374151] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl p-3 hover:border-[#7c3aed] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Review Phase ── */}
      {phase === 'review' && (
        <div className="bg-white border border-[#e5e7eb] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-[#e5e7eb]">
            <span className="text-[11px] font-semibold bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full tracking-wide">
              {entries.length} TRANSACTION{entries.length > 1 ? 'S' : ''} DETECTED
            </span>
            <span className="text-[12px] text-[#9ca3af]">Review and edit before posting</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                  <th className="py-2.5 px-3 text-[10px] tracking-widest font-semibold uppercase text-[#9ca3af] w-6">#</th>
                  <th className="py-2.5 px-3 text-[10px] tracking-widest font-semibold uppercase text-[#9ca3af] w-20">Type</th>
                  <th className="py-2.5 px-3 text-[10px] tracking-widest font-semibold uppercase text-[#9ca3af] min-w-[150px]">Description</th>
                  <th className="py-2.5 px-3 text-[10px] tracking-widest font-semibold uppercase text-[#9ca3af] min-w-[140px]">Contact</th>
                  <th className="py-2.5 px-3 text-[10px] tracking-widest font-semibold uppercase text-[#9ca3af] min-w-[160px]">Account</th>
                  {entries.some(e => e.type === 'EXPENSE') && (
                    <th className="py-2.5 px-3 text-[10px] tracking-widest font-semibold uppercase text-[#9ca3af] min-w-[140px]">Paid From</th>
                  )}
                  <th className="py-2.5 px-3 text-[10px] tracking-widest font-semibold uppercase text-[#9ca3af] min-w-[120px]">Date</th>
                  {entries.some(e => e.type !== 'EXPENSE') && (
                    <th className="py-2.5 px-3 text-[10px] tracking-widest font-semibold uppercase text-[#9ca3af] min-w-[120px]">Due Date</th>
                  )}
                  <th className="py-2.5 px-3 text-[10px] tracking-widest font-semibold uppercase text-[#9ca3af] text-right min-w-[100px]">Amount</th>
                  <th className="py-2.5 px-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const badge = typeBadge(entry.type)
                  const contactPool = entry.type === 'INVOICE' ? customerContacts(contacts) : vendorContacts(contacts)
                  const accountPool = entry.type === 'INVOICE' ? revenueAccounts(accounts) : expenseAccounts(accounts)
                  const bankPool = bankAccounts(accounts)

                  return (
                    <tr key={idx} className={`border-b border-[#f3f4f6] ${idx % 2 === 1 ? 'bg-[#fafafa]' : 'bg-white'}`}>
                      <td className="px-3 py-2 text-[11px] text-[#9ca3af] font-mono">{idx + 1}</td>

                      <td className="px-3 py-2">
                        <select
                          value={entry.type}
                          onChange={e => updateEntry(idx, { type: e.target.value as AgentEntry['type'] })}
                          className="text-[11px] font-semibold px-2 py-1 rounded border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
                          style={{ backgroundColor: badge.bg, color: badge.color }}
                        >
                          <option value="BILL">BILL</option>
                          <option value="INVOICE">INVOICE</option>
                          <option value="EXPENSE">EXPENSE</option>
                        </select>
                      </td>

                      <td className="px-3 py-2">
                        <input
                          value={entry.description}
                          onChange={e => updateEntry(idx, { description: e.target.value })}
                          className="w-full border border-transparent rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#7c3aed] bg-transparent hover:bg-[#f9fafb] focus:bg-white"
                          placeholder="Description"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <select
                          value={entry.contact_id}
                          onChange={e => {
                            const c = contacts.find(x => x.id === e.target.value)
                            updateEntry(idx, { contact_id: e.target.value, contact_name: c?.name ?? '' })
                          }}
                          className="w-full border border-transparent rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#7c3aed] bg-transparent hover:bg-[#f9fafb] focus:bg-white cursor-pointer text-[13px]"
                        >
                          <option value="">
                            {entry.contact_name || (entry.type === 'INVOICE' ? 'Select customer…' : 'Select vendor…')}
                          </option>
                          {contactPool.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-2">
                        <select
                          value={entry.account_id}
                          onChange={e => {
                            const a = accounts.find(x => x.id === e.target.value)
                            updateEntry(idx, { account_id: e.target.value, account_name: a?.name ?? '' })
                          }}
                          className="w-full border border-transparent rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#7c3aed] bg-transparent hover:bg-[#f9fafb] focus:bg-white cursor-pointer text-[13px]"
                        >
                          <option value="">
                            {entry.account_name || 'Select account…'}
                          </option>
                          {accountPool.map(a => (
                            <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                          ))}
                        </select>
                      </td>

                      {entries.some(e => e.type === 'EXPENSE') && (
                        <td className="px-3 py-2">
                          {entry.type === 'EXPENSE' ? (
                            <select
                              value={entry.payment_account_id}
                              onChange={e => {
                                const a = accounts.find(x => x.id === e.target.value)
                                updateEntry(idx, { payment_account_id: e.target.value, payment_account_name: a?.name ?? '' })
                              }}
                              className="w-full border border-transparent rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#7c3aed] bg-transparent hover:bg-[#f9fafb] focus:bg-white cursor-pointer text-[13px]"
                            >
                              <option value="">{entry.payment_account_name || 'Select account…'}</option>
                              {bankPool.map(a => (
                                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                              ))}
                            </select>
                          ) : <span className="text-[#d1d5db]">—</span>}
                        </td>
                      )}

                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={entry.date}
                          onChange={e => updateEntry(idx, { date: e.target.value })}
                          className="border border-transparent rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#7c3aed] bg-transparent hover:bg-[#f9fafb] focus:bg-white text-[13px]"
                        />
                      </td>

                      {entries.some(e => e.type !== 'EXPENSE') && (
                        <td className="px-3 py-2">
                          {entry.type !== 'EXPENSE' ? (
                            <input
                              type="date"
                              value={entry.due_date}
                              onChange={e => updateEntry(idx, { due_date: e.target.value })}
                              className="border border-transparent rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#7c3aed] bg-transparent hover:bg-[#f9fafb] focus:bg-white text-[13px]"
                            />
                          ) : <span className="text-[#d1d5db]">—</span>}
                        </td>
                      )}

                      <td className="px-3 py-2">
                        <div className="relative flex items-center justify-end">
                          <span className="absolute left-2 text-[#9ca3af] text-[13px]">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={(entry.amount / 100).toFixed(2)}
                            onChange={e => {
                              const cents = Math.round(parseFloat(e.target.value || '0') * 100)
                              updateEntry(idx, { amount: cents })
                            }}
                            className="w-24 border border-transparent rounded-lg pl-5 pr-2 py-1.5 focus:outline-none focus:border-[#7c3aed] bg-transparent hover:bg-[#f9fafb] focus:bg-white text-right font-mono text-[13px]"
                          />
                        </div>
                      </td>

                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => removeEntry(idx)}
                          className="text-[#d1d5db] hover:text-red-500 p-1 rounded"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3.5 border-t border-[#e5e7eb] bg-[#f9fafb]">
            <div className="flex items-center gap-6">
              <div className="text-[12px] text-[#6b7280]">
                Total <span className="font-mono font-semibold text-[#111118] ml-1">{fmtCents(totalCents)}</span>
              </div>
              <div className="text-[12px] text-[#6b7280]">
                {entries.length} transaction{entries.length > 1 ? 's' : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetSession}
                className="text-sm text-[#6b7280] hover:text-[#111118] px-3 py-1.5 border border-[#e5e7eb] rounded-lg bg-white"
              >
                ← Edit prompt
              </button>
              <button
                onClick={executeAll}
                disabled={isExecuting || !entries.length}
                className="flex items-center gap-2 bg-[#7c3aed] text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-[#6d28d9] disabled:opacity-50"
              >
                {isExecuting
                  ? <><Loader2 size={14} className="animate-spin" /> Posting...</>
                  : <>Post {entries.length} transaction{entries.length > 1 ? 's' : ''} <ArrowRight size={14} /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Done Phase ── */}
      {phase === 'done' && results && (
        <div className="bg-white border border-[#e5e7eb] rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-[#e5e7eb] flex items-center gap-3">
            <CheckCircle2 size={18} className="text-green-500" />
            <span className="font-semibold text-[#111118]">
              {results.filter(r => r.success).length} of {results.length} transaction{results.length > 1 ? 's' : ''} posted
            </span>
          </div>
          <div className="divide-y divide-[#f3f4f6]">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                {r.success
                  ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                  : <X size={14} className="text-red-500 shrink-0" />}
                <span className="text-[13px] text-[#374151]">
                  {entries[i]?.description || r.intent}
                </span>
                {r.success && r.record_id && (
                  <a
                    href={`/${r.intent === 'CREATE_INVOICE' ? 'invoices' : r.intent === 'CREATE_BILL' ? 'bills' : 'expenses'}/${r.record_id}`}
                    className="ml-auto text-[12px] text-[#7c3aed] hover:underline"
                  >
                    View →
                  </a>
                )}
                {!r.success && (
                  <span className="ml-auto text-[12px] text-red-500">{r.error}</span>
                )}
              </div>
            ))}
          </div>
          <div className="p-4 flex justify-end border-t border-[#e5e7eb]">
            <button
              onClick={resetSession}
              className="bg-[#7c3aed] text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-[#6d28d9]"
            >
              Record more
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
