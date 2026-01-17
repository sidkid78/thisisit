You are an Expert Database Architect specializing in Supabase and PostgreSQL. Your task is to generate a single, comprehensive SQL script to initialize the database for the 'HOMEase' platform. The script must be production-ready, idempotent where possible, and strictly follow the architecture defined below.

### GLOBAL REQUIREMENTS

- Platform: Supabase (PostgreSQL 15+).
- Security: All tables must have Row Level Security (RLS) enabled immediately after creation.
- Extensions: You MUST enable the postgis extension to handle geospatial data.
- Identifiers: Use gen_random_uuid() for all primary keys unless otherwise specified.

### STEP 1: TYPES & EXTENSIONS

- Enable postgis.
- Create the following ENUM types:
  - user_role: 'homeowner', 'contractor', 'admin'
  - project_status: 'draft', 'open_for_bids', 'in_progress', 'completed', 'cancelled'
  - urgency_level: 'low', 'medium', 'high'
  - verification_status: 'pending', 'approved', 'rejected'
  - match_status: 'matched', 'viewed', 'declined', 'proposal_sent', 'proposal_accepted'
  - payment_status: 'succeeded', 'pending', 'failed'

### STEP 2: SCHEMA DEFINITION

Create the following tables with strict typing and Foreign Key constraints (use ON DELETE CASCADE or SET NULL appropriately):

- profiles: Extends auth.users. Columns: id (FK to auth.users), role (user_role), full_name, avatar_url, created_at, updated_at.
- contractor_details: 1:1 link to profiles. Columns: company_name, is_caps_certified (bool), stripe_connect_id, verification_status. CRITICAL CHANGE: Do NOT use a simple integer for radius. Define a service_area column of type GEOMETRY(POLYGON, 4326) to allow for precise service zones. Create a GIST index on this column.
- projects: The core lead. Links to homeowner_id (profiles). Columns: status, urgency, address (JSONB), budget_range.
- ar_assessments: 1:1 link to projects. Stores AI data. Columns: accessibility_score, identified_hazards (JSONB), recommendations (JSONB), gemini_visualization_urls (Array).
- project_matches: Join table between projects and contractor_details. Tracks match_status and proposal_details (JSONB).
- messages: Linked to project_matches. Stores chat history.
- payments: Records Stripe transactions. Links to project, payer, payee.

### STEP 3: SECURITY (RLS)

- Define a helper function get_my_role() to retrieve the current user's role. Implement the following granular policies:

**Profiles**: Users read/write their own. Authenticated users read others.

**Contractor Details**: Public read access ONLY if verification_status is 'approved'. Contractors read/write their own.

**Projects**: Homeowners read/write their own. Contractors can ONLY view projects if a record exists in project_matches connecting them.

**AR Assessments**: Same logic as Projects.

**Messages**: Only accessible by the homeowner or contractor linked to the specific project_match.

### STEP 4: AUTOMATION

- Create a trigger that automatically inserts a row into public.profiles when a new user signs up via auth.users.
- Create a handle_updated_at function and apply triggers to all tables with an updated_at column to auto-update the timestamp.

Output only the valid SQL code block.
