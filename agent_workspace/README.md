# Agent Response - orchestrator_workers

**Session ID**: 05f3a444-9ec1-4279-bee8-468c042601fb
**Processing Time**: 364.27 seconds

## Final Response

Of course. Here is a comprehensive technical architecture plan for the HOMEase | AI platform, re-architected to use Next.js App Router and Supabase, replacing the original Google Cloud and Firebase stack.

### **Executive Summary**

This document outlines a comprehensive technical architecture for the HOMEase | AI platform, pivoting from the originally planned Google Cloud/Firebase stack to a modern, integrated solution centered on **Next.js 15 (App Router)** for the frontend and **Supabase** for all backend services. This strategic shift consolidates the technology stack, enhances developer experience, and leverages the power of PostgreSQL to build a secure, scalable, and real-time lead generation platform.

The architecture is built on Vercel for hosting, providing seamless deployment and performance optimization for the Next.js application. Supabase serves as a complete backend-as-a-service (BaaS), offering a relational PostgreSQL database, authentication, object storage, serverless Edge Functions, and real-time capabilities. This plan details the system's foundation, core user journeys, payment integration, administrative oversight, and a full DevOps pipeline, ensuring a robust and efficient path to market.

---

### **1. Core Technology Stack**

The platform is built on a modern, serverless architecture designed for scalability and performance.

| Component                  | Technology                                                                                                                                                                                          | Rationale                                                                                                                                                                             |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Frontend & Web Server**  | **Next.js 15 (App Router) on Vercel**                                                                                                                                                               | Provides a powerful React framework with Server Components, Server Actions, and an optimized build process. Vercel offers best-in-class hosting, performance, and CI/CD integration. |
| **Database**               | **Supabase (PostgreSQL)**                                                                                                                                                                           | A robust, relational SQL database offering data integrity, powerful querying with extensions like PostGIS for geospatial data, and fine-grained security via Row Level Security (RLS). |
| **Authentication**         | **Supabase Auth**                                                                                                                                                                                   | Manages user identity, social logins, and secure session handling via JWTs. Integrates seamlessly with the database and Next.js middleware for route protection.                  |
| **Serverless Functions**   | **Supabase Edge Functions (Deno)**                                                                                                                                                                  | Replaces Google Cloud Functions for running backend logic, orchestrating AI services, and handling webhooks. Deployed at the edge for low latency.                                    |
| **File Storage**           | **Supabase Storage**                                                                                                                                                                                | Securely stores user-uploaded images from AR assessments, contractor licenses, and other documents, with access control managed by database policies.                                 |
| **Real-time Engine**       | **Supabase Realtime**                                                                                                                                                                               | Powers live updates for the messaging system, online presence indicators, and notifications for asynchronous jobs like AI analysis and contractor matching.                           |
| **AI Analysis**            | **Google Gemini (Text & Image)**                                                                                                                                                                    | Google Gemini APIs are called from Supabase Edge Functions to perform hazard analysis (Gemini 3 Pro/Flash) and generate "after" visualizations (gemini-2.5-flash-image).                   |
| **Payments**               | **Stripe (Connect & Checkout)**                                                                                                                                                                     | Manages contractor onboarding, verification, payouts (Connect), and secure homeowner payments (Checkout) in a multi-party transaction model.                                        |
| **DevOps & CI/CD**         | **GitHub & Vercel with GitHub Actions**                                                                                                                                                             | Provides a complete, automated workflow from code commit to production deployment, including automated testing, preview deployments, and environment management.                      |

---

### **2. Platform Foundation: Data Model & Authentication**

The foundation of the platform is a secure, relational database and a robust authentication system that enforces strict access control based on user roles.

#### **2.1. Supabase Database Schema**

The data model is built on a normalized PostgreSQL schema, ensuring data integrity and consistency.

* **`profiles`**: Extends the built-in `auth.users` table, storing public data like `full_name`, `avatar_url`, and the critical `role` (`homeowner`, `contractor`, or `admin`). A database trigger automatically creates a profile for each new user.
* **`contractor_details`**: A one-to-one extension of `profiles` for contractors, containing fields for `company_name`, `is_caps_certified`, `verification_status`, and their `stripe_connect_id`. It also includes a `GEOMETRY` column for their service area, powered by the PostGIS extension.
* **`projects`**: The central table representing a homeowner's lead. It links to the `homeowner_id`, stores the project `status` (e.g., `draft`, `open_for_bids`, `completed`), and contains address/location data.
* **`ar_assessments`**: Stores the output of the AI analysis, including the `accessibility_score`, `identified_hazards` (JSONB), `recommendations` (JSONB), and `gemini_visualization_urls`.
* **`project_matches`**: A join table linking `projects` to matched `contractors`, tracking the status of their interaction (e.g., `matched`, `proposal_sent`).
* **`messages`**: Stores all real-time chat messages, linked to a specific project match.
* **`payments`**: Records every transaction processed through Stripe, linking the `project_id`, `payer_id`, `payee_id`, and `stripe_charge_id`.

#### **2.2. Authentication and Authorization**

Authentication is handled by Supabase Auth, integrated into Next.js using the `@supabase/ssr` library.

1. **Session Management:** A Next.js middleware file securely manages the user's session by refreshing the auth cookie on every request, making user data available to both Server and Client Components.
2. **Route Protection:** The middleware also acts as a gatekeeper, redirecting unauthenticated users away from protected routes like `/dashboard` and `/admin`.
3. **Row Level Security (RLS):** This is the cornerstone of the platform's security. RLS policies are PostgreSQL rules that filter data at the database level, ensuring users can only access data they are permitted to see.
    * **Example Policy 1:** A user can only select or update their own row in the `profiles` table.

        ```sql
        CREATE POLICY "Users can manage their own profile."
        ON public.profiles FOR ALL USING ( auth.uid() = id );
        ```

    * **Example Policy 2:** A homeowner can only view projects they have created.

        ```sql
        CREATE POLICY "Homeowners can view their own projects."
        ON public.projects FOR SELECT USING ( auth.uid() = homeowner_id );
        ```

    * **Example Policy 3:** A contractor can only view projects they have been explicitly matched with.

        ```sql
        CREATE POLICY "Contractors can view matched projects."
        ON public.projects FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM project_matches
            WHERE project_matches.project_id = projects.id
            AND project_matches.contractor_id = auth.uid()
          )
        );
        ```

---

### **3. Core Journey: AR Assessment to Contractor Match**

This two-stage, asynchronous workflow forms the innovative core of the HOMEase platform.

#### **Stage 1: AR Assessment and AI Analysis**

This stage is designed to be non-blocking, providing a responsive user experience while computationally intensive AI tasks run in the background.

1. **Capture (Frontend):** The homeowner uses a WebXR-based component (built with `@react-three/xr`) in the Next.js app to capture images of their home. These images are uploaded directly and securely to a private bucket in **Supabase Storage**.
2. **Initiate (Edge Function):** The app invokes a Supabase Edge Function (`process-ar-assessment`), passing the storage paths of the uploaded images. This function immediately creates a placeholder record in the `ar_assessments` table with a `processing` status and returns a `202 Accepted` response to the user.
3. **Orchestrate (Background Function):** The initiator function then triggers a second, long-running Edge Function (`generate-ai-analysis`) without awaiting its completion. This worker function:
    * Generates secure, signed URLs for the stored images.
    * Calls the **Google Gemini API** with the images and a specialized prompt to perform hazard analysis.
    * Calls **Gemini 2.5 Flash Image** (`gemini-2.5-flash-image`) with the results to generate "after" visualizations.
4. **Persist & Notify:** The worker function updates the `ar_assessments` record with the AI results and changes its status to `completed`. The homeowner's app, subscribed to database changes via **Supabase Realtime**, is instantly notified and displays the full report.

#### **Stage 2: Lead Submission and Contractor Matching**

Once the assessment is complete, the homeowner can submit it as a lead, triggering the asynchronous matching process.

1. **Submit (Frontend):** The homeowner reviews the report, adds budget and urgency details, and clicks "Find Contractors." This action updates the corresponding `projects` table record, setting its `status` to `open_for_bids`.
2. **Trigger (Database):** A **PostgreSQL Trigger** on the `projects` table detects this specific status change. It securely invokes a Supabase Edge Function (`match-contractors`) via a database webhook, passing the project data as the payload. This trigger-based approach is more robust and conditional than a simple webhook.
3. **Match (Edge Function):** The `match-contractors` function executes the matching logic:
    * It queries the `contractor_details` table using a **PostGIS geospatial function** (`ST_Contains`) to find contractors whose service area polygon contains the project's location point.
    * It further filters these contractors by skills (derived from the AR recommendations) and CAPS certification.
    * This complex query is encapsulated in a PostgreSQL Function (RPC) for performance and maintainability.
4. **Persist & Notify:** For each qualified contractor found, the function inserts a record into the `project_matches` table. The homeowner's dashboard, subscribed via **Supabase Realtime**, automatically populates with contractor profiles as they are matched.

---

### **4. User Interfaces: Dashboards & Communication**

The platform provides role-specific dashboards for homeowners and contractors, built as protected routes within the Next.js application.

#### **4.1. Homeowner Dashboard (`/dashboard/homeowner`)**

* **Project Hub:** View a list of all projects and their current status on a visual timeline.
* **Contractor Matching:** See a real-time list of matched contractors as they are found by the backend process.
* **Proposal Management:** Review, accept, or decline proposals submitted by contractors.
* **Secure Payments:** Initiate payments via Stripe Checkout after accepting a proposal.
* **Real-time Chat:** Communicate directly with the selected contractor.

#### **4.2. Contractor Dashboard (`/dashboard/contractor`)**

* **Profile Management:** Manage company details, upload licenses/insurance, and define a service area by drawing a polygon on an interactive map.
* **Lead Feed:** View and manage incoming, pre-qualified leads.
* **Dynamic Scope Builder:** An interactive tool that uses the AR assessment data as a starting point. Contractors can convert AI recommendations into line items, add custom items, and set prices to auto-generate a detailed proposal.
* **Payment Tracking:** View payment history and manage payouts.

#### **4.3. Real-time Messaging System**

The chat feature is powered entirely by Supabase Realtime, operating on a secure, project-specific channel.

* **Message Syncing:** New messages inserted into the `messages` table are broadcast to participants in real-time using **Postgres Changes**.
* **Online Status:** **Supabase Presence** tracks which users are currently active in the chat, allowing for "Online" indicators.
* **Typing Indicators:** Ephemeral "is typing..." notifications are sent using **Supabase Broadcast**, which avoids writing unnecessary data to the database.

---

### **5. Monetization & Administration**

The platform's financial operations and internal oversight are handled by Stripe integration and a secure admin dashboard.

#### **5.1. Stripe Payment Integration**

* **Contractor Onboarding:** Contractors are onboarded using **Stripe Connect Express**. A Server Action in Next.js creates a Stripe account link, redirecting the user to Stripe's secure flow. A webhook confirms when their account is verified and ready for payouts.
* **Homeowner Payments:** After a proposal is accepted, the homeowner pays using **Stripe Checkout**. The platform fee is automatically calculated and transferred to the HOMEase platform account during the transaction using Stripe's `application_fee_amount` parameter.
* **Webhook Handling:** A single, secure Supabase Edge Function (`stripe-webhooks`) acts as the endpoint for all Stripe events. It verifies the Stripe signature on every request and updates the `payments` and `projects` tables accordingly, ensuring a reliable record of all financial activity.

#### **5.2. Administrative Dashboard (`/admin`)**

This is a role-protected area of the app, accessible only to users with the `admin` role.

* **Security:** Access is controlled by the Next.js middleware, which checks the user's role from the `profiles` table.
* **Analytics:** A main dashboard displays key platform metrics like user growth, lead volume, and revenue.
* **Contractor Approval:** An interface for reviewing pending contractor applications, viewing their uploaded documents, and approving or rejecting them.
* **User Management:** A tool for viewing and managing all user accounts on the platform. All administrative actions are executed via secure Next.js Server Actions.

---

### **6. Deployment & DevOps on Vercel**

A full CI/CD pipeline ensures code quality and automates deployments, enabling rapid and reliable iteration.

