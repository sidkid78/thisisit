import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/utils/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Lead price in cents ($49 per lead)
const LEAD_PRICE_CENTS = 4900

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { matchId, projectTitle } = body

    if (!matchId) {
      return NextResponse.json({ error: 'Match ID required' }, { status: 400 })
    }

    // Verify the match exists and belongs to this contractor
    const { data: match, error: matchError } = await supabase
      .from('project_matches')
      .select('*, projects(title, homeowner_id)')
      .eq('id', matchId)
      .eq('contractor_id', user.id)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Check if already purchased
    const { data: existingPurchase } = await supabase
      .from('lead_purchases')
      .select('id')
      .eq('match_id', matchId)
      .eq('status', 'completed')
      .single()

    if (existingPurchase) {
      return NextResponse.json({ error: 'Lead already purchased' }, { status: 400 })
    }

    // Get the base URL for redirects
    const origin = request.headers.get('origin') || 'http://localhost:3000'

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Lead: ${projectTitle || match.projects?.title || 'Home Assessment'}`,
              description: 'Access to homeowner contact information and project details',
            },
            unit_amount: LEAD_PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/dashboard?lead_purchased=true&match_id=${matchId}`,
      cancel_url: `${origin}/dashboard?lead_cancelled=true`,
      metadata: {
        match_id: matchId,
        contractor_id: user.id,
      },
    })

    // Create pending purchase record
    await supabase.from('lead_purchases').insert({
      match_id: matchId,
      contractor_id: user.id,
      stripe_session_id: session.id,
      amount_cents: LEAD_PRICE_CENTS,
      status: 'pending',
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
