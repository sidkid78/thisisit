-- Migration: Add lead marketplace tables
-- This adds the leads system with locking, purchasing, and fingerprinting

-- Enum for job/lead status
CREATE TYPE job_status AS ENUM (
  'AVAILABLE',
  'LOCKED',
  'PURCHASED',
  'IN_PROGRESS',
  'COMPLETED',
  'ARCHIVED'
);

-- Contractor profiles (extends profiles table)
CREATE TABLE IF NOT EXISTS contractor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  license_number TEXT,
  insurance_url TEXT,
  service_areas TEXT[] DEFAULT '{}', -- zip codes / cities
  services_offered TEXT[] DEFAULT '{}', -- e.g. "ramps", "bathroom", etc.
  caps_certified BOOLEAN DEFAULT false,
  years_experience INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Scan sessions (room scans before publishing as leads)
CREATE TABLE IF NOT EXISTS scan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homeowner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  original_image_url TEXT,
  generated_image_url TEXT,
  room_type TEXT,
  analysis_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads table (marketplace)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homeowner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contractor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Fingerprint for deduplication
  fingerprint TEXT UNIQUE,
  
  -- Lead details
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  scope TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 50.00,
  status job_status DEFAULT 'AVAILABLE',
  project_value DECIMAL(10,2),
  tags TEXT[] DEFAULT '{}',
  scope_tags TEXT[] DEFAULT '{}',
  preview_image TEXT,
  
  -- Scan reference
  scan_id UUID REFERENCES scan_sessions(id) ON DELETE SET NULL,
  
  -- Purchase flow
  locked_at TIMESTAMPTZ,
  locked_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT,
  last_stripe_webhook_event_id TEXT,
  purchased_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Project tracking
  current_stage TEXT,
  progress INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead events (audit trail)
CREATE TABLE IF NOT EXISTS lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'created', 'locked', 'unlocked', 'purchased', 'completed', etc.
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_homeowner ON leads(homeowner_id);
CREATE INDEX IF NOT EXISTS idx_leads_contractor ON leads(contractor_id);
CREATE INDEX IF NOT EXISTS idx_leads_fingerprint ON leads(fingerprint);
CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_homeowner ON scan_sessions(homeowner_id);
CREATE INDEX IF NOT EXISTS idx_contractor_profiles_user ON contractor_profiles(user_id);

-- RLS Policies

-- Enable RLS
ALTER TABLE contractor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;

-- Contractor profiles: owners can read/write their own, others can read
CREATE POLICY "Users can view all contractor profiles"
  ON contractor_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own contractor profile"
  ON contractor_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contractor profile"
  ON contractor_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Scan sessions: only owner can access
CREATE POLICY "Users can view their own scans"
  ON scan_sessions FOR SELECT
  USING (auth.uid() = homeowner_id);

CREATE POLICY "Users can insert their own scans"
  ON scan_sessions FOR INSERT
  WITH CHECK (auth.uid() = homeowner_id);

CREATE POLICY "Users can update their own scans"
  ON scan_sessions FOR UPDATE
  USING (auth.uid() = homeowner_id);

-- Leads: complex access rules
-- Anyone can view AVAILABLE leads (marketplace)
CREATE POLICY "Anyone can view available leads"
  ON leads FOR SELECT
  USING (status = 'AVAILABLE');

-- Homeowners can view their own leads regardless of status
CREATE POLICY "Homeowners can view their own leads"
  ON leads FOR SELECT
  USING (auth.uid() = homeowner_id);

-- Contractors can view leads they purchased
CREATE POLICY "Contractors can view purchased leads"
  ON leads FOR SELECT
  USING (auth.uid() = contractor_id AND status IN ('PURCHASED', 'IN_PROGRESS', 'COMPLETED'));

-- Homeowners can create leads
CREATE POLICY "Homeowners can create leads"
  ON leads FOR INSERT
  WITH CHECK (auth.uid() = homeowner_id);

-- Updates handled by service role for locking/purchasing

-- Lead events: viewable by lead owner or contractor
CREATE POLICY "Lead participants can view events"
  ON lead_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.id = lead_events.lead_id 
      AND (leads.homeowner_id = auth.uid() OR leads.contractor_id = auth.uid())
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_contractor_profiles_updated_at
  BEFORE UPDATE ON contractor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scan_sessions_updated_at
  BEFORE UPDATE ON scan_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
