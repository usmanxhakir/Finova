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
  rate: number        // CENTS — integer only, never float
  account_name?: string
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
    expense_account_name?: string

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
}

export interface ResolvedLineItem extends AgentLineItem {
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
