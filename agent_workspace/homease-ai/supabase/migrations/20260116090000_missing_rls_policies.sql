-- Add missing RLS policies for assessment_media and skills tables

-- Assessment Media Policies
-- Users can insert media for their own assessments
CREATE POLICY "Users can insert media for their assessments"
  ON public.assessment_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ar_assessments a
      JOIN projects p ON a.project_id = p.id
      WHERE a.id = assessment_id AND p.homeowner_id = auth.uid()
    )
  );

-- Users can view media for assessments they own
CREATE POLICY "Users can view their own assessment media"
  ON public.assessment_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ar_assessments a
      JOIN projects p ON a.project_id = p.id
      WHERE a.id = assessment_media.assessment_id AND p.homeowner_id = auth.uid()
    )
  );

-- Matched contractors can view assessment media
CREATE POLICY "Contractors can view matched assessment media"
  ON public.assessment_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ar_assessments a
      JOIN projects p ON a.project_id = p.id
      JOIN project_matches pm ON p.id = pm.project_id
      WHERE a.id = assessment_media.assessment_id AND pm.contractor_id = auth.uid()
    )
  );

-- Skills table - readable by everyone (it's just a lookup table)
CREATE POLICY "Skills are readable by all authenticated users"
  ON public.skills FOR SELECT
  USING (auth.role() = 'authenticated');

-- Contractor Skills Policies
CREATE POLICY "Contractors can manage their own skills"
  ON public.contractor_skills FOR ALL
  USING (contractor_id = auth.uid());

CREATE POLICY "Anyone can view contractor skills"
  ON public.contractor_skills FOR SELECT
  USING (true);

-- Payments Policies (were missing)
CREATE POLICY "Users can view their own payments"
  ON public.payments FOR SELECT
  USING (
    auth.uid() = homeowner_id OR auth.uid() = contractor_id
  );

-- Service role can insert payments (for webhooks)
-- Note: Service role bypasses RLS, so this is mainly for documentation
