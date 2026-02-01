'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import ChatComponent from '@/components/ChatComponent'
import { AddressInput, isValidAddress, type AddressData } from '@/components/AddressInput'

export default function ProjectDetailPage() {
    const [project, setProject] = useState<any>(null)
    const [assessment, setAssessment] = useState<any>(null)
    const [matches, setMatches] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [urgency, setUrgency] = useState('medium')
    const [budgetRange, setBudgetRange] = useState('$5k-$10k')
    const [address, setAddress] = useState<AddressData>({ street: '', city: '', state: '', zip: '' })
    const [matchMessage, setMatchMessage] = useState('')
    const [userId, setUserId] = useState<string>('')
    const [otherPartyName, setOtherPartyName] = useState<string>('User')
    const router = useRouter()
    const params = useParams()
    const supabase = createClient()

    useEffect(() => {
        loadProject()
    }, [params.id])

    const loadProject = async () => {
        setIsLoading(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push('/login')
            return
        }
        setUserId(user.id)

        const { data: projectData, error } = await supabase
            .from('projects')
            .select('*, ar_assessments(*, assessment_media(*)), profiles!projects_homeowner_id_fkey(full_name)')
            .eq('id', params.id)
            .single()

        if (error || !projectData) {
            router.push('/dashboard')
            return
        }

        setProject(projectData)
        setAssessment(projectData.ar_assessments)
        setUrgency(projectData.urgency || 'medium')
        setBudgetRange(projectData.budget_range || '$5k-$10k')

        // Determine other party name based on who is viewing
        const isHomeowner = user.id === projectData.homeowner_id

        // Load matches if any
        const { data: matchData } = await supabase
            .from('project_matches')
            .select('*, profiles(*)')
            .eq('project_id', params.id)

        setMatches(matchData || [])

        // Find accepted match for chat partner name
        const acceptedMatch = matchData?.find((m: any) => m.status === 'proposal_accepted')
        if (isHomeowner && acceptedMatch) {
            setOtherPartyName(acceptedMatch.profiles?.full_name || 'Contractor')
        } else if (!isHomeowner) {
            setOtherPartyName(projectData.profiles?.full_name || 'Homeowner')
        }

        setIsLoading(false)
    }

    const handleSubmitLead = async () => {
        if (!isValidAddress(address, false)) {
            setMatchMessage('Please enter your city, state, and ZIP code to find contractors in your area.')
            return
        }

        setIsSubmitting(true)
        setMatchMessage('')

        try {
            // Call the matching API with geocoding
            const response = await fetch('/api/match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.id,
                    address,
                    urgency,
                    budgetRange
                })
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to submit lead')
            }

            setMatchMessage(result.message || 'Lead submitted successfully!')

            // Reload project to show matches
            await loadProject()
        } catch (error: any) {
            console.error('Failed to submit lead:', error)
            setMatchMessage(error.message || 'Failed to find contractors. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white flex items-center justify-center transition-colors">
                <div className="w-8 h-8 border-2 border-blue-500 dark:border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white p-8 transition-colors">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white mb-4 flex items-center gap-2 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Dashboard
                    </button>
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{project.title}</h1>
                            <p className="text-gray-600 dark:text-slate-400 mt-1">{project.description}</p>
                        </div>
                        <StatusBadge status={project.status} />
                    </div>
                </div>

                {/* Assessment Results */}
                {assessment && assessment.status === 'completed' && (
                    <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-white dark:from-slate-800/50 to-gray-50 dark:to-slate-900/50 border border-gray-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Safety Assessment</h2>
                            <div className="text-right">
                                <div className="text-sm text-gray-500 dark:text-slate-400">Score</div>
                                <div className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                                    {assessment.accessibility_score}<span className="text-lg text-gray-400 dark:text-slate-400">/100</span>
                                </div>
                            </div>
                        </div>

                        {/* Hazards */}
                        {assessment.identified_hazards && assessment.identified_hazards.length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-medium mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                                    <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-xs">⚠</span>
                                    Hazards ({assessment.identified_hazards.length})
                                </h3>
                                <div className="grid gap-2">
                                    {assessment.identified_hazards.map((hazard: any, i: number) => (
                                        <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-slate-800/50 text-sm">
                                            <span className="font-medium text-amber-600 dark:text-amber-300">{hazard.hazard}</span>
                                            <span className="text-gray-500 dark:text-slate-400"> - {hazard.area}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recommendations */}
                        {assessment.recommendations && assessment.recommendations.length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-medium mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                                    <span className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center text-xs">✓</span>
                                    Recommendations ({assessment.recommendations.length})
                                </h3>
                                <div className="grid gap-2">
                                    {assessment.recommendations.map((rec: any, i: number) => (
                                        <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-slate-800/50 text-sm">
                                            <span className="font-medium text-green-600 dark:text-green-300">{rec.recommendation}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Before/After Visualization */}
                        {assessment.fal_ai_visualization_urls && assessment.fal_ai_visualization_urls.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                                <h3 className="font-medium mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                                    <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-xs">🎨</span>
                                    AI Visualization: How It Could Look
                                </h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {/* Before - Original Image */}
                                    <div className="rounded-xl overflow-hidden bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                                        <div className="px-3 py-2 bg-gray-100 dark:bg-slate-800 text-sm font-medium text-gray-600 dark:text-slate-300 border-b border-gray-200 dark:border-slate-700">
                                            Before
                                        </div>
                                        <div className="aspect-video relative">
                                            {assessment.assessment_media && assessment.assessment_media.length > 0 ? (
                                                <img
                                                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assessment-media/${assessment.assessment_media[0].storage_path}`}
                                                    alt="Original room photo"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gray-100 dark:bg-slate-900 flex items-center justify-center text-gray-400 dark:text-slate-500">
                                                    <span>Original Image</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* After - AI Generated */}
                                    <div className="rounded-xl overflow-hidden bg-gray-50 dark:bg-slate-800/50 border border-purple-300 dark:border-purple-500/30">
                                        <div className="px-3 py-2 bg-gradient-to-r from-purple-100 dark:from-purple-500/20 to-cyan-100 dark:to-cyan-500/20 text-sm font-medium text-purple-600 dark:text-purple-300 border-b border-purple-200 dark:border-purple-500/30">
                                            After (AI Generated)
                                        </div>
                                        <div className="aspect-video relative">
                                            <img
                                                src={assessment.fal_ai_visualization_urls[0]}
                                                alt="AI visualization of recommended modifications"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Additional visualizations if any */}
                                {assessment.fal_ai_visualization_urls.length > 1 && (
                                    <div className="mt-4 grid grid-cols-3 gap-2">
                                        {assessment.fal_ai_visualization_urls.slice(1).map((url: string, i: number) => (
                                            <div key={i} className="rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">
                                                <img
                                                    src={url}
                                                    alt={`AI visualization ${i + 2}`}
                                                    className="w-full aspect-video object-cover"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Lead Submission Form (if draft) */}
                {project.status === 'draft' && assessment?.status === 'completed' && (
                    <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-blue-50 dark:from-blue-500/10 to-cyan-50 dark:to-cyan-500/10 border border-blue-200 dark:border-blue-500/30">
                        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Submit as Lead</h2>
                        <p className="text-gray-600 dark:text-slate-400 mb-6">
                            Ready to get quotes? Submit your assessment to find qualified contractors in your area.
                        </p>

                        <div className="grid md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">Urgency</label>
                                <div className="flex gap-3">
                                    {['low', 'medium', 'high'].map((level) => (
                                        <button
                                            key={level}
                                            onClick={() => setUrgency(level)}
                                            className={`flex-1 py-2 px-4 rounded-lg border transition-all ${urgency === level
                                                ? 'bg-blue-50 dark:bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300'
                                                : 'bg-white dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 text-gray-700 dark:text-slate-300'
                                                }`}
                                        >
                                            {level.charAt(0).toUpperCase() + level.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">Budget Range</label>
                                <select
                                    title="Budget range"
                                    value={budgetRange}
                                    onChange={(e) => setBudgetRange(e.target.value)}
                                    className="w-full py-2 px-4 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white"
                                >
                                    <option value="Under $1k">Under $1k</option>
                                    <option value="$1k-$5k">$1k - $5k</option>
                                    <option value="$5k-$10k">$5k - $10k</option>
                                    <option value="$10k-$25k">$10k - $25k</option>
                                    <option value="$25k+">$25k+</option>
                                </select>
                            </div>
                        </div>

                        {/* Project Location for Contractor Matching */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                                📍 Project Location
                            </label>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
                                Enter your address to find contractors who service your area
                            </p>
                            <AddressInput
                                value={address}
                                onChange={setAddress}
                            />
                        </div>

                        {/* Match Results Message */}
                        {matchMessage && (
                            <div className={`mb-6 p-4 rounded-lg ${
                                matchMessage.includes('Found') || matchMessage.includes('success')
                                    ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-300'
                                    : 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300'
                            }`}>
                                {matchMessage}
                            </div>
                        )}

                        <button
                            onClick={handleSubmitLead}
                            disabled={isSubmitting}
                            className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 rounded-xl font-semibold text-lg transition-all text-white"
                        >
                            {isSubmitting ? 'Finding Contractors...' : 'Find Contractors'}
                        </button>
                    </div>
                )}

                {/* Matched Contractors */}
                {(project.status === 'open_for_bids' || project.status === 'matching_complete' || project.status === 'proposals_received') && (
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                            {matches.length > 0 ? `Matched Contractors (${matches.length})` : 'Finding Contractors...'}
                        </h2>

                        {matches.length > 0 ? (
                            <div className="space-y-4">
                                {matches.map((match) => (
                                    <MatchCard
                                        key={match.id}
                                        match={match}
                                        onUpdate={loadProject}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 rounded-xl bg-gray-50 dark:bg-slate-800/30 border border-gray-200 dark:border-slate-700 text-center">
                                <div className="w-12 h-12 mx-auto mb-4 border-2 border-blue-500 dark:border-blue-400 border-t-transparent rounded-full animate-spin" />
                                <p className="text-gray-600 dark:text-slate-400">We&apos;re finding the best contractors for your project...</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Messaging - Show when proposal is accepted */}
                {project.status === 'in_progress' && userId && (
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">💬 Messages</h2>
                        <ChatComponent
                            projectId={project.id}
                            currentUserId={userId}
                            otherUserName={otherPartyName}
                        />
                    </div>
                )}

                {/* Project Info */}
                <div className="p-6 rounded-xl bg-gray-50 dark:bg-slate-800/30 border border-gray-200 dark:border-slate-700">
                    <h3 className="font-medium mb-4 text-gray-900 dark:text-white">Project Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-gray-500 dark:text-slate-400">Status</div>
                            <div className="font-medium capitalize text-gray-900 dark:text-white">{project.status.replace(/_/g, ' ')}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 dark:text-slate-400">Urgency</div>
                            <div className="font-medium capitalize text-gray-900 dark:text-white">{project.urgency || 'Medium'}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 dark:text-slate-400">Budget</div>
                            <div className="font-medium text-gray-900 dark:text-white">{project.budget_range || 'Not set'}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 dark:text-slate-400">Created</div>
                            <div className="font-medium text-gray-900 dark:text-white">{new Date(project.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function MatchCard({ match, onUpdate }: { match: any; onUpdate: () => void }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)
    const supabase = createClient()

    const handleAccept = async () => {
        setIsUpdating(true)
        try {
            await supabase
                .from('project_matches')
                .update({ status: 'proposal_accepted' })
                .eq('id', match.id)

            // Update project status
            await supabase
                .from('projects')
                .update({
                    status: 'proposal_accepted',
                    selected_contractor_id: match.contractor_id
                })
                .eq('id', match.project_id)

            onUpdate()
        } catch (error) {
            console.error('Error accepting proposal:', error)
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDecline = async () => {
        setIsUpdating(true)
        try {
            await supabase
                .from('project_matches')
                .update({ status: 'declined' })
                .eq('id', match.id)
            onUpdate()
        } catch (error) {
            console.error('Error declining proposal:', error)
        } finally {
            setIsUpdating(false)
        }
    }

    const proposalItems = match.proposal_details?.line_items || []

    return (
        <div className={`p-6 rounded-xl border transition-all ${match.status === 'proposal_sent'
            ? 'bg-gradient-to-br from-blue-50 dark:from-blue-500/10 to-cyan-50 dark:to-cyan-500/10 border-blue-200 dark:border-blue-500/30'
            : 'bg-white dark:bg-slate-800/50 border-gray-200 dark:border-slate-700'
            }`}>
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-lg font-bold text-white dark:text-slate-900">
                        {match.profiles?.full_name?.charAt(0) || 'C'}
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{match.profiles?.full_name || 'Contractor'}</h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400">CAPS Certified</p>
                    </div>
                </div>
                <StatusBadge status={match.status} />
            </div>

            {/* Proposal Summary */}
            {match.proposed_cost && (
                <div className="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-gray-500 dark:text-slate-400">Proposed Cost</div>
                            <div className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                                ${match.proposed_cost.toLocaleString()}
                            </div>
                        </div>
                        {proposalItems.length > 0 && (
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
                            >
                                {isExpanded ? 'Hide' : 'View'} Details
                                <svg
                                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Expandable Line Items */}
                    {isExpanded && proposalItems.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 space-y-2">
                            {proposalItems.map((item: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600 dark:text-slate-300">{item.description}</span>
                                    <span className="font-medium text-gray-900 dark:text-white">${item.price.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex gap-3">
                {match.status === 'proposal_sent' ? (
                    <>
                        <button
                            onClick={handleAccept}
                            disabled={isUpdating}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 rounded-lg font-medium transition-all text-white"
                        >
                            {isUpdating ? 'Processing...' : 'Accept Proposal'}
                        </button>
                        <button
                            onClick={handleDecline}
                            disabled={isUpdating}
                            className="px-4 py-3 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 disabled:opacity-50 rounded-lg font-medium transition-colors text-gray-900 dark:text-white"
                        >
                            Decline
                        </button>
                    </>
                ) : match.status === 'proposal_accepted' ? (
                    <button className="flex-1 px-4 py-2 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 rounded-lg text-sm font-medium cursor-default">
                        ✓ Proposal Accepted
                    </button>
                ) : (
                    <>
                        <button className="px-4 py-2 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors text-white">
                            View Profile
                        </button>
                        <button className="px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors text-gray-900 dark:text-white">
                            Message
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
        draft: { bg: 'bg-gray-100 dark:bg-slate-500/20', text: 'text-gray-600 dark:text-slate-300', label: 'Draft' },
        open_for_bids: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', label: 'Finding Contractors' },
        matching_complete: { bg: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-300', label: 'Contractors Found' },
        in_progress: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', label: 'In Progress' },
        completed: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-300', label: 'Completed' },
        matched: { bg: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-300', label: 'New Match' },
        proposal_sent: { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300', label: 'Proposal Received' },
        proposal_accepted: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-300', label: 'Accepted' },
        declined: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300', label: 'Declined' },
    }

    const config = statusConfig[status] || { bg: 'bg-gray-100 dark:bg-slate-500/20', text: 'text-gray-600 dark:text-slate-300', label: status }

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
            {config.label}
        </span>
    )
}
