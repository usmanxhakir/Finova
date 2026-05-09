export type IntentType =
  | 'CREATE_INVOICE'
  | 'CREATE_BILL'
  | 'CREATE_EXPENSE'
  | 'CREATE_CONTACT'
  | 'CREATE_ITEM'
  | 'RUN_REPORT'
  | 'ANSWER_QUESTION'
  | 'UNKNOWN'

export interface AgentLineItem {
  description: string
  quantity: number
  rate: number           // CENTS — integer only, never float
  item_name?: string     // AI provides this for bills/invoices — fuzzy matched to items list
  item_id?: string       // resolved by resolver after fuzzy match
  account_name?: string  // only used for manual fallback, not primary
}

export interface UnresolvedEntity {
  type: 'contact' | 'item' | 'account' | 'payment_account'
  name: string           // what the AI returned that couldn't be matched
  intent_index: number   // which intent in the array this belongs to
}

export interface ParsedIntent {
  intent: IntentType
  confidence: number
  data: {
    // CREATE_INVOICE
    contact_name?: string
    customer_reference?: string
    due_days?: number
    line_items?: AgentLineItem[]
    notes?: string

    // CREATE_BILL
    vendor_name?: string
    vendor_reference?: string

    // CREATE_EXPENSE
    payee?: string
    amount?: number           // CENTS — integer only
    description?: string
    expense_account_name?: string
    payment_account_name?: string
    date?: string             // ISO YYYY-MM-DD

    // CREATE_CONTACT
    name?: string
    type?: 'customer' | 'vendor' | 'both'
    email?: string
    phone?: string

    // CREATE_ITEM
    item_name?: string
    item_type?: 'product' | 'service'
    default_rate?: number     // CENTS — integer only
    income_account_name?: string

    // RUN_REPORT
    report_type?: 'pl' | 'balance-sheet' | 'ar-aging' | 'ap-aging'
    date_from?: string
    date_to?: string

    // ANSWER_QUESTION / UNKNOWN
    answer?: string
  }
  display_summary: string
  error?: string
}

export interface ParseResponse {
  intents: ParsedIntent[]
  raw_message: string
  clarification_needed?: string | null
  unresolved_entities: UnresolvedEntity[]  // empty array if everything resolved
}

export interface ResolvedLineItem extends AgentLineItem {
  item_id?: string
  account_id?: string
}

export interface ResolvedIntent extends ParsedIntent {
  resolved: {
    contact_id?: string
    account_id?: string             // expense account for expenses
    payment_account_id?: string     // bank/cash account for expenses
    income_account_id?: string      // for items
    expense_account_id?: string     // for items
    line_items?: ResolvedLineItem[]
  }
}

export interface ExecuteResult {
  intent: IntentType
  success: boolean
  record_id?: string
  navigate_to?: string   // for RUN_REPORT
  error?: string
}

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
  intent_payload?: ParseResponse | null
}

export interface AgentConversation {
  id: string
  created_at: string
  updated_at: string
  title: string | null
  last_message_at: string
}
