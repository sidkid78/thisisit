# HOMEase AI Migration Plan

## Overview
Port the lead marketplace logic and UI from the legacy codebase to the Next.js 16 architecture.

---

## ✅ COMPLETED

### Phase 1: Database Schema (Supabase Migrations)
- [x] Created `20260130100000_lead_marketplace.sql` migration with:
  - `job_status` enum (AVAILABLE, LOCKED, PURCHASED, IN_PROGRESS, COMPLETED, ARCHIVED)
  - `contractor_profiles` table
  - `scan_sessions` table
  - `leads` table with fingerprinting and locking
  - `lead_events` table for audit trail
  - RLS policies for security
  - Indexes for performance
  - Triggers for updated_at

### Phase 2: API Routes
- [x] `GET /api/leads` - Public marketplace feed (sanitized, AVAILABLE only)
- [x] `POST /api/leads` - Homeowner publishes lead with fingerprint deduplication
- [x] `POST /api/leads/[id]/lock` - Contractor locks lead with idempotency key
- [x] `POST /api/leads/[id]/purchase` - Complete purchase (mock mode)
- [x] `GET /api/me/leads` - User's own leads (role-aware)

### Phase 3: Library & Types
- [x] `lib/types.ts` - TypeScript types for all entities
- [x] `lib/leads-api.ts` - Client-side API functions

### Phase 4: UI Components & Pages
- [x] Updated `app/page.tsx` - New landing page with light theme and particle effects
- [x] Updated `components/Navbar.tsx` - Role-based navigation
- [x] Created `app/dashboard/marketplace/page.tsx` - Lead marketplace for contractors
- [x] Created `app/dashboard/jobs/page.tsx` - My Jobs page for purchased leads
- [x] Updated `app/globals.css` - Light theme styles and animations
- [x] Updated `app/layout.tsx` - Light theme configuration

---

## 🔄 REMAINING WORK

### Phase 5: Homeowner Features
- [ ] Update homeowner dashboard (`/dashboard`)
- [ ] Create assessment/scan page (`/dashboard/assessment`)
- [ ] Integrate with existing AI analysis edge functions
- [ ] Add PDF report generation

### Phase 6: Real Payment Integration
- [ ] Replace mock purchase with Stripe PaymentIntent
- [ ] Add Stripe webhook handler for payment confirmation
- [ ] Implement proper lock expiration handling

### Phase 7: Additional Features
- [ ] Contractor profile management
- [ ] Real-time messaging between homeowner and contractor
- [ ] Project progress tracking
- [ ] Email notifications

### Phase 8: Testing & Polish
- [ ] Add error boundaries
- [ ] Add loading skeletons
- [ ] Mobile responsiveness testing
- [ ] E2E tests for critical flows

---

## Key Files Changed/Created

```
homease-ai/
├── app/
│   ├── api/
│   │   ├── leads/
│   │   │   ├── route.ts              # GET/POST marketplace leads
│   │   │   └── [id]/
│   │   │       ├── lock/route.ts     # Lock lead for purchase
│   │   │       └── purchase/route.ts # Complete purchase
│   │   └── me/
│   │       └── leads/route.ts        # User's own leads
│   ├── dashboard/
│   │   ├── marketplace/page.tsx      # Lead marketplace
│   │   └── jobs/page.tsx             # Purchased leads
│   ├── page.tsx                      # Landing page (updated)
│   ├── layout.tsx                    # Root layout (updated)
│   └── globals.css                   # Global styles (updated)
├── components/
│   └── Navbar.tsx                    # Navigation (updated)
├── lib/
│   ├── types.ts                      # TypeScript types
│   └── leads-api.ts                  # API client
├── supabase/
│   └── migrations/
│       └── 20260130100000_lead_marketplace.sql
└── MIGRATION_PLAN.md                 # This file
```

---

## Running the Migration

1. Apply database migration:
   ```bash
   supabase db push
   # OR
   supabase migration up
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Test the flows:
   - Visit landing page at `/`
   - Login as contractor
   - Browse marketplace at `/dashboard/marketplace`
   - Purchase a demo lead
   - View purchased leads at `/dashboard/jobs`

---

## Status: IN PROGRESS
Last updated: January 30, 2026
