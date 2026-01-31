-- Migration: Add cost estimates and materials to ar_assessments
-- This adds new columns to support the enhanced AI analysis with cost estimates,
-- materials needed, and measurements from the legacy system

-- Add new columns to ar_assessments
ALTER TABLE public.ar_assessments 
ADD COLUMN IF NOT EXISTS cost_estimate_min NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS cost_estimate_max NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS materials_needed TEXT[],
ADD COLUMN IF NOT EXISTS estimated_measurements JSONB;

-- Add comment explaining the columns
COMMENT ON COLUMN public.ar_assessments.cost_estimate_min IS 'Minimum estimated cost for all recommended modifications (USD)';
COMMENT ON COLUMN public.ar_assessments.cost_estimate_max IS 'Maximum estimated cost for all recommended modifications (USD)';
COMMENT ON COLUMN public.ar_assessments.materials_needed IS 'Array of materials needed for recommended modifications';
COMMENT ON COLUMN public.ar_assessments.estimated_measurements IS 'JSON object of measurements identified in the assessment (e.g., doorway width, aisle width)';

-- Update the leads table to include assessment reference and accessibility score
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS assessment_id UUID REFERENCES public.ar_assessments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS accessibility_score INT CHECK (accessibility_score >= 0 AND accessibility_score <= 100),
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS estimated_value DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0;

COMMENT ON COLUMN public.leads.assessment_id IS 'Reference to the AR assessment that generated this lead';
COMMENT ON COLUMN public.leads.accessibility_score IS 'Safety score from the AI assessment (0-100)';
COMMENT ON COLUMN public.leads.project_id IS 'Reference to the project associated with this lead';
COMMENT ON COLUMN public.leads.description IS 'Detailed description of the work needed';
COMMENT ON COLUMN public.leads.estimated_value IS 'Estimated total project value (not lead price)';
COMMENT ON COLUMN public.leads.view_count IS 'Number of times this lead has been viewed by contractors';

-- Create index for faster assessment and project lookups
CREATE INDEX IF NOT EXISTS idx_leads_assessment_id ON public.leads(assessment_id);
CREATE INDEX IF NOT EXISTS idx_leads_project_id ON public.leads(project_id);
