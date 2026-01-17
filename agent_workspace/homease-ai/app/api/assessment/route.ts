import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { assessmentData, videoUrl } = body

    // 1. Save raw assessment data
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .insert({
        homeowner_id: user.id,
        assessment_data: assessmentData,
        video_url: videoUrl,
      })
      .select()
      .single()

    if (assessmentError) throw assessmentError

    // 2. Trigger AI Analysis (Mocking this step)
    // In a real app, this might call OpenAI or a specialized vision AI
    const aiAnalysis = await simulateAIAnalysis(assessmentData)

    // 3. Update assessment with AI results
    const { error: updateError } = await supabase
      .from('assessments')
      .update({ ai_analysis: aiAnalysis })
      .eq('id', assessment.id)

    if (updateError) throw updateError

    // 4. Automatically create a Lead based on analysis
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        homeowner_id: user.id,
        assessment_id: assessment.id,
        title: aiAnalysis.suggestedTitle,
        description: aiAnalysis.summary,
        budget_estimate: aiAnalysis.estimatedCost,
      })
      .select()
      .single()

    if (leadError) throw leadError

    return NextResponse.json({ assessment, lead, aiAnalysis })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function simulateAIAnalysis(data: any) {
  // Simulate delay
  await new Promise((resolve) => setTimeout(resolve, 2000))

  return {
    summary: "Based on the AR scan, there is significant water damage in the bathroom ceiling. Repairs will require drywall replacement and potential plumbing inspection.",
    suggestedTitle: "Bathroom Ceiling Water Damage Repair",
    estimatedCost: 1200.00,
    requiredSpecialties: ["Plumbing", "Drywall", "Painting"],
    confidenceScore: 0.92
  }
}
