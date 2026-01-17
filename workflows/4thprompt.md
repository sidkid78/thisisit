You are a Senior Full Stack Architect and AI Engineer specializing in Next.js 15, Supabase, and Generative AI integration.

Your task is to implement the AR Assessment & AI Analysis module for the HOMEase platform. This feature allows users to capture photos of their home, which are then analyzed by Google Gemini to identify accessibility hazards and generate 'after' visualizations.

Core Architecture Constraints
Frontend: Next.js 15 (App Router), @react-three/xr for WebXR capture.
Backend: Supabase (PostgreSQL, Auth, Storage, Edge Functions).
AI: Google Gemini API (Use gemini-1.5-pro or gemini-2.0-flash for multimodal capabilities).
Pattern: Asynchronous Split-Execution (Trigger Function -> Background Worker).
Step-by-Step Implementation Instructions

1. Database & Storage Configuration (SQL)
Write the SQL to:

Create the ar_assessments table with columns: id, project_id, status (enum: processing, completed, failed), accessibility_score (int), identified_hazards (JSONB), recommendations (JSONB), visualization_urls (text array).
Enable RLS and add a policy ensuring users can only view their own assessments.
Create a Storage Policy for the assessment-media bucket allowing authenticated uploads to private/{uid}/* folders.
2. Frontend Capture Component (ARAssessment.tsx)
Create a React Client Component that:

Initializes a WebXR session using @react-three/xr.
Provides a UI button to "Capture View".
Critical: Implements the logic to extract a Blob/File from the WebGL canvas (ensure preserveDrawingBuffer or equivalent strategy is handled so the image isn't blank).
Uploads the captured image to Supabase Storage.
Calls the process-ar-assessment function upon completion.
Subscribes to ar_assessments updates via supabase.channel to auto-display results.
3. Edge Function 1: The Trigger (process-ar-assessment)
Write a TypeScript Deno function that:

Validates the user's JWT.
Inserts a record into ar_assessments with status processing.
Crucial: Invokes the second function (generate-ai-analysis) asynchronously. Use EdgeRuntime.waitUntil or Supabase's { invokeOptions: { noWait: true } } pattern to return a 202 response immediately to the client.
4. Edge Function 2: The Worker (generate-ai-analysis)
Write a TypeScript Deno function that:

Bypasses RLS using the SUPABASE_SERVICE_ROLE_KEY.
Generates signed URLs for the uploaded images.
Step A (Analysis): Calls Gemini with a system prompt acting as a "Certified Aging-in-Place Specialist". Request JSON output containing a score (0-100), hazards, and recommendations.
Step B (Visualization): For the top recommendation, calls Gemini (or Imagen via Gemini API) to generate a renovation visualization. Prompt it to "preserve room structure while applying [Recommendation]".
Updates the ar_assessments record with the JSON results and the new image URL.
Handles errors by updating the status to failed.
5. Output Requirements
Provide robust TypeScript code for both Edge Functions.
Provide the complete SQL schema.
Provide the React component logic.
Ensure strict type safety and error handling throughout.
