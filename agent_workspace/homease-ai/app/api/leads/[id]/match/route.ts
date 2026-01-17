import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id: leadId } = await params

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is a contractor
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'contractor') {
    return NextResponse.json({ error: 'Only contractors can match with leads' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { message } = body

    const { data: match, error } = await supabase
      .from('project_matches')
      .insert({
        project_id: leadId,
        contractor_id: user.id,
        status: 'matched'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ match })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
