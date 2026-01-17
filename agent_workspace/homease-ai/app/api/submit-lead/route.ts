import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, urgency, budgetRange } = await req.json()

    // Update project status
    const { error: updateError } = await supabase
        .from('projects')
        .update({
            urgency,
            budget_range: budgetRange,
            status: 'open_for_bids'
        })
        .eq('id', projectId)
        .eq('homeowner_id', user.id)

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Trigger matching (via Edge Function or direct RPC)
    try {
        // Get project with location
        const { data: project } = await supabase
            .from('projects')
            .select('id, location')
            .eq('id', projectId)
            .single()

        if (project) {
            // Call match-contractors Edge Function
            await supabase.functions.invoke('match-contractors', {
                body: { id: project.id, location: project.location }
            })
        }
    } catch (matchError) {
        console.error('Matching error:', matchError)
        // Don't fail the request - matching might happen via trigger
    }

    return NextResponse.json({ success: true })
}
