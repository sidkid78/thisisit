import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Helper to scrub PII from leads for public marketplace
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
 * GET /api/leads
 * Public marketplace feed (sanitized, AVAILABLE only)
 */
export async function GET() {
  const supabase = await createClient()

  try {
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'AVAILABLE')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Sanitize PII for public consumption
    const sanitizedLeads = (leads || []).map(scrubLeadPII)

    return NextResponse.json(sanitizedLeads)
  } catch (error: any) {
    console.error('Error fetching leads:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/leads
 * Homeowner publishes a lead from a scan session
 */
export async function POST(request: Request) {
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

  if (profile?.role !== 'homeowner') {
    return NextResponse.json(
      { errorCode: 'FORBIDDEN', message: 'Only homeowners can create leads' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { title, location, scope, price, tags, scopeTags, projectValue, scanId, previewImage } = body

    // Validate required fields
    if (!title || !location) {
      return NextResponse.json(
        { errorCode: 'VALIDATION_FAILED', message: 'Title and location are required' },
        { status: 400 }
      )
    }

    // If scanId provided, verify ownership
    let scan = null
    if (scanId) {
      const { data: scanData, error: scanError } = await supabase
        .from('scan_sessions')
        .select('*')
        .eq('id', scanId)
        .single()

      if (scanError || !scanData) {
        return NextResponse.json(
          { errorCode: 'SCAN_NOT_FOUND', message: 'Scan session not found' },
          { status: 404 }
        )
      }

      if (scanData.homeowner_id !== user.id) {
        return NextResponse.json(
          { errorCode: 'SCAN_NOT_OWNED', message: 'Scan does not belong to this user' },
          { status: 403 }
        )
      }

      scan = scanData
    }

    // Generate fingerprint to prevent duplicates
    const fingerprintSource = scan
      ? `${user.id}:${scan.id}:${scan.created_at}`
      : `${user.id}:${title}:${location}`
    
    const fingerprint = crypto
      .createHash('sha256')
      .update(fingerprintSource)
      .digest('hex')

    // Check for existing lead with same fingerprint
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('fingerprint', fingerprint)
      .single()

    if (existing) {
      return NextResponse.json(
        { errorCode: 'DUPLICATE_LEAD', message: 'A lead for this scan already exists' },
        { status: 409 }
      )
    }

    // Create the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        homeowner_id: user.id,
        fingerprint,
        title,
        location,
        scope: scope || null,
        price: price || 50.00,
        tags: tags || [],
        scope_tags: scopeTags || [],
        project_value: projectValue || null,
        preview_image: scan?.generated_image_url || scan?.original_image_url || previewImage || null,
        scan_id: scan?.id || null,
        status: 'AVAILABLE',
      })
      .select()
      .single()

    if (leadError) throw leadError

    // Record event
    await supabase.from('lead_events').insert({
      lead_id: lead.id,
      actor_id: user.id,
      type: 'created',
      metadata: { source: scan ? 'scan' : 'manual' },
    })

    return NextResponse.json(lead, { status: 201 })
  } catch (error: any) {
    console.error('Error creating lead:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
