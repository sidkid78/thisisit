import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PurchaseLeadButton from '@/components/PurchaseLeadButton'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Determine role - default to homeowner if not set
  const role = profile?.role || 'homeowner'

  if (role === 'contractor') {
    return <ContractorDashboard user={user} profile={profile} />
  }

  // Default to homeowner dashboard
  return <HomeownerDashboard user={user} profile={profile} />
}

async function HomeownerDashboard({ user, profile }: { user: any; profile: any }) {
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('projects')
    .select('*, ar_assessments(*)')
    .eq('homeowner_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch proposals received by this homeowner
  const { data: proposals } = await supabase
    .from('proposals')
    .select('*, profiles!proposals_contractor_id_fkey(full_name, contractor_details(company_name))')
    .eq('homeowner_id', user.id)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-skin-base text-skin-text p-8 transition-colors">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-linear-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Homeowner Dashboard
            </h1>
            <p className="text-skin-muted mt-1">Welcome back, {profile?.full_name || user.email}</p>
          </div>
          <Link
            href="/dashboard/assessment"
            className="px-6 py-3 bg-linear-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-full font-medium text-white transition-all hover:shadow-lg hover:shadow-blue-500/25"
          >
            + New Assessment
          </Link>
        </div>

        {proposals && proposals.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-skin-text">
              📩 Proposals Received
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                {proposals.filter((p: any) => p.status === 'sent' || p.status === 'viewed').length} pending
              </span>
            </h2>
            <div className="space-y-3">
              {proposals.map((proposal: any) => (
                <Link
                  key={proposal.id}
                  href={`/dashboard/review/${proposal.id}`}
                  className="block p-5 rounded-xl bg-skin-card border border-skin-border hover:border-blue-500/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-skin-text">{proposal.title}</h3>
                      <p className="text-sm text-skin-muted">
                        From {proposal.profiles?.full_name} • {proposal.profiles?.contractor_details?.company_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          ${(proposal.total_amount_cents / 100).toLocaleString()}
                        </div>
                        <div className="text-xs text-skin-muted">{proposal.estimated_duration}</div>
                      </div>
                      <ProposalStatusBadge status={proposal.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-skin-card border border-skin-border">
            <div className="text-2xl font-bold text-skin-text">{projects?.length || 0}</div>
            <div className="text-sm text-skin-muted">Total Projects</div>
          </div>
          <div className="p-4 rounded-xl bg-skin-card border border-skin-border">
            <div className="text-2xl font-bold text-skin-text">
              {projects?.filter((p: any) => p.status === 'completed').length || 0}
            </div>
            <div className="text-sm text-skin-muted">Completed</div>
          </div>
          <div className="p-4 rounded-xl bg-skin-card border border-skin-border">
            <div className="text-2xl font-bold text-skin-text">
              {projects?.filter((p: any) => p.status === 'open_for_bids').length || 0}
            </div>
            <div className="text-sm text-skin-muted">Active Leads</div>
          </div>
          <div className="p-4 rounded-xl bg-skin-card border border-skin-border">
            <div className="text-2xl font-bold text-skin-text">
              {projects?.filter((p: any) => p.ar_assessments?.status === 'completed').length || 0}
            </div>
            <div className="text-sm text-skin-muted">Assessments Done</div>
          </div>
        </div>

        {/* Projects List */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-skin-text">Your Projects</h2>
          {projects && projects.length > 0 ? (
            <div className="space-y-4">
              {projects.map((project: any) => (
                <div key={project.id} className="p-6 rounded-xl bg-skin-card border border-skin-border hover:border-skin-muted transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg text-skin-text">{project.title}</h3>
                      <p className="text-skin-muted text-sm mt-1">{project.description}</p>
                    </div>
                    <StatusBadge status={project.status} />
                  </div>

                  {project.ar_assessments && project.ar_assessments.status === 'completed' && (
                    <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-blue-700 dark:text-blue-300">Safety Score</div>
                          <div className="text-2xl font-bold text-skin-text">{project.ar_assessments.accessibility_score}/100</div>
                        </div>
                        <Link
                          href={`/dashboard/project/${project.id}`}
                          className="px-4 py-2 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg text-sm font-medium text-white transition-colors"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  )}

                  {project.ar_assessments && project.ar_assessments.status === 'processing' && (
                    <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-amber-500 dark:border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-amber-700 dark:text-amber-300 text-sm">AI Analysis in progress...</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 rounded-xl bg-skin-subtle border border-skin-border text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-skin-base flex items-center justify-center">
                <svg className="w-8 h-8 text-skin-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h3 className="font-medium text-lg mb-2 text-skin-text">No projects yet</h3>
              <p className="text-skin-muted mb-6">Start a safety assessment to create your first project</p>
              <Link
                href="/dashboard/assessment"
                className="inline-block px-6 py-3 bg-linear-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-full font-medium text-white transition-all"
              >
                Start Free Safety Scan
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

async function ContractorDashboard({ user, profile }: { user: any; profile: any }) {
  const supabase = await createClient()
  const { data: matches } = await supabase
    .from('project_matches')
    .select('*, projects(*, ar_assessments(*))')
    .eq('contractor_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-skin-base text-skin-text p-8 transition-colors">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-linear-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Contractor Dashboard
            </h1>
            <p className="text-skin-muted mt-1">Welcome back, {profile?.full_name || user.email}</p>
          </div>
          <Link
            href="/dashboard/account"
            className="px-6 py-3 bg-skin-card hover:bg-skin-subtle border border-skin-border rounded-full font-medium transition-all"
          >
            Edit Profile
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-skin-card border border-skin-border">
            <div className="text-2xl font-bold text-skin-text">{matches?.length || 0}</div>
            <div className="text-sm text-skin-muted">Total Matches</div>
          </div>
          <div className="p-4 rounded-xl bg-skin-card border border-skin-border">
            <div className="text-2xl font-bold text-skin-text">
              {matches?.filter((m: any) => m.status === 'matched' || m.status === 'lead_purchased').length || 0}
            </div>
            <div className="text-sm text-skin-muted">Active Leads</div>
          </div>
          <div className="p-4 rounded-xl bg-skin-card border border-skin-border">
            <div className="text-2xl font-bold text-skin-text">
              {matches?.filter((m: any) => m.status === 'proposal_sent').length || 0}
            </div>
            <div className="text-sm text-skin-muted">Proposals Sent</div>
          </div>
          <div className="p-4 rounded-xl bg-skin-card border border-skin-border">
            <div className="text-2xl font-bold text-skin-text">
              {matches?.filter((m: any) => m.status === 'proposal_accepted').length || 0}
            </div>
            <div className="text-sm text-skin-muted">Jobs Won</div>
          </div>
        </div>

        {/* Leads List */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-skin-text">Your Leads</h2>
          {matches && matches.length > 0 ? (
            <div className="space-y-4">
              {matches.map((match: any) => (
                <div key={match.id} className="p-6 rounded-xl bg-skin-card border border-skin-border hover:border-skin-muted transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg text-skin-text">{match.projects?.title}</h3>
                      <p className="text-skin-muted text-sm mt-1">{match.projects?.description}</p>
                    </div>
                    <StatusBadge status={match.status} />
                  </div>

                  {match.projects?.ar_assessments && (
                    <div className="mt-4 grid grid-cols-3 gap-4 p-4 rounded-lg bg-skin-subtle">
                      <div>
                        <div className="text-xs text-skin-muted">Safety Score</div>
                        <div className="font-semibold text-skin-text">{match.projects.ar_assessments.accessibility_score}/100</div>
                      </div>
                      <div>
                        <div className="text-xs text-skin-muted">Hazards Found</div>
                        <div className="font-semibold text-skin-text">{match.projects.ar_assessments.identified_hazards?.length || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-skin-muted">Urgency</div>
                        <div className="font-semibold text-skin-text capitalize">{match.projects?.urgency || 'Medium'}</div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex gap-3">
                    <Link
                      href={`/dashboard/project/${match.projects?.id}`}
                      className="px-4 py-2 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg text-sm font-medium text-white transition-colors"
                    >
                      View Project
                    </Link>
                    {match.status === 'matched' && (
                      <PurchaseLeadButton matchId={match.id} projectTitle={match.projects?.title} />
                    )}
                    {match.status === 'lead_purchased' && (
                      <Link
                        href={`/dashboard/proposal/${match.id}`}
                        className="px-4 py-2 bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 rounded-lg text-sm font-medium text-white transition-colors"
                      >
                        Create Proposal
                      </Link>
                    )}
                    {match.status === 'proposal_sent' && (
                      <span className="px-4 py-2 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg text-sm font-medium">
                        ⏳ Awaiting Response
                      </span>
                    )}
                    {match.status === 'proposal_accepted' && (
                      <Link
                        href={`/dashboard/project/${match.projects?.id}`}
                        className="px-4 py-2 bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 rounded-lg text-sm font-medium text-white transition-colors"
                      >
                        ✓ Start Project
                      </Link>
                    )}
                    {match.status === 'proposal_rejected' && (
                      <span className="px-4 py-2 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium">
                        ✗ Declined
                      </span>
                    )}
                  </div>

                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 rounded-xl bg-skin-subtle border border-skin-border text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-skin-base flex items-center justify-center">
                <svg className="w-8 h-8 text-skin-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="font-medium text-lg mb-2 text-skin-text">No leads yet</h3>
              <p className="text-skin-muted mb-6">Complete your profile to start receiving matched leads</p>
              <Link
                href="/dashboard/account"
                className="inline-block px-6 py-3 bg-linear-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-full font-medium text-white transition-all"
              >
                Complete Profile
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: 'bg-gray-100 dark:bg-slate-500/20', text: 'text-gray-700 dark:text-slate-300', label: 'Draft' },
    open_for_bids: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', label: 'Open for Bids' },
    in_progress: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', label: 'In Progress' },
    completed: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-300', label: 'Completed' },
    matched: { bg: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-300', label: 'New Match' },
    lead_purchased: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-300', label: '✓ Purchased' },
    proposal_sent: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', label: 'Proposal Sent' },
    proposal_accepted: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-300', label: 'Accepted' },
  }

  const config = statusConfig[status] || { bg: 'bg-gray-100 dark:bg-slate-500/20', text: 'text-gray-700 dark:text-slate-300', label: status }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

function ProposalStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    sent: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', label: '📩 New' },
    viewed: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', label: '👁️ Viewed' },
    accepted: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-300', label: '✓ Accepted' },
    rejected: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300', label: '✗ Declined' },
    expired: { bg: 'bg-gray-100 dark:bg-slate-500/20', text: 'text-gray-700 dark:text-slate-300', label: 'Expired' },
  }

  const config = statusConfig[status] || { bg: 'bg-gray-100 dark:bg-slate-500/20', text: 'text-gray-700 dark:text-slate-300', label: status }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}
