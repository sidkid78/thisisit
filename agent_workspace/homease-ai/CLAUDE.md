# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HOMEase AI is a Next.js 16 application for AI-powered home safety assessment and contractor matching. Homeowners upload photos of rooms, the AI analyzes them for accessibility hazards (aging-in-place concerns), and the platform matches them with CAPS-certified contractors.

## Development Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint the codebase
npm run lint
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16 with App Router (React 19)
- **Database/Auth**: Supabase (PostgreSQL + Auth + Realtime + Edge Functions + Storage)
- **AI**: Google Generative AI (@google/genai)
- **Styling**: Tailwind CSS 4

### Key Directories

```
app/
├── api/                    # API route handlers
│   ├── assessment/         # Assessment submission endpoint
│   ├── checkout/           # Payment processing
│   ├── leads/[id]/match/   # Contractor-lead matching
│   └── submit-lead/        # Lead submission
├── auth/callback/          # OAuth callback handler
├── dashboard/              # Protected user dashboards
│   ├── assessment/         # Image upload & AI analysis page
│   ├── account/            # User profile management
│   ├── project/[id]/       # Project details & contractor matching
│   └── proposal/[id]/      # Contractor proposal management
├── login/                  # Auth UI (Supabase Auth UI)
└── signup/

components/                 # Shared React components
├── Chat.tsx               # Real-time messaging (Supabase Realtime)
├── DashboardHeader.tsx
└── Navbar.tsx

utils/supabase/            # Supabase client utilities
├── client.ts              # Browser client (createBrowserClient)
├── server.ts              # Server client (createServerClient with cookies)
└── middleware.ts          # Auth middleware helper
```

### User Roles

The app supports two roles via `profiles.role`:
- **homeowner**: Can create assessments, view projects, receive contractor proposals
- **contractor**: Receives matched leads, submits proposals, gets hired

### Core Data Flow

1. **Assessment**: Homeowner uploads room photos → stored in Supabase Storage (`assessment-media` bucket)
2. **AI Analysis**: Edge Function `process-ar-assessment` analyzes images, returns hazards/recommendations/score
3. **Lead Creation**: Completed assessment becomes a "lead" with urgency and budget
4. **Contractor Matching**: Edge Function `match-contractors` finds nearby CAPS contractors
5. **Proposals**: Contractors view leads and submit proposals with line-item pricing
6. **Acceptance**: Homeowner accepts proposal, project begins

### Supabase Tables (inferred from code)
- `profiles` - User profiles with role
- `projects` - Homeowner projects (status: draft → open_for_bids → proposal_accepted → completed)
- `ar_assessments` - AI assessment results (accessibility_score, identified_hazards, recommendations)
- `assessment_media` - References to uploaded images
- `project_matches` - Contractor-project matches with status and proposals
- `messages` - Real-time chat between users

### Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Supabase Edge Functions
- `process-ar-assessment` - AI image analysis
- `match-contractors` - Geographic contractor matching
