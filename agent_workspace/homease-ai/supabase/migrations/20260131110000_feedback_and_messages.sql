-- Feedback table for collecting user feedback on assessments
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES ar_assessments(id) ON DELETE SET NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    helpful BOOLEAN,
    comment TEXT,
    feedback_type TEXT DEFAULT 'assessment', -- 'assessment', 'general', 'feature'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
    ON feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
    ON feedback FOR SELECT
    USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_assessment_id ON feedback(assessment_id);

-- Messages table for contractor-homeowner communication
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    subject TEXT,
    message TEXT NOT NULL,
    message_type TEXT DEFAULT 'in_app', -- 'in_app', 'email', 'phone'
    preferred_callback_time TIMESTAMPTZ,
    status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read'
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can insert messages they send
CREATE POLICY "Users can send messages"
    ON messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

-- Users can view messages they sent or received
CREATE POLICY "Users can view own messages"
    ON messages FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Recipients can update message status (mark as read)
CREATE POLICY "Recipients can update message status"
    ON messages FOR UPDATE
    USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Add lead_events table if not exists (for tracking all lead activity)
CREATE TABLE IF NOT EXISTS lead_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'VIEW', 'MESSAGE_SENT', 'PURCHASE', 'CONTACT_REVEALED'
    event_data JSONB DEFAULT '{}',
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert events (for tracking views)
CREATE POLICY "Anyone can insert lead events"
    ON lead_events FOR INSERT
    WITH CHECK (true);

-- Users can view events for leads they own or purchased
CREATE POLICY "Users can view relevant lead events"
    ON lead_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM leads 
            WHERE leads.id = lead_events.lead_id 
            AND (leads.homeowner_id = auth.uid() OR leads.contractor_id = auth.uid())
        )
    );

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON lead_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_type ON lead_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lead_events_created_at ON lead_events(created_at DESC);

-- Add comment explaining the migration
COMMENT ON TABLE feedback IS 'User feedback on assessments and features';
COMMENT ON TABLE messages IS 'In-app messaging between contractors and homeowners';
COMMENT ON TABLE lead_events IS 'Activity tracking for leads (views, messages, purchases)';
