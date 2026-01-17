import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { assessmentId, imagePaths } = await req.json();
  if (!assessmentId || !imagePaths) return new Response('Missing parameters', { status: 400 });

  // Update assessment status to processing
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  await supabaseAdmin
    .from('ar_assessments')
    .update({ status: 'processing' })
    .eq('id', assessmentId);

  // Invoke the background worker function (fire and forget)
  // This call is fire-and-forget - we don't await the result
  supabaseAdmin.functions.invoke('generate-ai-analysis', {
    body: { assessmentId, imagePaths },
  }).catch(err => console.error('Background analysis trigger error:', err));

  return new Response(JSON.stringify({ assessmentId, message: 'Analysis started' }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    status: 202,
  });
})
