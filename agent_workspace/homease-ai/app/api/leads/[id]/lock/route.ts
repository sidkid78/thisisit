import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

const LOCK_DURATION_MS = 10 * 60 * 1000 // 10 minutes

/**
 * POST /api/leads/[id]/lock
 * Contractor initiates purchase by locking the lead
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { errorCode: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 }
    )
  }

  // Check idempotency key
  const idempotencyKey = request.headers.get('idempotency-key')
  if (!idempotencyKey) {
    return NextResponse.json(
      { errorCode: 'MISSING_IDEMPOTENCY_KEY', message: 'Idempotency-Key header is required' },
      { status: 400 }
    )
  }

  // Get user profile to verify role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'contractor') {
    return NextResponse.json(
      { errorCode: 'FORBIDDEN', message: 'Only contractors can lock leads' },
      { status: 403 }
    )
  }

  try {
    // Get the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      return NextResponse.json(
        { errorCode: 'LEAD_NOT_FOUND', message: 'Lead not found' },
        { status: 404 }
      )
    }

    // Check if already purchased
    if (lead.status === 'PURCHASED' || lead.status === 'IN_PROGRESS' || lead.status === 'COMPLETED') {
      return NextResponse.json(
        { errorCode: 'LEAD_ALREADY_PURCHASED', message: 'This lead has already been purchased' },
        { status: 409 }
      )
    }

    // Check if locked by another user
    if (lead.status === 'LOCKED' && lead.locked_by_id !== user.id) {
      const lockAge = Date.now() - new Date(lead.locked_at).getTime()
      
      if (lockAge < LOCK_DURATION_MS) {
        return NextResponse.json(
          { errorCode: 'LEAD_LOCKED', message: 'This lead is currently locked by another user' },
          { status: 409 }
        )
      }
      // Lock expired, allow re-locking
    }

    // If already locked by this user, return current state
    if (lead.status === 'LOCKED' && lead.locked_by_id === user.id) {
      return NextResponse.json({
        lead,
        message: 'Lead already locked by you',
        clientSecret: null, // Would be Stripe client secret in production
      })
    }

    // Lock the lead
    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update({
        status: 'LOCKED',
        locked_at: new Date().toISOString(),
        locked_by_id: user.id,
      })
      .eq('id', leadId)
      .select()
      .single()

    if (updateError) throw updateError

    // Record event
    await supabase.from('lead_events').insert({
      lead_id: leadId,
      actor_id: user.id,
      type: 'locked',
      metadata: { idempotency_key: idempotencyKey },
    })

    // In production, create Stripe PaymentIntent here
    // For now, return mock client secret
    return NextResponse.json({
      lead: updatedLead,
      clientSecret: `mock_secret_${leadId}_${Date.now()}`,
      message: 'Lead locked successfully',
    })
  } catch (error: any) {
    console.error('Error locking lead:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
