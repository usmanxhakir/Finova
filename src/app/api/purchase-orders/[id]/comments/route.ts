import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poId } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await (supabase.from('profiles') as any)
      .select('company_id')
      .eq('id', user.id)
      .limit(1)
      .maybeSingle()

    if (!profile?.company_id) {
      return Response.json({ error: 'Company not found' }, { status: 404 })
    }

    const { data: comments, error } = await (supabase.from('po_comments') as any)
      .select('id, content, created_at, user_id')
      .eq('po_id', poId)
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)

    // Fetch author names for each comment
    const enriched = await Promise.all(
      (comments || []).map(async (comment: any) => {
        const { data: authorProfile } = await (supabase.from('profiles') as any)
          .select('full_name')
          .eq('id', comment.user_id)
          .limit(1)
          .maybeSingle()

        return {
          id: comment.id,
          content: comment.content,
          created_at: comment.created_at,
          author: authorProfile?.full_name || 'Unknown',
        }
      })
    )

    return Response.json({ comments: enriched })
  } catch (error: any) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poId } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await (supabase.from('profiles') as any)
      .select('company_id')
      .eq('id', user.id)
      .limit(1)
      .maybeSingle()

    if (!profile?.company_id) {
      return Response.json({ error: 'Company not found' }, { status: 404 })
    }

    const body = await request.json()
    const content = typeof body.content === 'string' ? body.content.trim() : ''

    if (!content) {
      return Response.json({ error: 'Comment cannot be empty' }, { status: 400 })
    }

    const { error } = await (supabase.from('po_comments') as any)
      .insert({
        po_id: poId,
        user_id: user.id,
        company_id: profile.company_id,
        content,
      })

    if (error) throw new Error(error.message)

    return Response.json({ ok: true })
  } catch (error: any) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
