'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/utils'

interface Comment {
  id: string
  content: string
  created_at: string
  author: string
}

interface POCommentsProps {
  poId: string
}

export default function POComments({ poId }: POCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchComments() {
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/comments`)
      if (!res.ok) throw new Error('Failed to load comments')
      const data = await res.json()
      setComments(data.comments || [])
    } catch {
      setError('Could not load comments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchComments()
  }, [poId])

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to post comment')
      }
      setText('')
      await fetchComments()
    } catch (err: any) {
      setError(err.message || 'Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet</p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="space-y-1 border-b pb-3 last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{c.author}</span>
                <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2 pt-2">
        <Textarea
          placeholder="Add a comment..."
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={submitting}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleSend}
            disabled={submitting || !text.trim()}
          >
            {submitting ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  )
}
