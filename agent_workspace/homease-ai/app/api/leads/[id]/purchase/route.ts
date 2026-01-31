import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// Check if we're in demo/mock mode
const IS_MOCK_MODE = process.env.STRIPE_MOCK_MODE === 'true' || process.env.NODE_ENV === 'development'

/**
 * POST /api/leads/[id]/purchase
 * Complete the purchase of a locked lead
 * In production, this is typically called by Stripe webhook
 * In mock mode, this can be called directly
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

  // Get user profile to verify role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'contractor') {
    return NextResponse.json(
      { errorCode: 'FORBIDDEN', message: 'Only contractors can purchase leads' },
      { status: 403 }
    )
  }

  // In production mode, purchases are finalized by webhooks
  if (!IS_MOCK_MODE) {
    return NextResponse.json(
      { errorCode: 'PAYMENTS_LIVE_MODE', message: 'Purchases are finalized by Stripe webhooks in live mode.' },
      { status: 409 }
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

    // Verify lead is locked by this user
    if (lead.status !== 'LOCKED') {
      return NextResponse.json(
        { errorCode: 'LEAD_NOT_LOCKED', message: 'Lead must be locked before purchase' },
        { status: 400 }
      )
    }

    if (lead.locked_by_id !== user.id) {
      return NextResponse.json(
        { errorCode: 'NOT_LOCK_OWNER', message: 'Lead is locked by another user' },
        { status: 403 }
      )
    }

    // Check if already purchased
    if (lead.status === 'PURCHASED' || lead.contractor_id) {
      return NextResponse.json(
        { errorCode: 'ALREADY_PURCHASED', message: 'This lead has already been purchased' },
        { status: 409 }
      )
    }

    // Complete the purchase
    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update({
        status: 'PURCHASED',
        contractor_id: user.id,
        purchased_at: new Date().toISOString(),
        locked_at: null,
        locked_by_id: null,
      })
      .eq('id', leadId)
      .select()
      .single()

    if (updateError) throw updateError

    // Record event
    await supabase.from('lead_events').insert({
      lead_id: leadId,
      actor_id: user.id,
      type: 'purchased',
      metadata: { mock_mode: true, purchased_at: new Date().toISOString() },
    })

    return NextResponse.json({
      status: updatedLead.status,
      lead: updatedLead,
      message: 'Lead purchased successfully',
    })
  } catch (error: any) {
    console.error('Error purchasing lead:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
