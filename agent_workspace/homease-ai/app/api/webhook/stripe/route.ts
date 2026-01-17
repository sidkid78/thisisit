import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Use service role for webhook (no user context)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    // For development without webhook signing secret, we'll skip verification
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    let event: Stripe.Event

    try {
        if (webhookSecret && signature) {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
        } else {
            // Development mode - parse event directly
            event = JSON.parse(body) as Stripe.Event
        }
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session

        const matchId = session.metadata?.match_id
        const contractorId = session.metadata?.contractor_id

        if (matchId && contractorId) {
            try {
                // Update purchase status to completed
                await supabase
                    .from('lead_purchases')
                    .update({
                        status: 'completed',
                        stripe_payment_intent_id: session.payment_intent as string,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('stripe_session_id', session.id)

                // Update match status to lead_purchased
                await supabase
                    .from('project_matches')
                    .update({ status: 'lead_purchased' })
                    .eq('id', matchId)

                console.log(`Lead purchase completed for match ${matchId}`)
            } catch (error) {
                console.error('Error updating purchase status:', error)
                return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
            }
        }
    }

    return NextResponse.json({ received: true })
}
