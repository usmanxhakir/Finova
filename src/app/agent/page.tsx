"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sparkles, ClipboardList, ArrowRight, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { ResolvedIntent, ExecuteResult } from "@/types/agent";

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isTyping?: boolean;
}

export default function AgentPage() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingIntents, setPendingIntents] = useState<ResolvedIntent[]>([]);
  const [executeResults, setExecuteResults] = useState<ExecuteResult[] | null>(null);
  const [conversationHistory, setConversationHistory] = useState<{role: string, content: string}[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const supabase = createClient();

  useEffect(() => {
    async function loadLastConversation() {
      const { data: lastConversation } = await supabase
        .from('agent_conversations')
        .select('id')
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle() as { data: { id: string } | null, error: unknown };

      if (lastConversation) {
        setConversationId(lastConversation.id);
        const { data: msgs } = await supabase
          .from('agent_messages')
          .select('*')
          .eq('conversation_id', lastConversation.id)
          .order('created_at', { ascending: true });
        
        if (msgs && msgs.length > 0) {
          setMessages(msgs.map(m => ({ id: m.id, role: m.role as 'user'|'assistant', content: m.content })));
          setConversationHistory(msgs.map(m => ({ role: m.role, content: m.content })));
        }
      }
    }
    loadLastConversation();
  }, [supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleNewConversation() {
    setMessages([]);
    setConversationHistory([]);
    setPendingIntents([]);
    setExecuteResults(null);
    setInput('');
    setIsLoading(false);
    
    const { data } = await supabase
      .from('agent_conversations')
      .insert({ title: 'New Conversation' })
      .select('id')
      .single();
      
    if (data) {
      setConversationId(data.id);
    }
  }

  async function saveMessage(role: 'user' | 'assistant', content: string) {
    let cid = conversationId;
    if (!cid) {
      const { data } = await supabase
        .from('agent_conversations')
        .insert({ title: 'New Conversation' })
        .select('id')
        .single();
      if (data) {
        cid = data.id;
        setConversationId(data.id);
      }
    }
    
    if (cid) {
      await supabase.from('agent_messages').insert({
        conversation_id: cid,
        role,
        content
      });
      await supabase.from('agent_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', cid);
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return;

    const userMessage: DisplayMessage = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setConversationHistory(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsLoading(true);

    saveMessage('user', text);

    const typingMsg: DisplayMessage = { id: 'typing', role: 'assistant', content: '', isTyping: true };
    setMessages(prev => [...prev, typingMsg]);

    try {
      const res = await fetch('/api/agent/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversation_history: conversationHistory })
      });
      const data = await res.json();
      
      setMessages(prev => prev.filter(m => m.id !== 'typing'));

      let assistantContent = "";

      if (data.clarification_needed) {
        assistantContent = data.clarification_needed;
      } else {
        const hasActionable = data.intents.some((i: ResolvedIntent) => !['ANSWER_QUESTION', 'UNKNOWN'].includes(i.intent));
        const questions = data.intents.filter((i: ResolvedIntent) => ['ANSWER_QUESTION', 'UNKNOWN'].includes(i.intent));
        
        let answers = questions.map((q: ResolvedIntent) => q.data.answer).filter(Boolean).join('\n\n');
        
        if (answers) {
          assistantContent += answers;
        }
        
        if (hasActionable) {
          const actionCount = data.intents.length - questions.length;
          if (assistantContent) assistantContent += '\n\n';
          assistantContent += `I found ${actionCount} transaction(s) to record. Review them on the right →`;
          setPendingIntents(data.intents.filter((i: ResolvedIntent) => !['ANSWER_QUESTION', 'UNKNOWN'].includes(i.intent)));
          setExecuteResults(null);
        }
      }

      if (assistantContent) {
        const astMsg: DisplayMessage = { id: Date.now().toString() + 'a', role: 'assistant', content: assistantContent };
        setMessages(prev => [...prev, astMsg]);
        setConversationHistory(prev => [...prev, { role: 'assistant', content: assistantContent }]);
        saveMessage('assistant', assistantContent);
      }
      
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== 'typing'));
      const errMsg: DisplayMessage = { id: Date.now().toString() + 'e', role: 'assistant', content: "Sorry, I encountered an error communicating with the server." };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  function updateIntent(index: number, field: string, value: any) {
    setPendingIntents(prev => prev.map((intent, i) => 
      i === index 
        ? { ...intent, data: { ...intent.data, [field]: value } }
        : intent
    ));
  }
  
  function updateLineItemRate(index: number, rateValue: number) {
    setPendingIntents(prev => prev.map((intent, i) => {
      if (i !== index) return intent;
      const lineItems = [...(intent.data.line_items || [])];
      if (lineItems.length > 0) {
        lineItems[0] = { ...lineItems[0], rate: rateValue };
      } else {
        lineItems.push({ description: 'Item', quantity: 1, rate: rateValue });
      }
      return { ...intent, data: { ...intent.data, line_items: lineItems } };
    }));
  }

  function removeIntent(index: number) {
    setPendingIntents(prev => prev.filter((_, i) => i !== index));
  }

  async function executeAll() {
    const readyIntents = pendingIntents.filter((_, i) => getIntentStatus(pendingIntents[i]) === 'Ready');
    if (readyIntents.length === 0) return;
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intents: readyIntents })
      });
      const data = await res.json();
      setExecuteResults(data.results);
      
      const successCount = data.results.filter((r: any) => r.success).length;
      const assistantContent = `Done! Created ${successCount} records successfully.`;
      const astMsg: DisplayMessage = { id: Date.now().toString() + 'done', role: 'assistant', content: assistantContent };
      setMessages(prev => [...prev, astMsg]);
      setConversationHistory(prev => [...prev, { role: 'assistant', content: assistantContent }]);
      saveMessage('assistant', assistantContent);
      
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  function getIntentBadge(intent: string) {
    switch(intent) {
      case 'CREATE_INVOICE': return { label: 'INVOICE', bg: '#ede9fe', color: '#7c3aed' };
      case 'CREATE_BILL': return { label: 'BILL', bg: '#eff6ff', color: '#2563eb' };
      case 'CREATE_EXPENSE': return { label: 'EXPENSE', bg: '#fffbeb', color: '#d97706' };
      case 'CREATE_CONTACT': return { label: 'CONTACT', bg: '#f0fdf4', color: '#16a34a' };
      case 'CREATE_ITEM': return { label: 'ITEM', bg: '#f0fdfa', color: '#0d9488' };
      case 'RUN_REPORT': return { label: 'REPORT', bg: '#eef2ff', color: '#4338ca' };
      default: return { label: 'UNKNOWN', bg: '#f3f4f6', color: '#6b7280' };
    }
  }

  function getIntentStatus(intent: ResolvedIntent) {
    // Treat as Ready if the user has provided the required text field even if ID isn't resolved, 
    // because they can only edit the text field client-side and can't re-resolve it here.
    switch (intent.intent) {
      case 'CREATE_INVOICE':
        if (!intent.data.contact_name && !intent.resolved.contact_id) return 'Review';
        if (!intent.data.line_items?.length || intent.data.line_items[0].rate <= 0) return 'Review';
        return 'Ready';
      case 'CREATE_BILL':
        if (!intent.data.vendor_name && !intent.resolved.contact_id) return 'Review';
        if (!intent.data.line_items?.length) return 'Review';
        return 'Ready';
      case 'CREATE_EXPENSE':
        if (!intent.data.payee) return 'Review';
        if (!(intent.data.amount! > 0)) return 'Review';
        return 'Ready';
      case 'CREATE_CONTACT':
        if (!intent.data.name) return 'Review';
        return 'Ready';
      case 'CREATE_ITEM':
        if (!intent.data.item_name) return 'Review';
        return 'Ready';
      case 'RUN_REPORT':
      case 'ANSWER_QUESTION':
        return 'Ready';
      default:
        return 'Review';
    }
  }

  const handleSuggestionClick = (text: string) => {
    sendMessage(text);
  };

  const allReady = pendingIntents.every(i => getIntentStatus(i) === 'Ready') && pendingIntents.length > 0;

  return (
    <div className="p-6 md:p-8 flex flex-col h-screen overflow-hidden bg-[#f4f4f8]">
      <div className="flex justify-between items-end mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#111118] font-serif">AI Agent</h1>
          <p className="text-[#6b7280] mt-1">Describe transactions in plain English — I'll handle the accounting.</p>
        </div>
        <button 
          onClick={handleNewConversation}
          className="bg-white border border-[#e5e7eb] rounded-lg text-[#374151] px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          New Conversation
        </button>
      </div>

      <div className="flex bg-white border border-[#e5e7eb] rounded-xl overflow-hidden w-full max-h-full" style={{ height: 'calc(100vh - 160px)' }}>
        
        {/* Left Panel */}
        <div className="w-1/2 flex flex-col border-r border-[#e5e7eb]">
          <div className="flex items-center gap-2 p-4 border-b border-[#e5e7eb] shrink-0">
            <Sparkles size={18} className="text-[#7c3aed]" />
            <div>
              <div className="font-semibold text-sm text-[#111118]">Assistant</div>
              <div className="text-[11px] text-[#9ca3af]">Powered by DeepSeek via OpenRouter</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-[#6b7280]">
                <Sparkles size={32} className="text-[#7c3aed] opacity-60 mb-4" />
                <h3 className="text-[#111118] font-medium mb-1">Ask me anything</h3>
                <p className="text-sm mb-6 max-w-sm">Record bills, invoices, expenses, create contacts, run reports, or ask questions about your books.</p>
                <div className="grid grid-cols-2 gap-3 max-w-lg">
                  {[
                    "Bill from AWS $340 for cloud hosting, due in 30 days",
                    "Invoice for Acme Corp — web design $1,500",
                    "Expense: lunch $45, paid from checking account",
                    "What were my total expenses this month?"
                  ].map((suggestion, i) => (
                    <button 
                      key={i}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="bg-white border border-[#e5e7eb] rounded-lg p-3 text-[13px] text-left hover:border-[#7c3aed] transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`
                    text-[14px] px-3.5 py-2.5 max-w-[85%] whitespace-pre-wrap
                    ${msg.role === 'user' 
                      ? 'bg-[#7c3aed] text-white rounded-[18px_18px_4px_18px]' 
                      : 'bg-[#f3f4f6] text-[#111118] rounded-[18px_18px_18px_4px]'}
                  `}>
                    {msg.isTyping ? (
                      <div className="flex gap-1 h-5 items-center px-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#9ca3af] animate-pulse" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#9ca3af] animate-pulse" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#9ca3af] animate-pulse" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-[#e5e7eb] p-4 shrink-0 bg-white">
            <div className="relative flex items-center">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder="Describe what you need..."
                className="w-full border border-[#e5e7eb] rounded-[10px] py-2.5 pl-3 pr-12 text-sm resize-none focus:outline-none focus:border-[#7c3aed] min-h-[44px] max-h-[100px]"
                rows={1}
              />
              <button 
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 bg-[#7c3aed] text-white p-1.5 rounded-full disabled:opacity-50 flex items-center justify-center"
              >
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="text-[11px] text-[#9ca3af] mt-2 text-center">
              Records are created as drafts. Review before finalizing.
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-1/2 flex flex-col bg-[#f4f4f8]">
          <div className="flex items-center gap-2 p-4 border-b border-[#e5e7eb] shrink-0 bg-white">
            <ClipboardList size={18} className="text-[#374151]" />
            <div>
              <div className="font-semibold text-sm text-[#111118]">Review & Execute</div>
              <div className="text-[11px] text-[#9ca3af]">Edit parsed transactions before saving</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white">
            {pendingIntents.length === 0 ? (
              <div className="h-full flex items-center justify-center p-8">
                <div className="border-[1.5px] border-dashed border-[#e5e7eb] rounded-xl p-10 flex flex-col items-center justify-center text-center text-[#6b7280] w-full max-w-sm">
                  <ClipboardList size={32} className="text-[#9ca3af] mb-4" />
                  <h3 className="text-[#111118] font-medium mb-1">Nothing to review yet</h3>
                  <p className="text-sm">Parsed transactions will appear here.<br/>Review and edit them before executing.</p>
                </div>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#f9fafb] border-b border-[#e5e7eb] z-10">
                  <tr>
                    <th className="py-2.5 px-4 text-[11px] tracking-[0.08em] font-semibold uppercase text-[#6b7280] w-[15%]">Type</th>
                    <th className="py-2.5 px-4 text-[11px] tracking-[0.08em] font-semibold uppercase text-[#6b7280] w-[40%]">Details</th>
                    <th className="py-2.5 px-4 text-[11px] tracking-[0.08em] font-semibold uppercase text-[#6b7280] w-[20%]">Amount</th>
                    <th className="py-2.5 px-4 text-[11px] tracking-[0.08em] font-semibold uppercase text-[#6b7280] w-[15%]">Status</th>
                    <th className="py-2.5 px-4 text-[11px] tracking-[0.08em] font-semibold uppercase text-[#6b7280] w-[10%] text-center">×</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingIntents.map((intent, idx) => {
                    const badge = getIntentBadge(intent.intent);
                    const status = getIntentStatus(intent);
                    const result = executeResults?.find(r => r.intent === intent.intent); // In reality matching by index is better if multiple of same type
                    // Actually, let's match by index for results since multiple identical intents could exist
                    const rowResult = executeResults ? executeResults[idx] : null;

                    let identifierField = '';
                    let identifierLabel = '';
                    let identifierValue = '';
                    let amountValue = 0;
                    let showWarning = false;

                    if (intent.intent === 'CREATE_INVOICE') {
                      identifierField = 'contact_name';
                      identifierLabel = 'Customer';
                      identifierValue = intent.data.contact_name || '';
                      amountValue = intent.data.line_items?.[0]?.rate || 0;
                      showWarning = !intent.resolved.contact_id;
                    } else if (intent.intent === 'CREATE_BILL') {
                      identifierField = 'vendor_name';
                      identifierLabel = 'Vendor';
                      identifierValue = intent.data.vendor_name || '';
                      amountValue = intent.data.line_items?.[0]?.rate || 0;
                      showWarning = !intent.resolved.contact_id;
                    } else if (intent.intent === 'CREATE_EXPENSE') {
                      identifierField = 'payee';
                      identifierLabel = 'Payee';
                      identifierValue = intent.data.payee || '';
                      amountValue = intent.data.amount || 0;
                    } else if (intent.intent === 'CREATE_CONTACT') {
                      identifierField = 'name';
                      identifierLabel = 'Name';
                      identifierValue = intent.data.name || '';
                    } else if (intent.intent === 'CREATE_ITEM') {
                      identifierField = 'item_name';
                      identifierLabel = 'Name';
                      identifierValue = intent.data.item_name || '';
                      amountValue = intent.data.default_rate || 0;
                    }

                    return (
                      <tr key={idx} className="border-b border-[#f3f4f6]">
                        <td className="p-4 align-top">
                          <span 
                            className="text-[11px] font-medium px-2 py-1 rounded whitespace-nowrap"
                            style={{ backgroundColor: badge.bg, color: badge.color }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="p-4 align-top">
                          <div className="text-[13px] font-medium text-[#111118] mb-2">{intent.display_summary}</div>
                          {identifierLabel && (
                            <div className="flex items-center relative">
                              <span className="text-[11px] text-[#6b7280] absolute left-2">{identifierLabel}:</span>
                              <input 
                                type="text"
                                value={identifierValue}
                                onChange={e => updateIntent(idx, identifierField, e.target.value)}
                                className={`w-full h-8 pl-16 pr-2 text-[13px] border rounded bg-white focus:outline-none focus:border-[#7c3aed] ${showWarning ? 'border-[#d97706] border-l-2' : 'border-[#e5e7eb]'}`}
                              />
                              {showWarning && (
                                <AlertTriangle size={14} className="text-[#d97706] absolute right-2" title="Contact not found — will be skipped if not updated" />
                              )}
                            </div>
                          )}
                          
                          {rowResult && (
                            <div className="mt-2 flex items-center gap-1.5 text-[12px]">
                              {rowResult.success ? (
                                <>
                                  <CheckCircle2 size={14} className="text-[#16a34a]" />
                                  <span className="text-[#16a34a]">Created</span>
                                  {rowResult.record_id && (
                                    <Link 
                                      href={`/${intent.intent === 'CREATE_INVOICE' ? 'invoices' : intent.intent === 'CREATE_BILL' ? 'bills' : intent.intent === 'CREATE_EXPENSE' ? 'expenses' : intent.intent === 'CREATE_CONTACT' ? 'contacts' : 'items'}/${rowResult.record_id}`} 
                                      className="text-[#7c3aed] hover:underline ml-1"
                                    >
                                      View →
                                    </Link>
                                  )}
                                  {rowResult.navigate_to && (
                                    <Link href={rowResult.navigate_to} className="text-[#7c3aed] hover:underline ml-1">
                                      Open Report →
                                    </Link>
                                  )}
                                </>
                              ) : (
                                <>
                                  <X size={14} className="text-[#dc2626]" />
                                  <span className="text-[#dc2626]">{rowResult.error}</span>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-4 align-top">
                          {!['RUN_REPORT', 'ANSWER_QUESTION'].includes(intent.intent) ? (
                            <div className="relative">
                              <span className="absolute left-2 top-1.5 text-[13px] text-[#6b7280]">$</span>
                              <input 
                                type="number" 
                                value={(amountValue / 100).toFixed(2)}
                                onChange={e => {
                                  const val = e.target.value;
                                  const cents = Math.round(parseFloat(val || '0') * 100);
                                  if (intent.intent === 'CREATE_INVOICE' || intent.intent === 'CREATE_BILL') {
                                    updateLineItemRate(idx, cents);
                                  } else if (intent.intent === 'CREATE_EXPENSE') {
                                    updateIntent(idx, 'amount', cents);
                                  } else if (intent.intent === 'CREATE_ITEM') {
                                    updateIntent(idx, 'default_rate', cents);
                                  }
                                }}
                                className="w-full h-8 pl-6 pr-2 text-[13px] font-mono border border-[#e5e7eb] rounded bg-white focus:outline-none focus:border-[#7c3aed]"
                                step="0.01"
                              />
                            </div>
                          ) : (
                            <span className="text-[#9ca3af]">—</span>
                          )}
                        </td>
                        <td className="p-4 align-top">
                          {status === 'Ready' ? (
                            <div className="inline-flex items-center gap-1 bg-[#f0fdf4] text-[#16a34a] px-2 py-1 rounded text-[11px] font-medium">
                              <CheckCircle2 size={12} /> Ready
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 bg-[#fffbeb] text-[#d97706] px-2 py-1 rounded text-[11px] font-medium">
                              <AlertTriangle size={12} /> Review
                            </div>
                          )}
                        </td>
                        <td className="p-4 align-top text-center">
                          <button onClick={() => removeIntent(idx)} className="text-[#9ca3af] hover:text-[#dc2626]">
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="border-t border-[#e5e7eb] p-4 shrink-0 bg-white flex justify-between items-center">
            <div className="text-[13px] text-[#6b7280]">
              {pendingIntents.length > 0 ? `${pendingIntents.length} transaction(s) ready` : 'No transactions'}
            </div>
            <div className="flex gap-2">
              {executeResults ? (
                <button 
                  onClick={() => {
                    setPendingIntents([]);
                    setExecuteResults(null);
                  }}
                  className="bg-white border border-[#e5e7eb] rounded-lg text-[#374151] px-4 py-1.5 text-sm font-medium hover:bg-gray-50"
                >
                  Done
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => setPendingIntents([])}
                    disabled={pendingIntents.length === 0}
                    className="bg-white border border-[#e5e7eb] rounded-lg text-[#374151] px-4 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    Clear
                  </button>
                  <button 
                    onClick={executeAll}
                    disabled={!allReady || pendingIntents.length === 0 || isLoading}
                    className="bg-[#7c3aed] text-white rounded-full px-5 py-1.5 text-sm font-medium hover:bg-[#6d28d9] disabled:opacity-50 disabled:hover:bg-[#7c3aed]"
                  >
                    Execute All →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
