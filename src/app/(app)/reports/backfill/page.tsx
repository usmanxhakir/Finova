'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createInvoiceJournalEntry } from '@/lib/accounting/journal-engine'

const MISSING_IDS = [
  'c133db3b-2751-47ca-97c5-3aec84a27f9e',
  '807c459c-419a-4072-9fef-31281d16af2e'
]

export default function BackfillPage() {
  const [log, setLog] = useState<string[]>([])
  const supabase = createClient()

  const run = async () => {
    setLog(prev => [...prev, `Starting backfill for ${MISSING_IDS.length} invoices...`])
    for (const id of MISSING_IDS) {
      try {
        await createInvoiceJournalEntry(id, supabase as any)
        setLog(prev => [...prev, `✅ Done: ${id}`])
      } catch (e: any) {
        console.error(e)
        setLog(prev => [...prev, `❌ Failed: ${id} — ${e.message}`])
      }
    }
    setLog(prev => [...prev, 'Backfill process completed.'])
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-white border rounded-xl shadow-sm p-6">
        <h1 className="text-xl font-bold mb-2">Journal Entry Backfill</h1>
        <p className="text-sm text-muted-foreground mb-6">
          This temporary tool will generate missing journal entries for INV-0007 and INV-0008.
        </p>
        
        <button 
          onClick={run} 
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm"
        >
          Run Backfill
        </button>

        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-3">Execution Log</h2>
          <div className="bg-zinc-50 border rounded-lg p-4 min-h-[200px]">
            <ul className="space-y-2 font-mono text-xs">
              {log.length === 0 && <li className="text-zinc-400 italic">No activity yet. Click "Run Backfill" to start.</li>}
              {log.map((l, i) => (
                <li key={i} className={l.startsWith('✅') ? 'text-green-600' : l.startsWith('❌') ? 'text-red-600' : 'text-zinc-600'}>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <p className="mt-6 text-[10px] text-zinc-400 border-t pt-4">
          CAUTION: This page is for temporary maintenance. Please delete this file after successful execution.
        </p>
      </div>
    </div>
  )
}