1. **Hosting on Vercel:** The Next.js application is deployed to Vercel, which provides a global Edge Network, automatic scaling, and seamless integration with GitHub.
2. **Environment Strategy:**
    * **Production:** The live application, connected to the production Supabase project and deployed from the `main` branch.
    * **Preview (Staging):** For every pull request, Vercel creates a unique preview deployment connected to a separate staging Supabase project. This allows for thorough testing and review before merging.
    * **Local:** Developers run the app locally, also connected to the staging Supabase project.
3. **CI/CD Pipeline with GitHub Actions:**
    * **Trigger:** The pipeline runs automatically on every pull request to the `main` branch.
    * **Quality Gates:** A GitHub Actions workflow runs a series of checks:
        * **Linting:** Enforces code style consistency with ESLint.
        * **Testing:** Runs automated unit and integration tests (e.g., with Vitest or Jest).
        * **Type Checking:** The `next build` command performs a full TypeScript check.
    * **Branch Protection:** A GitHub branch protection rule is configured on `main` to prevent merging until all CI checks have passed.
    * **Deployment:** Once a pull request is approved and merged, Vercel automatically builds and deploys the new version to production, using the production environment variables configured in the Vercel dashboard.

## Intermediate Steps

### Task Coordinator

Task Understanding:
The user wants a comprehensive technical architecture plan to build the HOMEase | AI platform. The key constraint is to replace the original Google Cloud and Firebase stack with a new stack centered on Next.js (using the App Router) and Supabase. The plan must cover all aspects of the platform described in the briefing document, including user roles, the AR assessment with AI analysis, lead generation, contractor matching, payments, and real-time communication.

Execution Strategy:
The technical architecture plan will be executed in a phased, feature-driven approach. Phase 1 focuses on establishing the core infrastructure using Next.js and Supabase, including authentication, database schema, and a CI/CD pipeline. Phase 2 develops the core user journey, from the AR assessment and AI analysis to lead generation and contractor matching. Phase 3 builds the user-facing dashboards and communication tools. Phase 4 layers in monetization with Stripe and provides administrative oversight. This strategy prioritizes building the foundational components first, followed by the core value-generating features, ensuring a solid and scalable architecture. The technology stack is consolidated around Vercel for the frontend and Supabase for all backend services (database, authentication, serverless functions, storage), replacing the original GCP and Firebase stack.

Subtasks:

1. Platform Foundation & Authentication with Next.js and Supabase (Priority: 1, Expertise: Frontend Development (Next.js), Backend Development (Supabase Auth))
   Description: Set up the Next.js 15 application using the App Router. Integrate Supabase for authentication, replacing Firebase Auth. This includes configuring user roles (homeowner, contractor, admin) and implementing Row Level Security (RLS) policies in Supabase to ensure data access is restricted based on user roles. Create sign-up, sign-in, and user profile management pages.
   Dependencies: None
2. Supabase Database Schema Design and Implementation (Priority: 2, Expertise: Database Architecture, Backend Development (Supabase, PostgreSQL))
   Description: Design and implement the complete database schema in Supabase Postgres, replacing Firebase Firestore. This includes creating tables for users, profiles, projects (leads), AR assessments, contractor details (including CAPS certification), real-time messages, and payment records. Define all table relationships, constraints, and data types. Implement comprehensive RLS policies for all tables to enforce data security.
   Dependencies: foundation_auth
3. AR Assessment Flow and AI Service Integration (Priority: 3, Expertise: Frontend Development (WebXR), Backend Development (Supabase Edge Functions), AI API Integration)
   Description: Develop the AR assessment flow using a WebXR-based approach for broad accessibility. Create a Supabase Edge Function to securely receive image data from the frontend. This function will orchestrate calls to the Google Gemini API for hazard analysis and Gemini 2.5 Flash Image (gemini-2.5-flash-image) for generating 'after' visualizations. The results, including the accessibility score, recommendations, and visualization URLs, will be saved to the 'assessments' table in the database.
   Dependencies: db_schema
4. Asynchronous Lead Generation and Contractor Matching (Priority: 4, Expertise: Backend Development (Supabase Edge Functions, PostgreSQL))
   Description: Implement the process for a homeowner to submit their completed AR assessment as a formal lead. This involves creating a new project record in the database. Use a Supabase database webhook to trigger a serverless Edge Function asynchronously. This function will execute the contractor matching logic, querying the contractor profiles based on geographic location, skills, and availability, and then associating the matched contractors with the new project.
   Dependencies: ar_ai_integration
5. Homeowner and Contractor Dashboards Development (Priority: 5, Expertise: Frontend Development (Next.js), UI/UX Design)
   Description: Build the user-facing dashboards. For homeowners, this includes viewing project status, communicating with contractors, and managing payments. For contractors, this includes managing their profile, viewing and responding to leads, and using a 'Dynamic Scope Builder' to generate proposals based on the AR assessment data.
   Dependencies: lead_matching
6. Real-time Messaging System (Priority: 6, Expertise: Frontend Development (Next.js), Backend Development (Supabase Realtime))
   Description: Implement a real-time messaging system between homeowners and contractors using Supabase's Realtime Broadcast and Presence features. This will allow for instant communication within the platform. All messages will be stored in the database with RLS policies ensuring only the participants can view them.
   Dependencies: user_dashboards
7. Payment Integration and Administrative Dashboard (Priority: 7, Expertise: Backend Development (Stripe Integration, Supabase Edge Functions), Frontend Development)
   Description: Integrate Stripe Connect for contractor onboarding, verification, and payouts. Use Stripe Checkout for homeowners to make secure payments for projects. Develop Supabase Edge Functions to handle Stripe webhooks for events like successful payments or transfers, ensuring the database is updated accordingly. Build a separate admin dashboard for platform administrators to manage the contractor approval process, oversee user accounts, and view key platform analytics.
   Dependencies: user_dashboards
8. Deployment, Hosting, and DevOps Pipeline on Vercel (Priority: 8, Expertise: DevOps, CI/CD (GitHub Actions), Vercel Platform)
   Description: Establish a full CI/CD pipeline using GitHub Actions for automated testing and deployment. Configure deployments to Vercel, the recommended hosting platform for Next.js. Set up distinct environments for development, staging, and production, managing Supabase project URLs and API keys securely as environment variables in Vercel.
   Dependencies: foundation_auth

**Metadata:**

```json
{
  "execution_strategy": "The technical architecture plan will be executed in a phased, feature-driven approach. Phase 1 focuses on establishing the core infrastructure using Next.js and Supabase, including authentication, database schema, and a CI/CD pipeline. Phase 2 develops the core user journey, from the AR assessment and AI analysis to lead generation and contractor matching. Phase 3 builds the user-facing dashboards and communication tools. Phase 4 layers in monetization with Stripe and provides administrative oversight. This strategy prioritizes building the foundational components first, followed by the core value-generating features, ensuring a solid and scalable architecture. The technology stack is consolidated around Vercel for the frontend and Supabase for all backend services (database, authentication, serverless functions, storage), replacing the original GCP and Firebase stack.",
  "subtasks": [
    {
      "dependencies": [],
      "description": "Set up the Next.js 15 application using the App Router. Integrate Supabase for authentication, replacing Firebase Auth. This includes configuring user roles (homeowner, contractor, admin) and implementing Row Level Security (RLS) policies in Supabase to ensure data access is restricted based on user roles. Create sign-up, sign-in, and user profile management pages.",
      "required_expertise": "Frontend Development (Next.js), Backend Development (Supabase Auth)",
      "priority": 1,
      "title": "Platform Foundation & Authentication with Next.js and Supabase",
      "id": "foundation_auth"
    },
    {
      "id": "db_schema",
      "required_expertise": "Database Architecture, Backend Development (Supabase, PostgreSQL)",
      "priority": 2,
      "title": "Supabase Database Schema Design and Implementation",
      "dependencies": [
        "foundation_auth"
      ],
      "description": "Design and implement the complete database schema in Supabase Postgres, replacing Firebase Firestore. This includes creating tables for users, profiles, projects (leads), AR assessments, contractor details (including CAPS certification), real-time messages, and payment records. Define all table relationships, constraints, and data types. Implement comprehensive RLS policies for all tables to enforce data security."
    },
    {
      "description": "Develop the AR assessment flow using a WebXR-based approach for broad accessibility. Create a Supabase Edge Function to securely receive image data from the frontend. This function will orchestrate calls to the Google Gemini API for hazard analysis and Gemini 2.5 Flash Image (gemini-2.5-flash-image) for generating 'after' visualizations. The results, including the accessibility score, recommendations, and visualization URLs, will be saved to the 'assessments' table in the database.",
      "id": "ar_ai_integration",
      "required_expertise": "Frontend Development (WebXR), Backend Development (Supabase Edge Functions), AI API Integration",
      "dependencies": [
        "db_schema"
      ],
      "title": "AR Assessment Flow and AI Service Integration",
      "priority": 3
    },
    {
      "description": "Implement the process for a homeowner to submit their completed AR assessment as a formal lead. This involves creating a new project record in the database. Use a Supabase database webhook to trigger a serverless Edge Function asynchronously. This function will execute the contractor matching logic, querying the contractor profiles based on geographic location, skills, and availability, and then associating the matched contractors with the new project.",
      "priority": 4,
      "required_expertise": "Backend Development (Supabase Edge Functions, PostgreSQL)",
      "dependencies": [
        "ar_ai_integration"
      ],
      "title": "Asynchronous Lead Generation and Contractor Matching",
      "id": "lead_matching"
    },
    {
      "description": "Build the user-facing dashboards. For homeowners, this includes viewing project status, communicating with contractors, and managing payments. For contractors, this includes managing their profile, viewing and responding to leads, and using a 'Dynamic Scope Builder' to generate proposals based on the AR assessment data.",
      "required_expertise": "Frontend Development (Next.js), UI/UX Design",
      "title": "Homeowner and Contractor Dashboards Development",
      "dependencies": [
        "lead_matching"
      ],
      "id": "user_dashboards",
      "priority": 5
    },
    {
      "priority": 6,
      "dependencies": [
        "user_dashboards"
      ],
      "title": "Real-time Messaging System",
      "description": "Implement a real-time messaging system between homeowners and contractors using Supabase's Realtime Broadcast and Presence features. This will allow for instant communication within the platform. All messages will be stored in the database with RLS policies ensuring only the participants can view them.",
      "required_expertise": "Frontend Development (Next.js), Backend Development (Supabase Realtime)",
      "id": "realtime_messaging"
    },
    {
      "id": "payments_admin",
      "priority": 7,
      "required_expertise": "Backend Development (Stripe Integration, Supabase Edge Functions), Frontend Development",
      "title": "Payment Integration and Administrative Dashboard",
      "description": "Integrate Stripe Connect for contractor onboarding, verification, and payouts. Use Stripe Checkout for homeowners to make secure payments for projects. Develop Supabase Edge Functions to handle Stripe webhooks for events like successful payments or transfers, ensuring the database is updated accordingly. Build a separate admin dashboard for platform administrators to manage the contractor approval process, oversee user accounts, and view key platform analytics.",
      "dependencies": [
        "user_dashboards"
      ]
    },
    {
      "required_expertise": "DevOps, CI/CD (GitHub Actions), Vercel Platform",
      "description": "Establish a full CI/CD pipeline using GitHub Actions for automated testing and deployment. Configure deployments to Vercel, the recommended hosting platform for Next.js. Set up distinct environments for development, staging, and production, managing Supabase project URLs and API keys securely as environment variables in Vercel.",
      "dependencies": [
        "foundation_auth"
      ],
      "id": "deployment_devops",
      "priority": 8,
      "title": "Deployment, Hosting, and DevOps Pipeline on Vercel"
    }
  ],
  "task_understanding": "The user wants a comprehensive technical architecture plan to build the HOMEase | AI platform. The key constraint is to replace the original Google Cloud and Firebase stack with a new stack centered on Next.js (using the App Router) and Supabase. The plan must cover all aspects of the platform described in the briefing document, including user roles, the AR assessment with AI analysis, lead generation, contractor matching, payments, and real-time communication."
}
```

### Frontend Development (Next.js), Backend Development (Supabase Auth) Specialist

### **Comprehensive Technical Architecture Plan: HOMEase | AI**

