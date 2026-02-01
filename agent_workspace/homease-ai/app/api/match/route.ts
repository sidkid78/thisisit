import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { geocodeAddress, toPostGISPoint } from '@/lib/geocoding'

interface AddressData {
    street?: string
    city: string
    state: string
    zip: string
}

interface MatchRequestBody {
    projectId: string
    address: AddressData
    urgency?: string
    budgetRange?: string
}

/**
 * POST /api/match
 * Geocode the project address and find matching contractors
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()

        // Verify authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body: MatchRequestBody = await request.json()
        const { projectId, address, urgency, budgetRange } = body

        if (!projectId || !address) {
            return NextResponse.json(
                { error: 'Missing required fields: projectId and address' },
                { status: 400 }
            )
        }

        // Verify the project belongs to this user
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('id, homeowner_id, ar_assessments(recommendations)')
            .eq('id', projectId)
            .single()

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }

        if (project.homeowner_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Geocode the address
        const coords = await geocodeAddress(address)
        if (!coords) {
            return NextResponse.json(
                { error: 'Could not geocode address. Please check your address and try again.' },
                { status: 400 }
            )
        }

        // Update project with location and details
        const locationPoint = toPostGISPoint(coords.lat, coords.lng)
        const { error: updateError } = await supabase
            .from('projects')
            .update({
                location: locationPoint,
                urgency: urgency || 'medium',
                budget_range: budgetRange || '$5k-$10k',
                status: 'open_for_bids'
            })
            .eq('id', projectId)

        if (updateError) {
            console.error('Failed to update project:', updateError)
            return NextResponse.json(
                { error: 'Failed to update project location' },
                { status: 500 }
            )
        }

        // Extract required skills from assessment recommendations
        const recommendations = project.ar_assessments?.flatMap((a: any) => a.recommendations || []) || []
        const skillKeywords: Record<string, string[]> = {
            'grab bar': ['Grab Bars', 'Bathroom Safety'],
            'shower': ['Walk-in Shower', 'Bathroom Modifications'],
            'ramp': ['Wheelchair Ramps', 'Ramp Installation'],
            'stairlift': ['Stair Lifts', 'Mobility Equipment'],
            'widening': ['Door Widening', 'Doorway Modifications'],
            'handrail': ['Handrails', 'Stairway Safety'],
            'lighting': ['Lighting Improvements', 'Electrical'],
            'flooring': ['Non-slip Flooring', 'Floor Modifications'],
            'bathroom': ['Bathroom Modifications', 'Bathroom Safety'],
            'kitchen': ['Kitchen Modifications', 'Counter Height Adjustment'],
            'accessibility': ['General Accessibility', 'ADA Compliance']
        }

        const requiredSkills: string[] = []
        for (const rec of recommendations) {
            const recText = (rec.recommendation || '').toLowerCase()
            for (const [keyword, skills] of Object.entries(skillKeywords)) {
                if (recText.includes(keyword)) {
                    requiredSkills.push(...skills)
                }
            }
        }
        // Remove duplicates
        const uniqueSkills = [...new Set(requiredSkills)]

        // Call the find_matching_contractors RPC function
        const { data: matches, error: matchError } = await supabase
            .rpc('find_matching_contractors', {
                p_project_id: projectId,
                p_required_skills: uniqueSkills.length > 0 ? uniqueSkills : null
            })

        if (matchError) {
            console.error('Matching error:', matchError)
            // Even if matching fails, the project is still in the marketplace
            return NextResponse.json({
                success: true,
                message: 'Lead submitted! We\'re searching for contractors in your area.',
                matchCount: 0,
                coordinates: { lat: coords.lat, lng: coords.lng }
            })
        }

        const matchCount = matches?.length || 0

        // Update project status based on matches
        if (matchCount > 0) {
            await supabase
                .from('projects')
                .update({ status: 'matching_complete' })
                .eq('id', projectId)
        }

        return NextResponse.json({
            success: true,
            message: matchCount > 0
                ? `Found ${matchCount} qualified contractor${matchCount === 1 ? '' : 's'} in your area!`
                : 'Lead submitted! We\'re searching for contractors in your area.',
            matchCount,
            coordinates: { lat: coords.lat, lng: coords.lng }
        })

    } catch (error) {
        console.error('Match API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

/**
 * GET /api/match?projectId=xxx
 * Get matches for a project
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const projectId = request.nextUrl.searchParams.get('projectId')
        if (!projectId) {
            return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
        }

        // Get matches with contractor profiles
        const { data: matches, error } = await supabase
            .from('project_matches')
            .select(`
                *,
                profiles:contractor_id (
                    id,
                    full_name,
                    email,
                    phone,
                    is_caps_certified,
                    years_experience,
                    service_area_radius
                )
            `)
            .eq('project_id', projectId)
            .order('match_score', { ascending: false })

        if (error) {
            console.error('Error fetching matches:', error)
            return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
        }

        return NextResponse.json({ matches })

    } catch (error) {
        console.error('Match API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
