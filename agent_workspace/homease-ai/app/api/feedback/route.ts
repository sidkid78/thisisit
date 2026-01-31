import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        
        // Check auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { rating, helpful, comment, assessmentId } = body

        // Validate required fields
        if (!rating || rating < 1 || rating > 5) {
            return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
        }

        // Insert feedback
        const { data: feedback, error: insertError } = await supabase
            .from('feedback')
            .insert({
                user_id: user.id,
                assessment_id: assessmentId || null,
                rating,
                helpful: helpful ?? null,
                comment: comment || null,
                feedback_type: 'assessment',
                created_at: new Date().toISOString()
            })
            .select()
            .single()

        if (insertError) {
            console.error('Failed to insert feedback:', insertError)
            // If table doesn't exist, return success anyway (non-critical)
            if (insertError.code === '42P01') {
                return NextResponse.json({ success: true, message: 'Feedback noted (table pending)' })
            }
            return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
        }

        return NextResponse.json({ success: true, feedback })

    } catch (error) {
        console.error('Feedback API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        
        // Check auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const assessmentId = searchParams.get('assessmentId')

        // Get feedback
        let query = supabase
            .from('feedback')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (assessmentId) {
            query = query.eq('assessment_id', assessmentId)
        }

        const { data: feedbacks, error } = await query.limit(50)

        if (error) {
            // If table doesn't exist, return empty array
            if (error.code === '42P01') {
                return NextResponse.json({ feedbacks: [] })
            }
            throw error
        }

        return NextResponse.json({ feedbacks })

    } catch (error) {
        console.error('Feedback GET error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
