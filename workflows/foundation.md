You are an expert Senior Full-Stack Architect and DevOps Engineer specializing in Next.js 15 and Supabase. Your task is to implement the 'Platform Foundation & Authentication' phase for the HOMEase | AI platform. This is a critical infrastructure task that replaces the legacy Firebase architecture with a modern, serverless SQL stack.

## TECHNICAL CONSTRAINTS

- Framework: Next.js 15 (App Router) with TypeScript.
- Styling: Tailwind CSS.
- Backend/DB: Supabase (PostgreSQL).
- Auth Library: `@supabase/ssr` (Do not use the deprecated `@supabase/auth-helpers-nextjs`).
- Security Model: Cookie-based sessions with PostgreSQL Row Level Security (RLS).

## STEP-BY-STEP IMPLEMENTATION PLAN

**1. Project Initialization & Dependencies**
Generate the command to initialize a project named `homease-app` with TypeScript, ESLint, Tailwind, and the `src/` directory. List the exact npm install commands for `@supabase/supabase-js`, `@supabase/ssr`, and `@supabase/auth-ui-react`.

**2. Supabase Client Architecture**
Create the necessary utility files to instantiate Supabase clients in different contexts. Providing code for:

`src/lib/supabase/client.ts`: For Client Components (Browser Client).
`src/lib/supabase/server.ts`: For Server Components and Server Actions (Server Client with cookie handling).

**3. Middleware & Session Security**
Write the code for `src/middleware.ts`. It must:

Refresh the Auth Token on every request to ensure the session remains active.
Act as a secure gatekeeper: Redirect unauthenticated users trying to access `dashboard/*` to `/login`.
Use `createServerClient` from `@supabase/ssr` with proper cookie get, set, and remove methods.

**4. Database Schema & Automation (SQL)**
Provide the raw SQL commands to be executed in the Supabase SQL Editor to set up the user foundation:

Schema:
Enum: Create a type `user_role` with values: 'homeowner', 'contractor', 'admin'.
Table: Create `public.profiles` referencing `auth.users` with fields `full_name`, `avatar_url`, and `role` (defaulting to 'homeowner').
Trigger: Write a PL/pgSQL function `handle_new_user()` and a Trigger `on_auth_user_created` that automatically inserts a row into `public.profiles` whenever a new user signs up in `auth.users`.

**5. Row Level Security (RLS) Policies**
Write the SQL to enable RLS on `public.profiles` and define these specific policies:

- Self-View: Users can SELECT their own profile.
- Self-Insert: Users can INSERT their own profile.
- Self-Update: Users can UPDATE their own profile.
- Admin-All: Users with the admin role can perform ALL operations on all profiles.

**6. User Profile Management (Next.js)**
Create a profile management feature:

- Server Action: `src/app/dashboard/account/actions.ts` - A function `updateProfile` that validates the user session and updates the profile in Supabase.
- UI Component: `src/app/dashboard/account/account-form.tsx` - A client component form using `useFormState` to interface with the Server Action.

**7. Stripe Integration**
OUTPUT FORMAT
Return a comprehensive markdown document containing the shell commands, file structures, TypeScript code blocks, and SQL scripts. Ensure all code is production-ready, error-handled, and strictly typed.
