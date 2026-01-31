import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// POST /api/leads/[id]/view - Increment view count for a lead
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()

    // Get current user (optional - views can be tracked anonymously)
    const { data: { user } } = await supabase.auth.getUser()

    // Increment view count using RPC or direct update
    const { data, error } = await supabase
      .from('leads')
      .update({
        view_count: supabase.rpc('increment_view_count', { row_id: id })
      })
      .eq('id', id)
      .eq('status', 'AVAILABLE') // Only track views on available leads
      .select('view_count')
      .single()

    // Fallback: if RPC doesn't exist, do a manual increment
    if (error?.message?.includes('function') || error?.code === '42883') {
      // Get current count and increment
      const { data: lead } = await supabase
        .from('leads')
        .select('view_count')
        .eq('id', id)
        .single()

      const currentCount = lead?.view_count || 0

      const { data: updated, error: updateError } = await supabase
        .from('leads')
        .update({ view_count: currentCount + 1 })
        .eq('id', id)
        .eq('status', 'AVAILABLE')
        .select('view_count')
        .single()

      if (updateError) {
        console.error('View tracking error:', updateError)
        // Don't fail the request - view tracking is non-critical
        return NextResponse.json({ success: true, view_count: currentCount })
      }

      // Optionally log the view event
      if (user) {
        try {
          await supabase.from('lead_events').insert({
            lead_id: id,
            actor_id: user.id,
            type: 'VIEW',
            metadata: { timestamp: new Date().toISOString() }
          })
        } catch (e) {
          // Ignore errors on event logging
        }
      }

      return NextResponse.json({
        success: true,
        view_count: updated?.view_count || currentCount + 1
      })
    }

    if (error) {
      console.error('View tracking error:', error)
      return NextResponse.json({ success: true, view_count: null })
    }

    return NextResponse.json({ success: true, view_count: data?.view_count })

  } catch (err) {
    console.error('View tracking exception:', err)
    // Non-critical - don't fail the request
    return NextResponse.json({ success: true, view_count: null })
  }
}

// GET /api/leads/[id]/view - Get view count for a lead
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('leads')
      .select('view_count')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ view_count: 0 })
    }

    return NextResponse.json({ view_count: data?.view_count || 0 })

  } catch (err) {
    return NextResponse.json({ view_count: 0 })
  }
}
