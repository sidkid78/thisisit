-- ============================================
-- COMPLETE FIX FOR RLS INFINITE RECURSION
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- Step 1: Create helper functions with SECURITY DEFINER to bypass RLS
-- These functions safely query tables without triggering their RLS policies

CREATE OR REPLACE FUNCTION get_project_homeowner(p_project_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT homeowner_id FROM projects WHERE id = p_project_id;
$$;

CREATE OR REPLACE FUNCTION is_contractor_matched_to_project(p_project_id UUID, p_contractor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_matches
    WHERE project_matches.project_id = p_project_id 
    AND project_matches.contractor_id = p_contractor_id
  );
$$;

-- Step 2: Drop problematic policies
DROP POLICY IF EXISTS "Users can manage assessments for their own projects" ON public.ar_assessments;
DROP POLICY IF EXISTS "Matched contractors can view assessments" ON public.ar_assessments;
DROP POLICY IF EXISTS "Users can insert media for their assessments" ON public.assessment_media;
DROP POLICY IF EXISTS "Users can view their own assessment media" ON public.assessment_media;
DROP POLICY IF EXISTS "Contractors can view matched assessment media" ON public.assessment_media;

-- Step 3: Create simple, non-recursive policies for ar_assessments
CREATE POLICY "Users can manage assessments for their own projects" 
ON public.ar_assessments 
FOR ALL 
USING (get_project_homeowner(project_id) = auth.uid());

CREATE POLICY "Matched contractors can view assessments" 
ON public.ar_assessments 
FOR SELECT 
USING (is_contractor_matched_to_project(project_id, auth.uid()));

-- Step 4: Create simple policies for assessment_media
CREATE POLICY "Users can insert media for their assessments"
ON public.assessment_media 
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ar_assessments 
    WHERE ar_assessments.id = assessment_id 
    AND get_project_homeowner(ar_assessments.project_id) = auth.uid()
  )
);

CREATE POLICY "Users can view their own assessment media"
ON public.assessment_media 
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ar_assessments 
    WHERE ar_assessments.id = assessment_media.assessment_id 
    AND get_project_homeowner(ar_assessments.project_id) = auth.uid()
  )
);

CREATE POLICY "Contractors can view matched assessment media"
ON public.assessment_media 
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ar_assessments 
    WHERE ar_assessments.id = assessment_media.assessment_id 
    AND is_contractor_matched_to_project(ar_assessments.project_id, auth.uid())
  )
);

-- ============================================
-- SUCCESS! All policies have been fixed.
-- Try your assessment again.
-- ============================================