### **Subtask: Platform Foundation & Authentication with Next.js and Supabase**

This document details the setup of the foundational web application for HOMEase | AI using Next.js 15 (App Router) and the complete integration of Supabase for authentication and user management. This replaces the originally planned Firebase/GCP stack, establishing a secure, scalable, and role-based access control system from the outset.

---

#### **1. Project Setup & Supabase Integration**

This section covers the initial setup of the Next.js application and its connection to a new Supabase project.

##### **1.1. Initializing the Next.js 15 Application**

We will start by creating a new Next.js project configured with TypeScript and Tailwind CSS for styling, which are industry standards for modern web development.

**Command:**

```bash
npx create-next-app@latest homease-app
```

**Configuration during setup:**

* **TypeScript:** Yes
* **ESLint:** Yes
* **Tailwind CSS:** Yes
* **`src/` directory:** Yes
* **App Router:** Yes (Default)
* **Import alias:** `@/*`

This command scaffolds a new project in the `homease-app` directory with the recommended App Router structure.

##### **1.2. Setting up the Supabase Project**

1. **Create Project:** Navigate to [database.new](https://database.new) and create a new project for HOMEase. Select a strong password for the database and store it securely.
2. **Retrieve API Keys:** In the Supabase dashboard, go to **Project Settings > API**. You will need two values:
    * **Project URL** (e.g., `https://<your-project-ref>.supabase.co`)
    * **`anon` (public) Key**

##### **1.3. Configuring Supabase in Next.js**

We will use the `@supabase/ssr` library, which is specifically designed for server-side rendering environments like the Next.js App Router. It securely manages authentication state via cookies.

**1. Install Supabase Libraries:**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

**2. Environment Variables:**
Create a file named `.env.local` in the root of your project to store the Supabase credentials securely. Never commit this file to version control.

`.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

*Note: The `NEXT_PUBLIC_` prefix makes these variables available in the browser, which is necessary for the Supabase client.*

**3. Create the Supabase Client:**
To avoid repeating client creation logic, we'll create a utility module that provides Supabase client instances for different contexts (Client Components, Server Components, Server Actions, and Route Handlers).

`src/lib/supabase/client.ts` (For Client Components)

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

`src/lib/supabase/server.ts` (For Server Components, Actions, Route Handlers)

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.delete({ name, ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
```

---

#### **2. Core Authentication Flow**

This section covers the implementation of user sign-up, sign-in, session management, and route protection.

##### **2.1. Implementing Sign-Up and Sign-In**

For rapid development and a polished user experience, we'll use Supabase's pre-built UI components.

**1. Install Auth UI Helpers:**

```bash
npm install @supabase/auth-ui-react @supabase/auth-ui-shared
```

**2. Create the Authentication Page:**
This page will serve as the entry point for both new and returning users.

`src/app/login/page.tsx`

```tsx
'use client'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // User is logged in, redirect to dashboard
        router.push('/dashboard')
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-4">Welcome to HOMEase</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']} // Example: Add social providers
          redirectTo={`${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback`}
        />
      </div>
    </div>
  )
}
```

*Note: You'll need to create an `auth/callback` route handler as per Supabase documentation to handle OAuth redirects.*

##### **2.2. Session Management with Middleware**

Middleware is crucial for maintaining the user's session by refreshing the auth cookie on every request. It also serves as the gatekeeper for protected routes.

`src/middleware.ts`

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          request.cookies.delete({ name, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.delete({ name, ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect routes
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

---

#### **3. User Roles & Row Level Security (RLS)**

This is the most critical part of the security architecture, replacing Firebase Custom Claims and Firestore Rules with Supabase's powerful PostgreSQL-based RLS.

##### **3.1. Database Schema for User Profiles and Roles**

We will create a `profiles` table that is linked one-to-one with Supabase's built-in `auth.users` table. This table will store public user information and their role.

**1. Create Role Enum Type:**
In the Supabase SQL Editor (`database.new` -> SQL Editor), run this query to define the possible user roles.

```sql
-- Create a custom type for user roles
CREATE TYPE user_role AS ENUM ('homeowner', 'contractor', 'admin');
```

**2. Create `profiles` Table:**

```sql
-- Create the profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ,
  full_name TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'homeowner'
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

##### **3.2. Automating Profile and Role Creation with a Database Trigger**

To ensure every new user gets a profile entry and a default role, we'll create a PostgreSQL function and trigger it automatically whenever a new user signs up.

**SQL to run in Supabase SQL Editor:**

```sql
-- This trigger automatically creates a profile entry for new users.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    'homeowner' -- Assign 'homeowner' as the default role
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function after a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

This server-side logic is more secure and reliable than assigning roles on the client. Admins can later change a user's role directly in the `profiles` table.

##### **3.3. Implementing Row Level Security (RLS) Policies**

RLS policies are PostgreSQL rules that restrict which rows users can access or modify. They are the cornerstone of our data security.

**Policy 1: Users can only view and update their own profile.**

```sql
-- Users can view their own profile
CREATE POLICY "Users can view their own profile."
  ON public.profiles FOR SELECT
  USING ( auth.uid() = id );

-- Users can update their own profile
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id );
```

**Policy 2 (Example for a future `leads` table): Homeowners can only see leads they created.**
Assume a `leads` table exists with a `homeowner_id` column of type `UUID`.

```sql
-- Enable RLS on the leads table
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Policy for homeowners to access their leads
CREATE POLICY "Homeowners can view their own leads."
  ON public.leads FOR SELECT
  USING ( auth.uid() = homeowner_id );
```

**Policy 3 (Example): Contractors can only see leads they are matched with.**
Assume a `lead_matches` table exists linking `lead_id` and `contractor_id`.

```sql
-- Policy for contractors to view matched leads
CREATE POLICY "Contractors can view matched leads."
  ON public.leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lead_matches
      WHERE lead_matches.lead_id = leads.id
      AND lead_matches.contractor_id = auth.uid()
    )
  );
```

**Policy 4: Admins have full access.**
We can create a policy that checks the user's role from the `profiles` table.

```sql
-- Function to get the current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE;

-- Admin full access policy on profiles table
CREATE POLICY "Admins have full access to profiles."
  ON public.profiles FOR ALL
  USING ( get_my_role() = 'admin' );
```

*Note: This admin policy must be combined with the user-specific policies. RLS policies are permissive, meaning if any `SELECT` policy returns true, access is granted.*

---

#### **4. User Profile Management**

Finally, we'll create a page where authenticated users can manage their profile information.

##### **4.1. Building the Profile Page UI**

We'll use a Server Component to fetch initial data and a Client Component form to handle user input and interaction.

`src/app/dashboard/account/page.tsx`

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AccountForm from "./account-form";

export default async function AccountPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    // Handle error appropriately
  }

  return <AccountForm user={user} profile={profile} />;
}
```

##### **4.2. Securely Fetching and Updating Profile Data with Server Actions**

The `AccountForm` will be a Client Component that uses a Server Action to securely update the user's data on the backend. This prevents exposing API endpoints.

`src/app/dashboard/account/account-form.tsx`

```tsx
'use client'
import { User } from '@supabase/supabase-js'
import { updateProfile } from './actions'
import { useFormState } from 'react-dom'

type Profile = { full_name: string | null; avatar_url: string | null; } | null

export default function AccountForm({ user, profile }: { user: User, profile: Profile }) {
  const initialState = { message: null };
  const [state, formAction] = useFormState(updateProfile, initialState);

  return (
    <form action={formAction}>
      <h2 className="text-xl font-semibold">Account Details</h2>
      <p>Email: {user.email}</p>
      
      <div className="mt-4">
        <label htmlFor="fullName">Full Name</label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          defaultValue={profile?.full_name || ''}
          className="w-full p-2 border rounded"
        />
      </div>

      {/* Add other fields like avatar_url */}
      
      <button type="submit" className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
        Update Profile
      </button>
      {state?.message && <p className="text-red-500 mt-2">{state.message}</p>}
    </form>
  )
}
```

`src/app/dashboard/account/actions.ts`

```ts
'use server'
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile(prevState: any, formData: FormData) {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { message: 'Authentication required.' };
  }

  const fullName = formData.get('fullName') as string;

  const { error } = await supabase.from('profiles').update({
    full_name: fullName,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id);

  if (error) {
    console.error('Update profile error:', error);
    return { message: 'Failed to update profile.' };
  }

  revalidatePath('/dashboard/account'); // Re-renders the page with new data
  return { message: 'Profile updated successfully!' };
}
```

This completes the foundational setup. We now have a secure, role-aware application base ready for the next phases of development, including the AR assessment, lead management, and contractor matching features.

**Metadata:**

```json
{
  "subtask_id": "foundation_auth",
  "title": "Platform Foundation & Authentication with Next.js and Supabase",
  "expertise": "Frontend Development (Next.js), Backend Development (Supabase Auth)"
}
```

### Database Architecture, Backend Development (Supabase, PostgreSQL) Specialist

### **Comprehensive Technical Architecture Plan: HOMEase | AI**

### **Subtask: Supabase Database Schema Design and Implementation**

This document provides the complete database schema and security policy implementation for the HOMEase platform using Supabase's PostgreSQL database. This schema replaces the original Firebase Firestore model, leveraging the power of relational data, structured types, and PostgreSQL's robust Row Level Security (RLS) to ensure data integrity and security.

---

#### **1. Schema Design Philosophy**

The schema is designed around a relational model to enforce data consistency and integrity, which is a significant advantage over a NoSQL structure for this application's needs.

* **Normalization:** Data is normalized to reduce redundancy. For example, contractor-specific details are in a separate table, linked to the main user profile.
* **UUIDs as Primary Keys:** We use `uuid` for all primary keys (`id` columns), generated by `gen_random_uuid()`. This prevents enumeration attacks and simplifies integration with various services.
* **Foreign Key Constraints:** Relationships are strictly enforced using foreign key constraints with appropriate `ON DELETE` actions (e.g., `CASCADE` for dependent data, `SET NULL` for optional relationships).
* **Custom Types (ENUMs):** PostgreSQL's `ENUM` types are used for fields with a fixed set of possible values (e.g., user roles, project statuses). This improves data integrity and readability.
* **JSONB for Flexibility:** The `jsonb` data type is used for semi-structured data like AR analysis results, addresses, or proposal details, offering a balance between structure and flexibility.

---

#### **2. SQL Implementation: Types, Tables, and Relationships**

Execute the following SQL statements in your Supabase project's SQL Editor.

##### **2.1. Custom Data Types (ENUMs)**

First, we define the custom types that will be used across multiple tables.

```sql
-- From previous step, ensure this exists
-- CREATE TYPE user_role AS ENUM ('homeowner', 'contractor', 'admin');

-- New types for the application domain
CREATE TYPE project_status AS ENUM ('draft', 'open_for_bids', 'in_progress', 'completed', 'cancelled');
CREATE TYPE urgency_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE match_status AS ENUM ('matched', 'viewed', 'declined', 'proposal_sent', 'proposal_accepted');
CREATE TYPE payment_status AS ENUM ('succeeded', 'pending', 'failed');
```

##### **2.2. Core User and Profile Tables**

These tables handle user identity and role-specific data.

**Table: `profiles`** (Extends `auth.users`)
*Purpose: Stores common user data and the critical `role` field.*

```sql
-- This table should exist from the foundation_auth subtask.
-- If not, create it as follows:
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ,
  full_name TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'homeowner'
);
```

**Table: `contractor_details`**
*Purpose: Stores detailed information specific to contractors, including verification status and payment details.*

```sql
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
```

##### **2.3. Project and Assessment Tables**

These tables form the core of the lead generation workflow.

**Table: `projects`** (The "Lead")
*Purpose: Represents a homeowner's modification project, which becomes a lead for contractors.*

```sql
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homeowner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  selected_contractor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  address JSONB NOT NULL,
  urgency urgency_level NOT NULL,
  budget_range TEXT, -- e.g., "$5k-$10k"
  status project_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
```

**Table: `ar_assessments`**
*Purpose: Stores the results from the AR scan and subsequent AI analysis.*

```sql
CREATE TABLE public.ar_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UNIQUE NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  room_type TEXT,
  accessibility_score INT CHECK (accessibility_score >= 0 AND accessibility_score <= 100),
  gemini_analysis_raw JSONB,
  identified_hazards JSONB, -- Array of objects: [{ "hazard": "...", "details": "..." }]
  recommendations JSONB, -- Array of objects: [{ "recommendation": "...", "details": "..." }]
  fal_ai_visualization_urls TEXT[], -- Array of URLs
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Table: `assessment_media`**
*Purpose: Stores references to images/videos from an AR scan, linked to Supabase Storage.*

```sql
CREATE TABLE public.assessment_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.ar_assessments(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, -- e.g., 'assessment-media/project_id/file.jpg'
  media_type TEXT NOT NULL, -- 'image' or 'video'
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
```

##### **2.4. Interaction and Transaction Tables**

These tables manage the interactions between homeowners and contractors.

**Table: `project_matches`**
*Purpose: Tracks which contractors are matched with a project and the status of their engagement.*

```sql
CREATE TABLE public.project_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status match_status NOT NULL DEFAULT 'matched',
  proposal_details JSONB, -- The "Dynamic Scope Builder" output
  proposed_cost NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  UNIQUE(project_id, contractor_id) -- A contractor can only be matched to a project once
);
```

**Table: `messages`**
*Purpose: A simple, real-time messaging system scoped to a specific project match.*

```sql
CREATE TABLE public.messages (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  project_match_id UUID NOT NULL REFERENCES public.project_matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Table: `payments`**
*Purpose: Records all financial transactions processed via Stripe.*

```sql
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  payer_id UUID NOT NULL REFERENCES public.profiles(id), -- Homeowner
  payee_id UUID NOT NULL REFERENCES public.profiles(id), -- Contractor
  stripe_charge_id TEXT UNIQUE NOT NULL,
  amount_cents INT NOT NULL, -- Store amount in cents to avoid floating point issues
  currency TEXT NOT NULL DEFAULT 'usd',
  status payment_status NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Table: `reviews`**
*Purpose: Allows homeowners to leave reviews for contractors upon project completion.*

```sql
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UNIQUE NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id), -- Homeowner
  reviewee_id UUID NOT NULL REFERENCES public.profiles(id), -- Contractor
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### **3. Row Level Security (RLS) Policies**

RLS is the cornerstone of data security in this architecture. The following policies restrict data access based on the authenticated user's ID and role.

**First, enable RLS on all tables:**

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
```

**Helper Function to get user role (if not already created):**

```sql
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE;
```

##### **3.1. `profiles` Policies**

* **Logic:** Users can see and edit their own profile. Authenticated users can see other profiles (for viewing contractor/homeowner info). Admins can do anything.

```sql
-- Users can view their own profile
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Authenticated users can view other profiles
CREATE POLICY "Authenticated users can view other profiles" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins have full access
CREATE POLICY "Admins have full access to profiles" ON public.profiles
  FOR ALL USING (get_my_role() = 'admin');
```

##### **3.2. `contractor_details` Policies**

* **Logic:** Anyone can view approved contractor details. Only the contractor themselves or an admin can create/update their details.

```sql
-- Anyone can view approved contractor details
CREATE POLICY "Public can view approved contractor details" ON public.contractor_details
  FOR SELECT USING (verification_status = 'approved');

-- Contractor can view their own details regardless of status
CREATE POLICY "Contractors can view their own details" ON public.contractor_details
  FOR SELECT USING (auth.uid() = profile_id);

-- Contractor can create/update their own details
CREATE POLICY "Contractors can manage their own details" ON public.contractor_details
  FOR ALL USING (auth.uid() = profile_id);

-- Admins have full access
CREATE POLICY "Admins have full access to contractor details" ON public.contractor_details
  FOR ALL USING (get_my_role() = 'admin');
```

##### **3.3. `projects` and `ar_assessments` Policies**

* **Logic:** Homeowners can manage their own projects. Matched contractors can view project details. The selected contractor can view. Admins can view all.

```sql
-- For projects table
CREATE POLICY "Homeowners can manage their own projects" ON public.projects
  FOR ALL USING (auth.uid() = homeowner_id);

CREATE POLICY "Matched contractors can view projects" ON public.projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_matches
      WHERE project_matches.project_id = projects.id AND project_matches.contractor_id = auth.uid()
    )
  );

-- For ar_assessments and assessment_media (same logic, just change table name)
CREATE POLICY "Users can manage assessments for their own projects" ON public.ar_assessments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = ar_assessments.project_id AND projects.homeowner_id = auth.uid()
    )
  );

CREATE POLICY "Matched contractors can view assessments" ON public.ar_assessments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN project_matches pm ON p.id = pm.project_id
      WHERE p.id = ar_assessments.project_id AND pm.contractor_id = auth.uid()
    )
  );
```

*(Note: Create similar policies for `assessment_media` referencing its `assessment_id`)*

##### **3.4. `project_matches` Policies**

* **Logic:** The associated homeowner and contractor can view their match.

```sql
CREATE POLICY "Involved parties can view project matches" ON public.project_matches
  FOR SELECT USING (
    auth.uid() = contractor_id OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_matches.project_id AND projects.homeowner_id = auth.uid()
    )
  );
```

##### **3.5. `messages` Policies**

* **Logic:** Only the sender or receiver of a message (determined via the `project_match`) can access it.

```sql
CREATE POLICY "Parties in a match can access their messages" ON public.messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_matches pm
      JOIN projects p ON pm.project_id = p.id
      WHERE pm.id = messages.project_match_id
        AND (auth.uid() = pm.contractor_id OR auth.uid() = p.homeowner_id)
    )
  );
```

##### **3.6. `reviews` Policies**

* **Logic:** Reviews are public to read. Only the homeowner of a completed project can create a review for that project.

```sql
-- Reviews are public
CREATE POLICY "Reviews are public" ON public.reviews
  FOR SELECT USING (true);

-- Homeowner can create a review for their completed project
CREATE POLICY "Homeowners can create reviews for their projects" ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id AND
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = reviews.project_id
        AND projects.homeowner_id = auth.uid()
        AND projects.status = 'completed'
    )
  );
```

This comprehensive schema provides a secure, scalable, and relationally-sound foundation for the HOMEase application, fully replacing the original Firebase/GCP data layer with the powerful capabilities of Supabase and PostgreSQL.

**Metadata:**

```json
{
  "subtask_id": "db_schema",
  "title": "Supabase Database Schema Design and Implementation",
  "expertise": "Database Architecture, Backend Development (Supabase, PostgreSQL)"
}
```

### DevOps, CI/CD (GitHub Actions), Vercel Platform Specialist

### **Comprehensive Technical Architecture Plan: HOMEase | AI**

### **Subtask: Deployment, Hosting, and DevOps Pipeline on Vercel**

This document outlines the hosting, deployment, and Continuous Integration/Continuous Deployment (CI/CD) strategy for the HOMEase | AI platform. We will leverage Vercel as the hosting platform due to its first-class support for Next.js and GitHub Actions for our CI pipeline. This combination provides a robust, automated workflow from development to production, ensuring code quality and rapid iteration.

---

#### **1. Hosting Strategy: Vercel for Next.js**

Vercel is the creator of Next.js and is the optimal hosting platform for this project. It is designed to handle the specific needs of the Next.js App Router, including Server Components, Server Actions, and advanced caching strategies.

**Key Advantages:**

* **Seamless Integration:** Vercel automatically detects and optimizes Next.js projects with zero configuration.
* **Performance:** A global Edge Network serves static assets and caches function responses close to users, ensuring low latency worldwide.
* **Preview Deployments:** For every Git commit and pull request, Vercel generates a unique, shareable preview URL. This is invaluable for QA, stakeholder reviews, and collaborative development, effectively serving as an on-demand staging environment.
* **Scalability:** The serverless architecture scales automatically with traffic, eliminating the need for manual server management.
* **Integrated CI/CD:** Vercel's Git integration provides a powerful, out-of-the-box deployment pipeline that we will augment with GitHub Actions for quality assurance.

---

#### **2. Environment Strategy**

To ensure stability and data integrity, we will maintain distinct environments, each with its own dedicated Supabase project. This isolates production data from development and testing activities.

| Environment   | Purpose                                                                                                 | Supabase Project     | Git Branch (Typical) | Deployment Trigger                                     |
| :------------ | :------------------------------------------------------------------------------------------------------ | :------------------- | :------------------- | :----------------------------------------------------- |
| **Local**     | Individual developer machines for feature development and initial testing.                              | Dev Supabase Project | Feature branches     | `npm run dev`                                          |
| **Preview**   | Automatically generated for every Pull Request. Used for code reviews, QA, and end-to-end testing.      | Staging Supabase     | PR branches          | Push to a branch with an open Pull Request             |
| **Production**| The live application accessible to homeowners and contractors.                                          | Production Supabase  | `main`               | Merge/Push to the `main` branch                          |

**Supabase Project Setup:**

1. **Production Project:** Create a Supabase project for the live application. Choose a robust password and enable Point-in-Time Recovery (PITR) for backups.
2. **Staging/Dev Project:** Create a second Supabase project. This can be used for both local development and Vercel's Preview deployments. Its database schema should be kept in sync with production, but it will contain test data.

---

#### **3. Vercel Project and Environment Variable Configuration**

##### **3.1. Connecting GitHub to Vercel**

1. Sign up for a Vercel account using your GitHub credentials.
2. Click "Add New... > Project" from the Vercel dashboard.
3. Import the `homease-app` GitHub repository.
4. Vercel will automatically detect that it's a Next.js project. No changes are needed in the "Build & Development Settings".
5. Click "Deploy". The initial deployment will fail if environment variables are not yet configured, which we will do next.

##### **3.2. Securely Managing Environment Variables**

Sensitive credentials like Supabase keys must never be committed to Git. Vercel provides a secure system for managing them per environment.

1. Navigate to your new project in the Vercel dashboard.
2. Go to the **Settings** tab and select **Environment Variables**.
3. Add the following two variables:
    * `NEXT_PUBLIC_SUPABASE_URL`
    * `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. For each variable, add the corresponding values from your Supabase projects, making sure to assign them to the correct Vercel Environments:
    * **Production:** Use the keys from your **Production** Supabase project. Uncheck "Preview" and "Development".
    * **Preview (Staging):** Use the keys from your **Staging/Dev** Supabase project. Check only the "Preview" box.
    * **Development:** Use the same keys from your **Staging/Dev** Supabase project. Check only the "Development" box. This allows you to use `vercel env pull` to get these variables into your local `.env.local` file.

The final configuration in Vercel will look like this:

| Name                        | Production Value                            | Preview Value                               | Development Value                           |
| :-------------------------- | :------------------------------------------ | :------------------------------------------ | :------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`  | `https://<prod-ref>.supabase.co`            | `https://<staging-ref>.supabase.co`         | `https://<staging-ref>.supabase.co`         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ey...<prod_key>`                           | `ey...<staging_key>`                        | `ey...<staging_key>`                        |

This setup ensures that merging to `main` automatically connects the deployed app to the production database, while all pull requests are connected to the isolated staging database.

---

#### **4. CI/CD Pipeline with GitHub Actions**

While Vercel handles the deployment (CD), we will use GitHub Actions for Continuous Integration (CI). This pipeline will act as a quality gate, running checks on every pull request before it can be merged. This prevents bugs and ensures code consistency.

##### **4.1. GitHub Branch Protection**

To enforce this quality gate, we will configure a branch protection rule on the `main` branch in GitHub:

1. In your GitHub repo, go to **Settings > Branches**.
2. Add a rule for the `main` branch.
3. Enable **"Require status checks to pass before merging"**.
4. In the search box, find and select the name of the CI job we will create (e.g., `lint-and-test`).

This configuration will physically block the "Merge" button on a pull request until our GitHub Actions workflow has completed successfully.

##### **4.2. GitHub Actions Workflow File**

Create the following file in your repository: `.github/workflows/ci.yml`

```yaml
# .github/workflows/ci.yml

name: HOMEase CI Pipeline

on:
  # Trigger the workflow on pushes to the main branch
  push:
    branches:
      - main
  # Trigger the workflow on any pull request
  pull_request:
    branches:
      - main

jobs:
  lint-and-test:
    name: Lint and Test
    runs-on: ubuntu-latest

    steps:
      # 1. Check out the repository code
      - name: Checkout code
        uses: actions/checkout@v4

      # 2. Set up the Node.js environment
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20' # Specify your project's Node.js version
          cache: 'npm' # Enable caching for npm dependencies

      # 3. Install project dependencies
      - name: Install dependencies
        run: npm install

      # 4. Run ESLint to check for code style and quality issues
      - name: Run ESLint
        run: npm run lint
        
      # 5. Run automated tests (e.g., Jest, Vitest, Playwright)
      # This step assumes you have a `test` script in your package.json
      - name: Run tests
        run: npm run test

      # 6. Run a type check using the TypeScript compiler
      - name: Type check
        run: npm run build # The `next build` command includes a TypeScript check
```

**Explanation of the Workflow:**

* **`name`**: The display name of the workflow.
* **`on`**: Defines the triggers. This workflow runs for every push and pull request to the `main` branch.
* **`jobs`**: A workflow is made up of one or more jobs. We have a single job named `lint-and-test`.
* **`runs-on`**: Specifies the virtual machine environment to run the job on.
* **`steps`**:
    1. **Checkout code**: Downloads your repository code into the runner.
    2. **Setup Node.js**: Installs the specified version of Node.js and configures caching for `npm` to speed up subsequent runs.
    3. **Install dependencies**: Runs `npm install` to get all required packages.
    4. **Run ESLint**: Executes the `lint` script from `package.json` to enforce coding standards.
    5. **Run tests**: Executes the `test` script. This is where your unit and integration tests would run.
    6. **Type check**: Runs `npm run build`. The `next build` command inherently performs a TypeScript type check, which is a crucial step for catching type-related errors before deployment.

This completes the setup of a modern, secure, and automated DevOps pipeline. This process ensures that every change to the production application is automatically tested and validated, significantly improving platform stability and developer productivity.

**Metadata:**

```json
{
  "subtask_id": "deployment_devops",
  "title": "Deployment, Hosting, and DevOps Pipeline on Vercel",
  "expertise": "DevOps, CI/CD (GitHub Actions), Vercel Platform"
}
```

### Frontend Development (WebXR), Backend Development (Supabase Edge Functions), AI API Integration Specialist

### **Comprehensive Technical Architecture Plan: HOMEase | AI**

### **Subtask: AR Assessment Flow and AI Service Integration**

This document details the technical implementation of the core AR assessment feature. It outlines the end-to-end workflow, from the user capturing images in the browser to the orchestration of AI services via a Supabase Edge Function and the final persistence of results in the database. This approach prioritizes broad accessibility using WebXR and ensures a scalable, secure, and non-blocking user experience.

---

#### **1. High-Level Architectural Flow**

The process is designed to be asynchronous to provide a responsive user interface. The user initiates the process, and the heavy lifting (AI analysis) happens in the background. The frontend is notified of completion via Supabase's real-time capabilities.

1. **Capture & Upload (Frontend):** The homeowner uses a WebXR-enabled component in the Next.js app to capture images of a room. These images are uploaded directly to a private Supabase Storage bucket.
2. **Trigger Function (Frontend -> Edge Function):** Upon successful upload, the frontend invokes a Supabase Edge Function (`process-ar-assessment`), passing the storage paths of the new images and the associated `project_id`.
3. **Acknowledge & Delegate (Edge Function):** The `process-ar-assessment` function validates the request, creates an initial `ar_assessments` record with a `processing` status, and immediately returns a `202 Accepted` response. It then invokes a second, long-running Edge Function (`generate-ai-analysis`) without waiting for its completion.
4. **Orchestrate AI (Background Function):** The `generate-ai-analysis` function:
    a.  Generates secure, time-limited signed URLs for the uploaded images.
    b.  Calls the **Google Gemini API** with the image URLs and a specialized prompt to perform hazard analysis.
    c.  Calls the **Fal.ai API** with the original image URLs and Gemini's recommendations to generate "after" visualizations.
5. **Persist Results (Background Function -> Database):** The function gathers the results from both AI services and updates the corresponding `ar_assessments` record in the PostgreSQL database, changing its status to `completed`.
6. **Real-time Notification (Database -> Frontend):** The Next.js app, subscribed to changes on the `ar_assessments` table via Supabase Realtime, receives the updated record automatically and displays the full report to the homeowner.

---

#### **2. Frontend Implementation (Next.js & WebXR)**

The frontend is responsible for providing an intuitive capture experience.

* **Technology:**
  * **Framework:** Next.js 15 (App Router)
  * **3D/AR Library:** `@react-three/fiber` and `@react-three/xr` for building the WebXR experience. This provides a declarative, component-based way to manage the AR scene.
  * **State Management:** Zustand or React Context for managing the assessment state (upload progress, processing status).
  * **Supabase Client:** `@supabase/supabase-js` for storage uploads, function invocation, and real-time subscriptions.

* **User Flow & Component Logic (`ARAssessment.tsx`):**
    1. **Initialization:** The component requests camera access and initializes an AR session.
    2. **Guidance:** The UI overlays instructions, prompting the user to "Take a wide shot of the room," "Take a photo of the doorway," etc.
    3. **Capture:** On user tap, the component captures the current view from the camera feed and stores it as a `File` object in local state.
    4. **Submission:**
        * The user clicks "Analyze Room."
        * The component iterates through the captured `File` objects.
        * For each file, it calls `supabase.storage.from('assessment-media').upload(...)`. Files are uploaded to a path like `private/{homeowner_id}/{project_id}/{random_uuid()}.jpg`. The `private` bucket has strict RLS policies ensuring only the owner can write.
        * After all uploads are complete, it invokes the Edge Function:

            ```typescript
            const { data, error } = await supabase.functions.invoke('process-ar-assessment', {
              body: { 
                projectId: '...', 
                imagePaths: ['private/.../1.jpg', 'private/.../2.jpg'] 
              }
            });
            // UI now enters a "processing" state
            ```

    5. **Real-time Subscription:** The component uses a React hook to listen for database changes.

        ```typescript
        useEffect(() => {
          const channel = supabase
            .channel(`assessment-updates-${projectId}`)
            .on('postgres_changes', { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'ar_assessments', 
              filter: `project_id=eq.${projectId}` 
            }, (payload) => {
              // New data is in payload.new
              // Update UI from "processing" to show the results
              setAssessmentResults(payload.new);
            })
            .subscribe();
        
          return () => {
            supabase.removeChannel(channel);
          };
        }, [projectId]);
        ```

---

#### **3. Supabase Edge Function Implementation**

We use two Edge Functions to manage the asynchronous workflow effectively.

* **Location:** `supabase/functions/`
* **Environment Variables (Secrets):**
  * `GEMINI_API_KEY`: Your Google AI Studio API key.
  * `FAL_API_SECRET`: Your Fal.ai API key/secret.
  * `SUPABASE_SERVICE_ROLE_KEY`: Required for the background function to bypass RLS when updating the database.

##### **3.1. `process-ar-assessment` (The Initiator)**

This function is the public-facing endpoint. It's designed to be fast and responsive.

* **File:** `supabase/functions/process-ar-assessment/index.ts`
* **Purpose:** Validate the request, create a placeholder record, and trigger the background worker.

```typescript
// supabase/functions/process-ar-assessment/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // 1. Create Supabase client with user's auth context
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  // 2. Get user and validate payload
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { projectId, imagePaths } = await req.json();
  if (!projectId || !imagePaths) return new Response('Missing parameters', { status: 400 });
  
  // TODO: Add logic to verify user owns the project

  // 3. Create a placeholder assessment record
  const { data: assessment, error: insertError } = await supabaseClient
    .from('ar_assessments')
    .insert({ project_id: projectId, status: 'processing' }) // Assuming a 'status' column
    .select('id')
    .single();

  if (insertError) {
    console.error(insertError);
    return new Response('Failed to create assessment job', { status: 500 });
  }

  // 4. Invoke the background worker function without waiting
  await supabaseClient.functions.invoke('generate-ai-analysis', {
    body: { assessmentId: assessment.id, imagePaths },
    // This is the key for async invocation
    invokeOptions: { noWait: true } 
  });

  // 5. Return immediate success response
  return new Response(JSON.stringify({ assessmentId: assessment.id, message: 'Analysis started' }), {
    headers: { 'Content-Type': 'application/json' },
    status: 202,
  });
})
```

##### **3.2. `generate-ai-analysis` (The Worker)**

This function performs the long-running AI tasks. It uses the `SERVICE_ROLE_KEY` to have administrative access to the database and storage.

* **File:** `supabase/functions/generate-ai-analysis/index.ts`
* **Purpose:** Orchestrate calls to Gemini and Fal.ai, then update the database.

```typescript
// supabase/functions/generate-ai-analysis/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Prompt Engineering for Gemini
const GEMINI_PROMPT = `
  You are an expert Certified Aging-in-Place Specialist (CAPS). Analyze the following home images for accessibility hazards for seniors.
  Based ONLY on the visual information, identify specific issues and provide actionable recommendations.
  Your response MUST be in a valid JSON format with the following structure:
  {
    "accessibility_score": <An integer between 0 and 100, where 100 is perfectly accessible>,
    "identified_hazards": [ { "hazard": "Brief name of hazard", "details": "Description of the issue and why it's a risk", "area": "e.g., Doorway, Floor, Shower" } ],
    "recommendations": [ { "recommendation": "Brief name of solution", "details": "Description of the modification to fix a hazard" } ]
  }
`;

serve(async (req) => {
  // 1. Use the Service Role client for elevated privileges
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { assessmentId, imagePaths } = await req.json();

  try {
    // 2. Generate signed URLs for the AI services to access the images
    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from('assessment-media')
      .createSignedUrls(imagePaths, 3600); // Expires in 1 hour
    if (urlError) throw urlError;

    const imageUrls = signedUrlData.map(item => item.signedUrl);

    // 3. Call Google Gemini API
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: GEMINI_PROMPT },
            ...imageUrls.map(url => ({ inline_data: { mime_type: "image/jpeg", data: btoa(await (await fetch(url)).arrayBuffer()) } }))
          ]
        }]
      })
    });
    const geminiJson = await geminiRes.json();
    const geminiAnalysis = JSON.parse(geminiJson.candidates[0].content.parts[0].text);

    // 4. Call Fal.ai API for visualization (example for one recommendation)
    let visualizationUrls = [];
    if (geminiAnalysis.recommendations && geminiAnalysis.recommendations.length > 0) {
      const firstRecommendation = geminiAnalysis.recommendations[0].details;
      const falRes = await fetch('https://fal.run/fal-ai/fast-sdxl', {
        method: 'POST',
        headers: { 
          'Authorization': `Key ${Deno.env.get('FAL_API_SECRET')}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          image_url: imageUrls[0], // Use the first image as base
          prompt: `A photo of a bathroom with this modification: "${firstRecommendation}"`,
        })
      });
      const falJson = await falRes.json();
      if (falJson.images && falJson.images[0]) {
        visualizationUrls.push(falJson.images[0].url);
      }
    }

    // 5. Update the database record with the results
    const { error: updateError } = await supabaseAdmin
      .from('ar_assessments')
      .update({
        status: 'completed',
        accessibility_score: geminiAnalysis.accessibility_score,
        identified_hazards: geminiAnalysis.identified_hazards,
        recommendations: geminiAnalysis.recommendations,
        gemini_analysis_raw: geminiJson, // Store the full raw response
        fal_ai_visualization_urls: visualizationUrls,
      })
      .eq('id', assessmentId);

    if (updateError) throw updateError;

    return new Response('OK', { status: 200 });

  } catch (error) {
    // Error handling: Update the record to a 'failed' state
    await supabaseAdmin.from('ar_assessments').update({ status: 'failed', error_message: error.message }).eq('id', assessmentId);
    console.error('AI Analysis Failed:', error);
    return new Response(error.message, { status: 500 });
  }
});
```

This robust, asynchronous architecture provides a seamless user experience for the technologically intensive AR assessment feature, forming the innovative core of the HOMEase | AI platform.

**Metadata:**

```json
{
  "subtask_id": "ar_ai_integration",
  "title": "AR Assessment Flow and AI Service Integration",
  "expertise": "Frontend Development (WebXR), Backend Development (Supabase Edge Functions), AI API Integration"
}
```

### Backend Development (Supabase Edge Functions, PostgreSQL) Specialist

### **Comprehensive Technical Architecture Plan: HOMEase | AI**

### **Subtask: Asynchronous Lead Generation and Contractor Matching**

This document outlines the architecture for converting a completed AR assessment into a live lead and asynchronously matching it with qualified contractors. This process leverages a Supabase Database Webhook (via a PostgreSQL trigger for reliability) to invoke an Edge Function, ensuring the user interface remains responsive while complex matching logic is executed in the background. The core of the matching algorithm relies on Supabase's PostGIS capabilities for efficient geospatial querying.

---

#### **1. High-Level Architectural Flow**

The workflow begins after the homeowner has reviewed their AI-generated assessment report. The system is designed to decouple the lead submission from the computationally intensive matching process.

1. **Lead Submission (Frontend):** The homeowner reviews their AR assessment results, provides additional details (urgency, budget), and clicks "Find Contractors." The Next.js app sends an `UPDATE` request to the `projects` table for the specific `project_id`, changing its `status` to `lead_submitted`.
2. **Database Trigger (PostgreSQL):** A custom PostgreSQL trigger on the `projects` table detects the status change to `lead_submitted`. Instead of a simple webhook, this trigger function selectively calls `pg_net` to invoke a secure webhook URL, ensuring the matching process only runs when this specific condition is met.
3. **Webhook & Function Invocation (Supabase):** The `pg_net` request triggers the Supabase Edge Function (`match-contractors`), passing the entire updated project record as the payload.
4. **Asynchronous Matching (Edge Function):** The `match-contractors` function executes the core matching logic:
    a.  **Geospatial Query:** It uses PostGIS to find all `contractor_profiles` whose `service_area` (a polygon) contains the project's `location` (a point).
    b.  **Skills & Certification Query:** It further filters these contractors based on skills derived from the AR assessment recommendations and checks for `caps_certified` status.
    c.  **Availability Check:** It ensures matched contractors are marked as `is_available` and `is_verified`.
5. **Persist Matches (Edge Function -> Database):** The function inserts a record into the `project_contractor_matches` table for each suitable contractor found.
6. **Real-time Notification (Database -> Frontend):** The homeowner's dashboard, subscribed to real-time changes on the `project_contractor_matches` table, automatically updates to display the profiles of the matched contractors as they are added, creating a seamless and dynamic user experience.

---

#### **2. Database Schema & Setup**

To support this workflow, we will extend the database schema. The use of the `postgis` extension is critical.

**Enable PostGIS Extension (Run once in Supabase SQL Editor):**

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

**Table Definitions:**

```sql
-- Projects Table (Extended)
ALTER TABLE projects
ADD COLUMN status TEXT NOT NULL DEFAULT 'assessment_complete',
ADD COLUMN urgency TEXT, -- e.g., 'low', 'medium', 'high'
ADD COLUMN budget_range NUMRANGE, -- e.g., '[5000, 10000)'
ADD COLUMN location GEOMETRY(Point, 4326); -- Stores project's lat/lon

-- Contractor Profiles Table
CREATE TABLE contractor_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_available BOOLEAN DEFAULT TRUE,
  caps_certified BOOLEAN DEFAULT FALSE,
  service_area GEOMETRY(Polygon, 4326), -- Defines the contractor's service area
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
-- Create a geospatial index for fast location queries
CREATE INDEX idx_contractor_service_area ON contractor_profiles USING GIST (service_area);

-- Skills & Join Table
CREATE TABLE skills (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL -- e.g., 'Walk-in Shower Conversion', 'Ramp Installation'
);

CREATE TABLE contractor_skills (
  contractor_id UUID REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  skill_id INT REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (contractor_id, skill_id)
);

-- Project-Contractor Matches Table (The result of the process)
CREATE TABLE project_contractor_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'matched', -- 'matched', 'contacted', 'hired'
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, contractor_id)
);

-- Enable Realtime on the matches table
ALTER TABLE project_contractor_matches REPLICA IDENTITY FULL;
-- Send realtime messages for inserts
ALTER PUBLICATION supabase_realtime ADD TABLE project_contractor_matches;
```

---

#### **3. Backend: Trigger-based Webhook**

Using a PostgreSQL trigger is more robust than a simple table webhook because it allows for conditional logic within the database.

**Step 1: Create the Trigger Function**
This function checks if the project's status is being updated to `lead_submitted`.

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_create_matching_trigger.sql

-- Create the function that will be called by the trigger
CREATE OR REPLACE FUNCTION trigger_contractor_matching()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT := 'https://<project_ref>.supabase.co/functions/v1/match-contractors';
  -- Store the secret in Supabase Vault and retrieve it
  secret TEXT := secrets.get('WEBHOOK_SECRET');
BEGIN
  -- Only proceed if the status is newly set to 'lead_submitted'
  IF NEW.status = 'lead_submitted' AND OLD.status != 'lead_submitted' THEN
    -- Perform an HTTP POST request to the Edge Function
    PERFORM net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || secret
      ),
      body := row_to_json(NEW)::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the 'projects' table
CREATE TRIGGER on_project_submit_lead
AFTER UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION trigger_contractor_matching();
```

*Note: You must store your `WEBHOOK_SECRET` in the Supabase Vault for this to work securely.*

---

#### **4. Backend: `match-contractors` Edge Function**

This function contains the core business logic for finding suitable contractors.

* **File:** `supabase/functions/match-contractors/index.ts`
* **Environment Variables (Secrets):**
  * `SUPABASE_SERVICE_ROLE_KEY`: To allow the function to perform admin-level database operations.
  * `WEBHOOK_SECRET`: The shared secret to authorize requests from the database trigger.

```typescript
// supabase/functions/match-contractors/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Helper function to extract potential skills from AR recommendations
function extractSkillsFromProject(recommendations: any[]): string[] {
  // This is a simplified example. A real implementation would use NLP
  // or a more robust keyword mapping system.
  const skillKeywords = ['ramp', 'grab bar', 'walk-in shower', 'doorway widening'];
  const requiredSkills = new Set<string>();
  
  recommendations.forEach(rec => {
    const detail = rec.details.toLowerCase();
    skillKeywords.forEach(keyword => {
      if (detail.includes(keyword)) {
        // Map keyword to the canonical skill name in the 'skills' table
        if (keyword === 'walk-in shower') requiredSkills.add('Walk-in Shower Conversion');
        if (keyword === 'ramp') requiredSkills.add('Ramp Installation');
      }
    });
  });

  return Array.from(requiredSkills);
}

serve(async (req) => {
  // 1. Security: Verify the authorization header
  const authHeader = req.headers.get('Authorization');
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  if (!authHeader || authHeader !== `Bearer ${webhookSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Initialize Admin Client and parse payload
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const project = await req.json();

  try {
    // 3. Get AR assessment details to determine required skills
    const { data: assessment, error: assessmentError } = await supabaseAdmin
      .from('ar_assessments')
      .select('recommendations')
      .eq('project_id', project.id)
      .single();

    if (assessmentError || !assessment) throw new Error(`Assessment not found for project ${project.id}`);

    const requiredSkills = extractSkillsFromProject(assessment.recommendations);

    // 4. Find matching contractors using an RPC function for complexity
    // It's best practice to define complex SQL logic in a Postgres function.
    const { data: matchedContractors, error: matchError } = await supabaseAdmin
      .rpc('find_matching_contractors', {
        project_location: project.location, // The GEOMETRY(Point) data
        required_skills: requiredSkills,
        limit_count: 5 // Find the top 5 matches
      });

    if (matchError) throw matchError;

    // 5. Insert the matches into the join table
    if (matchedContractors && matchedContractors.length > 0) {
      const matchesToInsert = matchedContractors.map(contractor => ({
        project_id: project.id,
        contractor_id: contractor.id,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('project_contractor_matches')
        .insert(matchesToInsert);

      if (insertError) throw insertError;
    }
    
    return new Response(JSON.stringify({ message: `Found ${matchedContractors.length} matches.` }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Contractor Matching Failed:', error);
    // Optionally, update the project status to 'matching_failed'
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
```

#### **5. Backend: `find_matching_contractors` PostgreSQL Function**

Encapsulating the complex query in a database function (RPC) is cleaner and more performant.

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_create_rpc_find_matches.sql

CREATE OR REPLACE FUNCTION find_matching_contractors(
  project_location GEOMETRY,
  required_skills TEXT[],
  limit_count INT
)
RETURNS TABLE (id UUID, company_name TEXT, caps_certified BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id,
    cp.company_name,
    cp.caps_certified
  FROM
    contractor_profiles AS cp
  -- Join to check skills
  JOIN (
    SELECT cs.contractor_id
    FROM contractor_skills cs
    JOIN skills s ON cs.skill_id = s.id
    WHERE s.name = ANY(required_skills)
    GROUP BY cs.contractor_id
    -- Ensure contractor has ALL required skills
    HAVING COUNT(DISTINCT s.id) = array_length(required_skills, 1)
  ) AS skilled_contractors ON cp.id = skilled_contractors.contractor_id
  WHERE
    -- Core Geospatial Query: Check if the project point is within the contractor's service area polygon
    ST_Contains(cp.service_area, project_location)
    AND cp.is_verified = TRUE
    AND cp.is_available = TRUE
  ORDER BY
    -- Prioritize CAPS certified contractors
    cp.caps_certified DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
```

This asynchronous, database-driven architecture provides a robust and scalable foundation for the core lead-matching functionality of the HOMEase | AI platform. It efficiently handles complex geospatial and skills-based queries without compromising the frontend user experience.

**Metadata:**

```json
{
  "subtask_id": "lead_matching",
  "title": "Asynchronous Lead Generation and Contractor Matching",
  "expertise": "Backend Development (Supabase Edge Functions, PostgreSQL)"
}
```

### Frontend Development (Next.js), UI/UX Design Specialist

### **Comprehensive Technical Architecture Plan: HOMEase | AI**

### **Subtask: Homeowner and Contractor Dashboards Development**

This document details the architecture and development plan for the user-facing dashboards for both homeowners and contractors. These dashboards are the primary interfaces for users to manage their projects, leads, and communications on the HOMEase platform. The architecture leverages Next.js App Router for a modern, server-centric approach and Supabase for authentication, database, real-time capabilities, and storage.

---

#### **1. High-Level Dashboard Architecture**

The dashboards will be built as secure, role-based sections within the Next.js application. A unified authentication flow will direct users to the appropriate dashboard based on their role, which is managed via custom claims or a separate `profiles` table in Supabase.

* **Routing:** The Next.js App Router will be used to create protected route groups.
  * `/dashboard/homeowner`: For homeowner-specific views.
  * `/dashboard/contractor`: For contractor-specific views.
* **Authentication & Authorization:**
  * A top-level `middleware.ts` file will protect all `/dashboard/*` routes, redirecting unauthenticated users to the login page.
  * A shared layout (`/dashboard/layout.tsx`) will fetch the user's session and role on the server, providing this data via context to client components or directly to child server components.
* **Component Strategy:**
  * **Server Components:** Used for fetching initial data, rendering static layouts, and ensuring security. This is the default for displaying project lists, profile information, etc.
  * **Client Components (`'use client'`):** Used for all interactive elements, including forms, real-time chat, the dynamic scope builder, and map interfaces.

---

#### **2. Database Schema Extensions**

Building upon the schema from the `lead_matching` task, we need additional tables to manage proposals, communication, and more detailed profiles.

```sql
-- Profiles Table (To store role and common user info)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  -- 'homeowner' or 'contractor'
  role TEXT NOT NULL
);

-- Function to create a profile for a new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'role' -- Role is passed during sign-up
  );
  -- If the user is a contractor, create a contractor_profile entry
  IF new.raw_user_meta_data->>'role' = 'contractor' THEN
    INSERT INTO public.contractor_profiles (id) VALUES (new.id);
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run the function on user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Extend Projects Table for more detailed status
ALTER TABLE projects
ADD COLUMN homeowner_id UUID REFERENCES auth.users(id);

-- Add a more granular status enum for projects
CREATE TYPE project_status AS ENUM (
  'draft',
  'assessment_complete',
  'lead_submitted',
  'matching_complete',
  'proposals_received',
  'proposal_accepted',
  'in_progress',
  'completed',
  'cancelled'
);
ALTER TABLE projects
ALTER COLUMN status SET DATA TYPE project_status USING status::project_status;


-- Proposals Table
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  scope_details JSONB, -- Stores the itemized list from the Dynamic Scope Builder
  total_price NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, contractor_id)
);
ALTER TABLE proposals REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE proposals;


-- Messages Table (for real-time chat)
CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

---

#### **3. Homeowner Dashboard (`/dashboard/homeowner`)**

This dashboard empowers homeowners to track their project from assessment to completion.

**Key Components & Pages:**

1. **Main View (`/dashboard/homeowner`)**:
    * **Implementation:** A Server Component that fetches all projects linked to the current `homeowner_id`.
    * **UI:** Displays a list of `ProjectCard` components. Each card shows the project name (e.g., "Master Bathroom"), a summary of the AR assessment score, the current `status`, and a link to the detail page.

2. **Project Detail View (`/dashboard/homeowner/projects/[projectId]`)**:
    * **Implementation:** A dynamic route page that fetches all data related to a specific project: `projects`, `ar_assessments`, `project_contractor_matches`, and `proposals`.
    * **Features:**
        * **Status Tracker:** A visual timeline component showing the current `project_status`.
        * **Matched Contractors:** A section that displays profiles of matched contractors. This section can be a Client Component that subscribes to real-time inserts on the `project_contractor_matches` table, showing a "Finding contractors..." message and then populating the list as matches are found.
        * **Proposals Section:** Lists incoming proposals. The homeowner can view details (including the itemized scope from the `scope_details` JSONB) and has "Accept" or "Decline" buttons. Accepting a proposal would trigger a Server Action to update the `proposals` and `projects` table statuses.
        * **Messaging Interface:** Once a proposal is accepted, a chat window becomes active. This is a Client Component that:
            * Subscribes to the `messages` table filtered by `project_id`.
            * Displays messages in real-time.
            * Uses a Server Action to insert new messages into the database.
        * **Payment Management:** Integrates with Stripe. After accepting a proposal, a "Proceed to Payment" button appears. This button calls a Server Action that creates a Stripe Checkout session and redirects the user to Stripe's hosted payment page.

**Code Snippet: Real-time Matched Contractors (Client Component)**

```typescript
// app/dashboard/homeowner/projects/[projectId]/components/MatchedContractors.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function MatchedContractors({ projectId, initialMatches }) {
  const supabase = createClientComponentClient();
  const [matches, setMatches] = useState(initialMatches);

  useEffect(() => {
    const channel = supabase
      .channel(`realtime-matches:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_contractor_matches',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          // Fetch the full contractor profile for the new match
          // and add it to the state.
          const newMatch = payload.new;
          // In a real app, you'd fetch contractor details here.
          setMatches((currentMatches) => [...currentMatches, newMatch]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, projectId]);

  return (
    <div>
      <h3>Matched Contractors</h3>
      {matches.length === 0 && <p>Searching for qualified local contractors...</p>}
      {/* Render list of matched contractor profiles */}
    </div>
  );
}
```

---

#### **4. Contractor Dashboard (`/dashboard/contractor`)**

This dashboard is the contractor's mission control for managing their business on the platform.

**Key Components & Pages:**

1. **Profile Management (`/dashboard/contractor/profile`)**:
    * **Implementation:** A page with a Client Component form that submits to a Server Action.
    * **UI:**
        * Standard form fields for `company_name`, bio, etc.
        * A file upload input for a profile picture, which uploads directly to Supabase Storage.
        * Checkboxes for `caps_certified` and a multi-select for `skills`.
        * **Service Area Map:** An interactive map (using `react-leaflet`) where the contractor can draw a polygon defining their service area. The component's state holds the polygon's coordinates, which are converted to GeoJSON and sent to the Server Action to be saved in the `service_area` PostGIS column.

2. **Lead Management (`/dashboard/contractor/leads`)**:
    * **Implementation:** A Server Component that fetches all records from `project_contractor_matches` where `contractor_id` matches the current user. It joins with the `projects` and `ar_assessments` tables to get lead details.
    * **UI:** A list or board view (e.g., New, Proposed, Won) of leads. Each lead card shows the project type, location, and urgency, with a button to "View Details & Create Proposal."

3. **Dynamic Scope Builder (`/dashboard/contractor/leads/[projectId]`)**:
    * **Implementation:** This is the core feature for contractors. It's a Client Component that receives the AR assessment data as a prop.
    * **Workflow:**
        1. **Display Recommendations:** The component parses the `recommendations` JSON from the `ar_assessments` table and displays each item (e.g., "Doorway is too narrow," "No grab bars in shower").
        2. **Itemize Scope:** For each recommendation, the contractor can click "Add to Scope." This adds the item to a list of line items.
        3. **Add Custom Items:** An "Add Custom Item" button allows the contractor to add services not identified by the AI.
        4. **Pricing:** Each line item has an input field for its cost. The component calculates the subtotal, taxes, and total in real-time.
        5. **Submission:** The final scope (an array of objects with `description` and `price`) and the `total_price` are submitted via a Server Action, which creates a new record in the `proposals` table.

**Code Snippet: Server Action for Proposal Submission**

```typescript
// app/dashboard/contractor/leads/[projectId]/actions.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function submitProposal(formData: FormData) {
  const supabase = createServerActionClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const scopeDetails = JSON.parse(formData.get('scopeDetails') as string);
  const totalPrice = formData.get('totalPrice') as string;
  const projectId = formData.get('projectId') as string;

  const { error } = await supabase.from('proposals').insert({
    project_id: projectId,
    contractor_id: user.id,
    scope_details: scopeDetails,
    total_price: parseFloat(totalPrice),
    status: 'pending',
  });

  if (error) {
    return { error: 'Failed to submit proposal.' };
  }

  // Revalidate the page to show the new proposal status
  revalidatePath(`/dashboard/contractor/leads/${projectId}`);
  return { success: true };
}
```

This comprehensive dashboard structure provides a robust, interactive, and secure experience for both homeowners and contractors, forming the core user-facing functionality of the HOMEase | AI platform.

**Metadata:**

```json
{
  "subtask_id": "user_dashboards",
  "title": "Homeowner and Contractor Dashboards Development",
  "expertise": "Frontend Development (Next.js), UI/UX Design"
}
```

### Frontend Development (Next.js), Backend Development (Supabase Realtime) Specialist

### **Comprehensive Technical Architecture Plan: HOMEase | AI**

### **Subtask: Real-time Messaging System**

This document outlines the technical architecture for implementing a secure, real-time messaging system between homeowners and contractors within the HOMEase platform. The solution is built entirely on Supabase, leveraging its Realtime, Presence, and Row Level Security (RLS) features to provide an instant and secure communication channel.

---

#### **1. Overview & Core Features**

The messaging system is a critical component for facilitating communication after a homeowner accepts a contractor's proposal. The primary goals are:

* **Instant Communication:** Messages should appear in the UI of both participants in real-time without needing a page refresh.
* **Persistence:** All conversations must be securely stored in the database for historical reference.
* **Security & Privacy:** A user must only be able to access conversations they are a part of. This will be enforced at the database level using RLS.
* **User Experience:** Provide modern chat features like online status indicators ("Presence") and typing notifications.

The system will use a dedicated communication channel for each project, ensuring conversations are properly scoped and isolated.

---

#### **2. Database Schema & Security**

We will use the `messages` table defined in the previous task. We will also create a helper function to simplify our security policies.

**2.1. Messages Table Schema**

This schema is designed to store all message content and metadata required for filtering and security.

```sql
-- From the previous 'user_dashboards' task
CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- receiver_id is useful but can be derived if needed. We'll keep it for simplicity.
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Optional: read_at timestamp for read receipts
  read_at TIMESTAMPTZ
);

-- Enable Realtime for the messages table
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Create an index for efficient message retrieval per project
CREATE INDEX idx_messages_project_id ON messages(project_id, created_at DESC);
```

**2.2. SQL Helper Function for Security**

To make RLS policies clean and maintainable, we'll create a function that checks if a given user is a valid participant (homeowner or accepted contractor) for a specific project.

```sql
CREATE OR REPLACE FUNCTION is_project_participant(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_participant BOOLEAN;
BEGIN
  SELECT EXISTS (
    -- Check if the user is the homeowner of the project
    SELECT 1 FROM projects WHERE id = p_project_id AND homeowner_id = p_user_id
    UNION ALL
    -- Check if the user is the contractor with an accepted proposal for the project
    SELECT 1 FROM proposals WHERE project_id = p_project_id AND contractor_id = p_user_id AND status = 'accepted'
  ) INTO is_participant;
  RETURN is_participant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**2.3. Row Level Security (RLS) Policies**

RLS is the cornerstone of our security model, ensuring data access is enforced directly by the database.

```sql
-- 1. Enable RLS on the messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 2. POLICY: Allow participants to READ messages for their projects
CREATE POLICY "Allow participants to read messages"
ON messages FOR SELECT
USING ( is_project_participant(project_id, auth.uid()) );

-- 3. POLICY: Allow participants to INSERT messages for their projects
CREATE POLICY "Allow participants to send messages"
ON messages FOR INSERT
WITH CHECK (
  is_project_participant(project_id, auth.uid()) AND
  sender_id = auth.uid() -- Ensure users can only send messages as themselves
);

-- 4. POLICY: Deny updates and deletes to maintain conversation integrity
CREATE POLICY "Deny message updates"
ON messages FOR UPDATE
USING ( false ); -- Disallow anyone from updating messages

CREATE POLICY "Deny message deletes"
ON messages FOR DELETE
USING ( false ); -- Disallow anyone from deleting messages
```

---

#### **3. Real-time Implementation Strategy**

We will use three distinct features of Supabase Realtime, all operating on a single channel scoped to the project ID (e.g., `realtime:project:123-abc`).

1. **Postgres Changes (Message Syncing):** This is the primary mechanism for receiving new messages. The frontend will subscribe to `INSERT` events on the `messages` table, filtered by the current `project_id`. This is highly reliable as it's tied directly to database commits.

2. **Presence (Online Status):** This feature tracks which users are currently subscribed to the channel. We will use it to display a "● Online" or "● Offline" indicator next to the user's name in the chat header. The client will call `channel.track()` upon joining to announce its presence.

3. **Broadcast (Typing Indicators):** This is for sending ephemeral, "fire-and-forget" events that don't need to be stored. When a user starts typing, the client will broadcast a `typing` event. Other clients listening on the channel will receive this event and can display a "User is typing..." indicator for a few seconds.

---

#### **4. Frontend Component Architecture (Next.js)**

The chat interface will be a client component (`'use client'`) that encapsulates all the logic for fetching, sending, and subscribing to real-time events.

**File:** `app/components/messaging/ChatWindow.tsx`

```typescript
'use client';

import { useEffect, useState, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { User } from '@supabase/supabase-js';

// Define types for clarity
type Message = {
  id: number;
  content: string;
  sender_id: string;
  created_at: string;
};

type ChatWindowProps = {
  projectId: string;
  currentUser: User;
  otherParticipant: { id: string; fullName: string };
};

export default function ChatWindow({ projectId, currentUser, otherParticipant }: ChatWindowProps) {
  const supabase = createClientComponentClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  const channelRef = useRef<any>(null); // To hold the channel instance

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data);
      }
    };
    fetchMessages();
  }, [projectId, supabase]);

  // Setup all real-time subscriptions
  useEffect(() => {
    const channel = supabase.channel(`project-chat:${projectId}`, {
      config: {
        presence: { key: currentUser.id }, // Track presence using user ID
      },
    });

    // 1. Subscribe to new messages (Postgres Changes)
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `project_id=eq.${projectId}` },
      (payload) => {
        setMessages((currentMessages) => [...currentMessages, payload.new as Message]);
      }
    );

    // 2. Subscribe to Presence events
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      const otherUserKey = otherParticipant.id;
      setIsOtherUserOnline(!!presenceState[otherUserKey]);
    });

    // 3. Subscribe to Broadcast events (Typing)
    channel.on('broadcast', { event: 'typing' }, (payload) => {
      if (payload.senderId !== currentUser.id) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 2000); // Hide indicator after 2s
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Announce presence once subscribed
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

    channelRef.current = channel;

    // Cleanup on component unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [projectId, currentUser.id, otherParticipant.id, supabase]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;

    await supabase.from('messages').insert({
      project_id: projectId,
      sender_id: currentUser.id,
      receiver_id: otherParticipant.id,
      content: newMessage.trim(),
    });

    setNewMessage('');
  };

  const handleTyping = () => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { senderId: currentUser.id },
      });
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h4>{otherParticipant.fullName}</h4>
        <span className={isOtherUserOnline ? 'online' : 'offline'}>
          ● {isOtherUserOnline ? 'Online' : 'Offline'}
        </span>
      </div>
      <div className="message-list">
        {messages.map((msg) => (
          <div key={msg.id} className={msg.sender_id === currentUser.id ? 'my-message' : 'other-message'}>
            <p>{msg.content}</p>
          </div>
        ))}
        {isTyping && <div className="typing-indicator">...</div>}
      </div>
      <form onSubmit={handleSendMessage} className="message-input-form">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            handleTyping();
          }}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

This architecture provides a complete, secure, and feature-rich real-time messaging system using the full power of the Supabase stack, integrating seamlessly into the Next.js application.

**Metadata:**

```json
{
  "subtask_id": "realtime_messaging",
  "title": "Real-time Messaging System",
  "expertise": "Frontend Development (Next.js), Backend Development (Supabase Realtime)"
}
```

### Backend Development (Stripe Integration, Supabase Edge Functions), Frontend Development Specialist

### **Comprehensive Technical Architecture Plan: HOMEase | AI**

### **Subtask: Payment Integration and Administrative Dashboard**

This document outlines the architecture for integrating a robust payment system using Stripe and developing a secure administrative dashboard for platform management. This plan replaces the original GCP/Firebase components with a Supabase-centric stack, leveraging Stripe Connect for multi-party payments and Supabase Edge Functions for reliable, real-time event handling.

---

#### **1. High-Level Architecture for Payments & Administration**

The payment and admin systems are designed to be secure, scalable, and decoupled from the main user-facing application logic.

* **Payment Flow:** The system uses **Stripe Connect Express** for contractor onboarding and payouts, and **Stripe Checkout** for homeowner payments. This creates a three-party transaction model: Homeowner -> Stripe -> (Platform Fee + Contractor Payout).
* **Webhook Handling:** A Supabase Edge Function provides a secure endpoint to receive Stripe webhooks. This is the source of truth for payment-related events, ensuring the HOMEase database is always synchronized with Stripe's transaction states.
* **Admin Dashboard:** A separate, role-protected area within the Next.js application, located at the `/admin` route. It will use Server Components for data display and Server Actions for performing administrative tasks, ensuring all sensitive operations happen on the server.

---

#### **2. Database Schema Extensions**

To support payments and administration, we will extend the existing schema.

```sql
-- Add Stripe Connect ID and verification status to contractor profiles
ALTER TABLE contractor_profiles
ADD COLUMN stripe_connect_id TEXT UNIQUE,
ADD COLUMN stripe_onboarding_complete BOOLEAN DEFAULT FALSE;

-- Add admin role to the profiles table
-- We can enforce this with a check constraint
ALTER TABLE profiles
ADD COLUMN role TEXT NOT NULL DEFAULT 'homeowner' CHECK (role IN ('homeowner', 'contractor', 'admin'));

-- Create a new table to track all financial transactions
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    homeowner_id UUID NOT NULL REFERENCES auth.users(id),
    contractor_id UUID NOT NULL REFERENCES auth.users(id),
    stripe_charge_id TEXT UNIQUE NOT NULL, -- From Stripe's charge object
    amount_total NUMERIC(10, 2) NOT NULL, -- Total amount paid by homeowner
    platform_fee NUMERIC(10, 2) NOT NULL, -- The fee HOMEase collected
    amount_paid_to_contractor NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL, -- e.g., 'succeeded', 'pending', 'failed'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update the project status enum to include payment-related states
ALTER TYPE project_status RENAME TO project_status_old;
CREATE TYPE project_status AS ENUM (
  'draft',
  'assessment_complete',
  'lead_submitted',
  'matching_complete',
  'proposals_received',
  'proposal_accepted',
  'awaiting_payment', -- New status after proposal is accepted
  'payment_complete', -- New status after successful payment
  'in_progress',
  'completed',
  'cancelled'
);
ALTER TABLE projects ALTER COLUMN status TYPE project_status USING status::text::project_status;
DROP TYPE project_status_old;
```

---

#### **3. Stripe Integration: Onboarding and Payments**

##### **3.1. Contractor Onboarding (Stripe Connect Express)**

This flow allows contractors to securely provide their identity and banking information to Stripe to receive payouts.

1. **Initiate Onboarding:** In the contractor dashboard (`/dashboard/contractor/profile`), a "Setup Payouts" button is displayed if `stripe_onboarding_complete` is false.
2. **Server Action:** Clicking the button triggers a Next.js Server Action (`createConnectAccount`).
    * It checks if a `stripe_connect_id` already exists for the contractor.
    * If not, it calls the Stripe API (`stripe.accounts.create`) with `type: 'express'`.
    * It saves the new `stripe_connect_id` to the `contractor_profiles` table.
    * It then calls `stripe.accountLinks.create` to generate a unique, short-lived onboarding URL.
    * The Server Action returns this URL to the client.
3. **Redirect to Stripe:** The client-side component receives the URL and redirects the contractor to Stripe's co-branded Express onboarding flow.
4. **Return to Platform:** After completing the flow, Stripe redirects the contractor back to a specified `return_url` (e.g., `/dashboard/contractor/profile?onboarding=complete`).
5. **Webhook Verification:** Stripe sends an `account.updated` webhook to our Supabase Edge Function. The function inspects the `charges_enabled` and `payouts_enabled` fields on the account object. If true, it updates the `stripe_onboarding_complete` flag to `true` in the `contractor_profiles` table.

##### **3.2. Homeowner Payment (Stripe Checkout)**

This flow occurs after a homeowner accepts a contractor's proposal.

1. **Initiate Payment:** The project status moves to `awaiting_payment`. A "Pay for Project" button appears on the homeowner's project detail page.
2. **Server Action:** Clicking the button calls a Server Action (`createCheckoutSession`).
    * The action retrieves the project total from the `proposals` table.
    * It calculates the `application_fee_amount` based on HOMEase's business logic.
    * It calls `stripe.checkout.sessions.create` with the following key parameters:
        * `line_items`: The project total.
        * `payment_intent_data[application_fee_amount]`: The calculated platform fee.
        * `payment_intent_data[transfer_data][destination]`: The contractor's `stripe_connect_id`.
        * `success_url` and `cancel_url`.
        * `metadata`: Includes `project_id`, `homeowner_id`, and `contractor_id` for tracking.
    * The Server Action returns the Checkout session ID.
3. **Redirect to Checkout:** The client uses the Stripe.js library to redirect the homeowner to the secure Stripe Checkout page using the session ID.
4. **Webhook Confirmation:** Upon successful payment, Stripe sends a `checkout.session.completed` webhook. The Edge Function handles this event to finalize the transaction in the database (see section 4).

---

#### **4. Webhook Handling with Supabase Edge Functions**

A single, robust Edge Function will handle all incoming Stripe events.

**Location:** `supabase/functions/stripe-webhooks/index.ts`

**Core Logic:**

1. **Security First:** The function **must** verify the Stripe signature (`Stripe-Signature` header) on every incoming request to ensure it originated from Stripe. This prevents spoofing attacks. The webhook signing secret will be stored as a Supabase environment variable.
2. **Event Parsing:** The function parses the JSON body of the request to get the Stripe event object.
3. **Event Routing:** A `switch` statement handles different `event.type` values.
4. **Database Updates:** The function uses the Supabase client to perform necessary database operations for each event.

**Code Example: `stripe-webhooks` Edge Function**

```typescript
// supabase/functions/stripe-webhooks/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET') as string;

serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new Response(err.message, { status: 400 });
  }

  // Create a Supabase client with the service_role key
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Handle the event
  switch (event.type) {
    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      if (account.charges_enabled && account.payouts_enabled) {
        await supabaseAdmin
          .from('contractor_profiles')
          .update({ stripe_onboarding_complete: true })
          .eq('stripe_connect_id', account.id);
      }
      break;
    }
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const { project_id, homeowner_id, contractor_id } = session.metadata!;
      
      // Update project status
      await supabaseAdmin
        .from('projects')
        .update({ status: 'payment_complete' })
        .eq('id', project_id);

      // Create a record in the payments table (simplified)
      const charge = await stripe.charges.retrieve(session.payment_intent.charges.data[0].id);
      await supabaseAdmin.from('payments').insert({
        project_id,
        homeowner_id,
        contractor_id,
        stripe_charge_id: charge.id,
        amount_total: session.amount_total / 100,
        platform_fee: charge.application_fee_amount / 100,
        amount_paid_to_contractor: (session.amount_total - charge.application_fee_amount) / 100,
        status: 'succeeded',
      });
      break;
    }
    // Add other cases like 'charge.failed', 'payout.paid', etc.
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
```

---

#### **5. Administrative Dashboard (`/admin`)**

This is a secure section of the Next.js app for internal HOMEase staff.

##### **5.1. Authentication and Authorization**

* **Role Definition:** Users with `role = 'admin'` in the `profiles` table are considered administrators. This role is assigned manually in the Supabase dashboard for trusted staff.
* **Middleware Protection:** A `middleware.ts` file at the root of the app will protect the `/admin` route group.

    ```typescript
    // middleware.ts
    import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
    import { NextResponse } from 'next/server';

    export async function middleware(req) {
      const res = NextResponse.next();
      const supabase = createMiddlewareClient({ req, res });
      const { data: { session } } = await supabase.auth.getSession();

      if (req.nextUrl.pathname.startsWith('/admin')) {
        if (!session) {
          return NextResponse.redirect(new URL('/login', req.url));
        }
        
        // Fetch user profile to check role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (profile?.role !== 'admin') {
          return NextResponse.redirect(new URL('/dashboard', req.url)); // Or show an unauthorized page
        }
      }
      return res;
    }
    ```

##### **5.2. Admin Dashboard Features**

The admin dashboard will be built with Server Components for read operations and Server Actions for mutations.

1. **Main View (`/admin`)**:
    * **Implementation:** A Server Component that fetches aggregate data.
    * **UI:** Displays key platform analytics widgets:
        * Total Users (Homeowners vs. Contractors)
        * Leads Created (This week/month)
        * Projects in Progress
        * Total Revenue (Platform Fees)
        * A chart showing revenue over time (using Chart.js in a Client Component).

2. **Contractor Approval Queue (`/admin/contractors`)**:
    * **Implementation:** A Server Component that fetches all contractors where `verification_status` is 'pending_approval'.
    * **UI:** A table listing pending contractors. Each row shows the contractor's name, company, and location, with a "Review" button.
    * **Detail View (`/admin/contractors/[contractorId]`)**:
        * Displays the full contractor profile, including links to download their uploaded license and insurance documents from Supabase Storage.
        * Includes "Approve" and "Reject" buttons. These buttons are part of a form that triggers a Server Action (`updateContractorStatus`).
        * The Server Action updates the contractor's `verification_status` and can trigger a Supabase Edge Function to send an approval/rejection email via Resend or a similar service.

3. **User Management (`/admin/users`)**:
    * **Implementation:** A Server Component with a paginated table of all users from the `profiles` table.
    * **UI:** Provides search and filter capabilities. Each row allows an admin to view the user's profile and provides an option to deactivate their account (e.g., setting an `is_active` flag to `false`). This action is handled by a secure Server Action.

**Metadata:**

```json
{
  "subtask_id": "payments_admin",
  "title": "Payment Integration and Administrative Dashboard",
  "expertise": "Backend Development (Stripe Integration, Supabase Edge Functions), Frontend Development"
}
```
