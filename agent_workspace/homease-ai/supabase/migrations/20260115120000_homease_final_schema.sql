-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS postgis;

-- Custom Data Types (ENUMs)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('homeowner', 'contractor', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('draft', 'open_for_bids', 'in_progress', 'completed', 'cancelled', 'lead_submitted', 'matching_complete', 'proposals_received', 'proposal_accepted', 'awaiting_payment', 'payment_complete');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE urgency_level AS ENUM ('low', 'medium', 'high');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE match_status AS ENUM ('matched', 'viewed', 'declined', 'proposal_sent', 'proposal_accepted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('succeeded', 'pending', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Core User and Profile Tables
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  full_name TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'homeowner'
);

CREATE TABLE public.contractor_details (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT,
  bio TEXT,
  website_url TEXT,
  phone_number TEXT,
  address JSONB, -- { "street": "...", "city": "...", "state": "...", "zip": "..." }
  service_radius_miles INT,
  is_caps_certified BOOLEAN DEFAULT false,
  license_number TEXT,
  insurance_details JSONB, -- { "provider": "...", "policy_number": "...", "expiry_date": "..." }
  verification_status verification_status NOT NULL DEFAULT 'pending',
  stripe_connect_id TEXT UNIQUE, -- For Stripe Connect onboarding
  stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
  service_area GEOMETRY(Polygon, 4326), -- Defines the contractor's service area
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contractor_service_area ON contractor_details USING GIST (service_area);

-- Skills & Join Table
CREATE TABLE public.skills (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL -- e.g., 'Walk-in Shower Conversion', 'Ramp Installation'
);

CREATE TABLE public.contractor_skills (
  contractor_id UUID REFERENCES public.contractor_details(profile_id) ON DELETE CASCADE,
  skill_id INT REFERENCES public.skills(id) ON DELETE CASCADE,
  PRIMARY KEY (contractor_id, skill_id)
);

-- Project and Assessment Tables
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homeowner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  selected_contractor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  address JSONB NOT NULL,
  urgency urgency_level NOT NULL DEFAULT 'medium',
  budget_range TEXT, -- e.g., "$k-$10k"
  status project_status NOT NULL DEFAULT 'draft',
  location GEOMETRY(Point, 4326), -- Stores project's lat/lon
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.ar_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UNIQUE NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  room_type TEXT,
  accessibility_score INT CHECK (accessibility_score >= 0 AND accessibility_score <= 100),
  gemini_analysis_raw JSONB,
  identified_hazards JSONB, -- Array of objects: [{ "hazard": "...", "details": "..." }]
  recommendations JSONB, -- Array of objects: [{ "recommendation": "...", "details": "..." }]
  fal_ai_visualization_urls TEXT[], -- Array of URLs
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.assessment_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.ar_assessments(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, -- e.g., 'assessment-media/project_id/file.jpg'
  media_type TEXT NOT NULL, -- 'image' or 'video'
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interaction and Transaction Tables
CREATE TABLE public.project_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status match_status NOT NULL DEFAULT 'matched',
  proposal_details JSONB, -- The "Dynamic Scope Builder" output
  proposed_cost NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, contractor_id)
);

CREATE TABLE public.messages (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
CREATE INDEX idx_messages_project_id ON public.messages(project_id, created_at DESC);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  homeowner_id UUID NOT NULL REFERENCES public.profiles(id),
  contractor_id UUID NOT NULL REFERENCES public.profiles(id),
  stripe_charge_id TEXT UNIQUE NOT NULL,
  amount_total NUMERIC(10, 2) NOT NULL,
  platform_fee NUMERIC(10, 2) NOT NULL,
  amount_paid_to_contractor NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status payment_status NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UNIQUE NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id), -- Homeowner
  reviewee_id UUID NOT NULL REFERENCES public.profiles(id), -- Contractor
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TRIGGERS & FUNCTIONS
-- Create a profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'homeowner'::user_role)
  );
  
  -- If contractor, also create contractor_details entry
  IF (new.raw_user_meta_data->>'role') = 'contractor' THEN
    INSERT INTO public.contractor_details (profile_id) VALUES (new.id);
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Helper function to get the current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE;

-- ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_skills ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Authenticated users can view other profiles" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins have full access to profiles" ON public.profiles FOR ALL USING (get_my_role() = 'admin');

-- Contractor Details Policies
CREATE POLICY "Anyone can view approved contractor details" ON public.contractor_details FOR SELECT USING (verification_status = 'approved');
CREATE POLICY "Contractors can view their own details" ON public.contractor_details FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Contractors can manage their own details" ON public.contractor_details FOR ALL USING (auth.uid() = profile_id);
CREATE POLICY "Admins have full access to contractor details" ON public.contractor_details FOR ALL USING (get_my_role() = 'admin');

-- Projects Policies
CREATE POLICY "Homeowners can manage their own projects" ON public.projects FOR ALL USING (auth.uid() = homeowner_id);
CREATE POLICY "Matched contractors can view projects" ON public.projects FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM project_matches
    WHERE project_matches.project_id = projects.id AND project_matches.contractor_id = auth.uid()
  )
);

-- Assessments Policies
CREATE POLICY "Users can manage assessments for their own projects" ON public.ar_assessments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = ar_assessments.project_id AND projects.homeowner_id = auth.uid()
  )
);
CREATE POLICY "Matched contractors can view assessments" ON public.ar_assessments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN project_matches pm ON p.id = pm.project_id
    WHERE p.id = ar_assessments.project_id AND pm.contractor_id = auth.uid()
  )
);

-- Messages Policies
CREATE OR REPLACE FUNCTION is_project_participant(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects WHERE id = p_project_id AND homeowner_id = p_user_id
    UNION ALL
    SELECT 1 FROM project_matches WHERE project_id = p_project_id AND contractor_id = p_user_id AND status = 'proposal_accepted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Parties in a project can access their messages" ON public.messages FOR ALL USING (
  is_project_participant(project_id, auth.uid())
);
CREATE POLICY "Allow participants to send messages" ON public.messages FOR INSERT WITH CHECK (
  is_project_participant(project_id, auth.uid()) AND sender_id = auth.uid()
);

-- Project Matches Policies
CREATE POLICY "Involved parties can view project matches" ON public.project_matches FOR SELECT USING (
  auth.uid() = contractor_id OR
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_matches.project_id AND projects.homeowner_id = auth.uid()
  )
);

-- Reviews Policies
CREATE POLICY "Reviews are public" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Homeowners can create reviews for their completed projects" ON public.reviews FOR INSERT WITH CHECK (
  auth.uid() = reviewer_id AND
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = reviews.project_id
      AND projects.homeowner_id = auth.uid()
      AND projects.status = 'completed'
  )
);
