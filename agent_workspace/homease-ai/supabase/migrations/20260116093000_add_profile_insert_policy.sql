-- Fix missing INSERT policy for profiles table
-- The upsert operation needs an INSERT policy to succeed

-- Add INSERT policy for profiles - users can insert their own profile
CREATE POLICY "Users can insert their own profile" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Also add INSERT policy for contractor_details
DROP POLICY IF EXISTS "Contractors can manage their own details" ON public.contractor_details;

CREATE POLICY "Contractors can insert their own details"
  ON public.contractor_details
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Contractors can update their own details"
  ON public.contractor_details
  FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE POLICY "Contractors can delete their own details"
  ON public.contractor_details
  FOR DELETE
  USING (auth.uid() = profile_id);
