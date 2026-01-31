import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// Helper to scrub PII from leads
function scrubLeadPII(lead: any) {
  const {
    homeowner_id,
    contractor_id,
    scan_id,
    fingerprint,
    stripe_payment_intent_id,
    locked_by_id,
    last_stripe_webhook_event_id,
    ...rest
  } = lead
  return rest
}

/**
 * GET /api/me/leads
 * Authenticated dashboard:
 * - Homeowner: leads they created
 * - Contractor: leads they purchased
 */
export async function GET() {
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

  try {
    // Get user profile to determine role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { errorCode: 'PROFILE_NOT_FOUND', message: 'User profile not found' },
        { status: 404 }
      )
    }

    let leads: any[] = []

    if (profile.role === 'homeowner') {
      // Homeowner sees leads they created
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('homeowner_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      leads = data || []
    } else if (profile.role === 'contractor') {
      // Contractor sees leads they purchased
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('contractor_id', user.id)
        .order('purchased_at', { ascending: false })

      if (error) throw error
      
      // Only show full details for purchased leads
      leads = (data || []).map(lead => 
        lead.status === 'PURCHASED' || lead.status === 'IN_PROGRESS' || lead.status === 'COMPLETED'
          ? lead
          : scrubLeadPII(lead)
      )
    } else {
      // Admin or other roles: show leads from both sides
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .or(`homeowner_id.eq.${user.id},contractor_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      leads = (data || []).map(lead =>
        lead.homeowner_id === user.id || lead.status === 'PURCHASED'
          ? lead
          : scrubLeadPII(lead)
      )
    }

    return NextResponse.json(leads)
  } catch (error: any) {
    console.error('Error fetching user leads:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
