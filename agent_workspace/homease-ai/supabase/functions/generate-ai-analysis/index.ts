import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { GoogleGenAI } from "@google/genai"

const GEMINI_PROMPT = `You are an expert Certified Aging-in-Place Specialist (CAPS). Analyze the following home images for accessibility hazards for seniors.

Based ONLY on the visual information, identify specific issues and provide actionable recommendations.

Your response MUST be in valid JSON format with the following structure:
{
  "accessibility_score": <An integer between 0 and 100, where 100 is perfectly accessible>,
  "identified_hazards": [
    { "hazard": "Brief name of hazard", "details": "Description of the issue and why it's a risk", "area": "e.g., Doorway, Floor, Shower" }
  ],
  "recommendations": [
    { "recommendation": "Brief name of solution", "details": "Description of the modification to fix a hazard" }
  ]
}

Be thorough but realistic. Common hazards include:
- Trip hazards (rugs, uneven flooring, high thresholds)
- Lack of grab bars (bathrooms, stairs)  
- Poor lighting
- Narrow doorways
- Slippery surfaces
- Inaccessible storage
- Step-in tubs/showers

Respond ONLY with valid JSON, no additional text.`;

Deno.serve(async (req: Request) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { assessmentId, imagePaths } = await req.json();

  try {
    // 1. Generate signed URLs for the images
    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from('assessment-media')
      .createSignedUrls(imagePaths, 3600);
    if (urlError) throw urlError;

    const imageUrls = signedUrlData.map(item => item.signedUrl);

    // Helper function to convert ArrayBuffer to base64 without stack overflow
    function arrayBufferToBase64(buffer: ArrayBuffer): string {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 8192; // Process in 8KB chunks to avoid stack overflow
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      return btoa(binary);
    }

    // 2. Fetch images and convert to base64
    const imageContents = await Promise.all(
      imageUrls.map(async (url) => {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);
        const mimeType = response.headers.get('content-type') || 'image/jpeg';
        return { base64, mimeType };
      })
    );

    // 3. Call Google Gemini API for analysis
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    console.log('GEMINI_API_KEY present:', !!apiKey);
    console.log('GEMINI_API_KEY length:', apiKey?.length || 0);

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    const ai = new GoogleGenAI({ apiKey });

    // Build content array with images and prompt
    const contents = [
      GEMINI_PROMPT,
      ...imageContents.map(img => ({
        inlineData: {
          data: img.base64,
          mimeType: img.mimeType,
        }
      }))
    ];

    console.log('Calling Gemini API with', imageContents.length, 'images...');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        responseMimeType: 'application/json',
      }
    });

    console.log('Gemini API response received');

    // Parse the JSON response
    const responseText = response.text;
    console.log('Response text length:', responseText?.length || 0);

    if (!responseText) {
      throw new Error('Gemini API returned an empty response');
    }
    const geminiAnalysis = JSON.parse(responseText);
    console.log('Gemini analysis parsed successfully, score:', geminiAnalysis.accessibility_score);

    // 4. Generate visualization with Gemini Image (optional - if API key present)
    let visualizationUrls: string[] = [];

    if (apiKey && imageContents.length > 0) {
      try {
        const vizAi = new GoogleGenAI({ apiKey });

        // Generate a "after" visualization for the first image
        const vizPrompt = `Based on the safety recommendations: ${geminiAnalysis.recommendations.map((r: any) => r.recommendation).join(', ')}, 
        show this room with these modifications applied. Make the improvements subtle and realistic.`;

        const vizResponse = await vizAi.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: [
            {
              inlineData: {
                data: imageContents[0].base64,
                mimeType: imageContents[0].mimeType,
              }
            },
            vizPrompt
          ],
          config: {
            responseModalities: ['IMAGE', 'TEXT']
          }
        });

        // Extract image from response if present
        const parts = vizResponse.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            // Convert base64 to blob and upload to storage
            const imageBuffer = Uint8Array.from(atob(part.inlineData.data), c => c.charCodeAt(0));
            const vizFileName = `visualizations/${assessmentId}/${Date.now()}.png`;

            const { error: uploadError } = await supabaseAdmin.storage
              .from('assessment-media')
              .upload(vizFileName, imageBuffer, {
                contentType: 'image/png'
              });

            if (!uploadError) {
              const { data: publicUrl } = supabaseAdmin.storage
                .from('assessment-media')
                .getPublicUrl(vizFileName);
              visualizationUrls.push(publicUrl.publicUrl);
            }
          }
        }
      } catch (vizError) {
        console.error('Visualization generation failed:', vizError);
        // Continue without visualization
      }
    }

    // 5. Update the database with results
    const { error: updateError } = await supabaseAdmin
      .from('ar_assessments')
      .update({
        status: 'completed',
        accessibility_score: geminiAnalysis.accessibility_score,
        identified_hazards: geminiAnalysis.identified_hazards,
        recommendations: geminiAnalysis.recommendations,
        gemini_analysis_raw: geminiAnalysis,
        fal_ai_visualization_urls: visualizationUrls.length > 0 ? visualizationUrls : null,
      })
      .eq('id', assessmentId);

    if (updateError) throw updateError;

    return new Response('OK', { status: 200 });

  } catch (error: any) {
    console.error('AI Analysis Failed:', error);

    await supabaseAdmin
      .from('ar_assessments')
      .update({
        status: 'failed',
        error_message: error.message || 'Unknown error occurred'
      })
      .eq('id', assessmentId);

    return new Response(error.message, { status: 500 });
  }
});
