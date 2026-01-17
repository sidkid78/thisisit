import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

function extractSkillsFromProject(recommendations: any[]): string[] {
  const skillKeywords = ['ramp', 'grab bar', 'walk-in shower', 'doorway widening'];
  const requiredSkills = new Set<string>();

  recommendations.forEach(rec => {
    const detail = rec.details.toLowerCase();
    skillKeywords.forEach(keyword => {
      if (detail.includes(keyword)) {
        if (keyword === 'walk-in shower') requiredSkills.add('Walk-in Shower Conversion');
        if (keyword === 'ramp') requiredSkills.add('Ramp Installation');
        if (keyword === 'grab bar') requiredSkills.add('Grab Bar Installation');
        if (keyword === 'doorway widening') requiredSkills.add('Doorway Widening');
      }
    });
  });

  return Array.from(requiredSkills);
}

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');

  // Optional security check if secret is set
  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const project = await req.json();

  try {
    const { data: assessment, error: assessmentError } = await supabaseAdmin
      .from('ar_assessments')
      .select('recommendations')
      .eq('project_id', project.id)
      .single();

    if (assessmentError || !assessment) throw new Error(`Assessment not found for project ${project.id}`);

    const requiredSkills = extractSkillsFromProject(assessment.recommendations || []);

    // RPC call to find matching contractors
    const { data: matchedContractors, error: matchError } = await supabaseAdmin
      .rpc('find_matching_contractors', {
        project_location: project.location,
        required_skills: requiredSkills,
        limit_count: 5
      });

    if (matchError) throw matchError;

    if (matchedContractors && matchedContractors.length > 0) {
      const matchesToInsert = matchedContractors.map((contractor: any) => ({
        project_id: project.id,
        contractor_id: contractor.id,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('project_matches')
        .insert(matchesToInsert);

      if (insertError) throw insertError;
    }

    // Update project status
    await supabaseAdmin
      .from('projects')
      .update({ status: 'matching_complete' })
      .eq('id', project.id);

    return new Response(JSON.stringify({ message: `Found ${matchedContractors?.length || 0} matches.` }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('Contractor Matching Failed:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
