'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import ChatComponent from '@/components/ChatComponent'

type LineItem = {
    description: string
    quantity: number
    unit_price: number
    total: number
    from_recommendation?: boolean
}

type Proposal = {
    id: string
    title: string
    summary: string
    line_items: LineItem[]
    total_amount_cents: number
    estimated_duration: string
    valid_until: string
    status: string
    contractor_id: string
    match_id: string
    project_id: string
}

export default function ProposalReviewPage() {
    const [proposal, setProposal] = useState<Proposal | null>(null)
    const [contractor, setContractor] = useState<any>(null)
    const [project, setProject] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isResponding, setIsResponding] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [userId, setUserId] = useState<string>('')

    const router = useRouter()
    const params = useParams()
    const supabase = createClient()

    useEffect(() => {
        loadProposal()
    }, [params.id])

    const loadProposal = async () => {
        setIsLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')
            setUserId(user.id)

            // Get proposal
            const { data: proposalData, error: proposalError } = await supabase
                .from('proposals')
                .select('*')
                .eq('id', params.id)
                .single()

            if (proposalError) throw proposalError
            setProposal(proposalData)

            // Mark as viewed
            if (proposalData.status === 'sent') {
                await supabase
                    .from('proposals')
                    .update({ status: 'viewed', viewed_at: new Date().toISOString() })
                    .eq('id', params.id)
            }

            // Get contractor details
            const { data: contractorData } = await supabase
                .from('profiles')
                .select('*, contractor_details(*)')
                .eq('id', proposalData.contractor_id)
                .single()
            setContractor(contractorData)

            // Get project
            const { data: projectData } = await supabase
                .from('projects')
                .select('*')
                .eq('id', proposalData.project_id)
                .single()
            setProject(projectData)

        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleResponse = async (accept: boolean) => {
        if (!proposal) return
        setIsResponding(true)
        setError(null)

        try {
            const newStatus = accept ? 'accepted' : 'rejected'

            // Update proposal
            await supabase
                .from('proposals')
                .update({
                    status: newStatus,
                    responded_at: new Date().toISOString()
                })
                .eq('id', proposal.id)

            // Update match status
            await supabase
                .from('project_matches')
                .update({
                    status: accept ? 'proposal_accepted' : 'proposal_rejected',
                    updated_at: new Date().toISOString()
                })
                .eq('id', proposal.match_id)

            // Update project if accepted
            if (accept) {
                await supabase
                    .from('projects')
                    .update({ status: 'in_progress' })
                    .eq('id', proposal.project_id)
            }

            router.push('/dashboard')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsResponding(false)
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (error || !proposal) {
        return (
            <div className="min-h-screen bg-slate-950 text-white p-8">
                <div className="max-w-2xl mx-auto text-center">
                    <h1 className="text-2xl font-bold mb-4">Error</h1>
                    <p className="text-slate-400 mb-6">{error || 'Proposal not found'}</p>
                    <Link href="/dashboard" className="text-blue-400 hover:underline">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    const totalDollars = proposal.total_amount_cents / 100

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/dashboard" className="text-slate-400 hover:text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold">{proposal.title}</h1>
                    <p className="text-slate-400 mt-1">
                        Submitted by {contractor?.full_name || 'Contractor'} • {contractor?.contractor_details?.company_name}
                    </p>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Summary */}
                        <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700">
                            <h2 className="text-lg font-semibold mb-3">Summary</h2>
                            <p className="text-slate-300">{proposal.summary}</p>
                            <div className="mt-4 flex gap-4 text-sm">
                                <div className="px-3 py-1 bg-slate-700 rounded-full">
                                    ⏱️ {proposal.estimated_duration}
                                </div>
                                <div className="px-3 py-1 bg-slate-700 rounded-full">
                                    📅 Valid until {new Date(proposal.valid_until).toLocaleDateString()}
                                </div>
                            </div>
                        </div>

                        {/* Line Items */}
                        <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700">
                            <h2 className="text-lg font-semibold mb-4">Scope of Work</h2>
                            <div className="space-y-3">
                                {proposal.line_items.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl">
                                        <div className="flex-1">
                                            <div className="font-medium">{item.description}</div>
                                            {item.from_recommendation && (
                                                <div className="text-xs text-blue-400 mt-1">From AI Assessment</div>
                                            )}
                                        </div>
                                        <div className="text-right font-semibold">
                                            ${(item.total / 100).toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-600 flex justify-between items-center">
                                <span className="text-lg font-semibold">Total</span>
                                <span className="text-2xl font-bold text-blue-400">
                                    ${totalDollars.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Chat */}
                        {proposal.status !== 'draft' && project && contractor && (
                            <div>
                                <h2 className="text-lg font-semibold mb-4">Chat with Contractor</h2>
                                <ChatComponent
                                    projectId={proposal.project_id}
                                    currentUserId={userId}
                                    otherUserName={contractor?.full_name || 'Contractor'}
                                />
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Contractor Card */}
                        <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700">
                            <h3 className="font-semibold mb-4">Contractor</h3>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
                                    {contractor?.full_name?.charAt(0) || '?'}
                                </div>
                                <div>
                                    <div className="font-medium">{contractor?.full_name}</div>
                                    <div className="text-sm text-slate-400">{contractor?.contractor_details?.company_name}</div>
                                </div>
                            </div>
                            {contractor?.contractor_details?.is_caps_certified && (
                                <div className="px-3 py-2 bg-green-500/20 text-green-300 rounded-lg text-sm font-medium mb-2">
                                    ✓ CAPS Certified
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        {proposal.status !== 'accepted' && proposal.status !== 'rejected' && (
                            <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30">
                                <h3 className="font-semibold mb-4">Your Response</h3>
                                {error && (
                                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
                                        {error}
                                    </div>
                                )}
                                <div className="space-y-3">
                                    <button
                                        onClick={() => handleResponse(true)}
                                        disabled={isResponding}
                                        className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded-xl font-semibold transition-colors"
                                    >
                                        {isResponding ? 'Processing...' : '✓ Accept Proposal'}
                                    </button>
                                    <button
                                        onClick={() => handleResponse(false)}
                                        disabled={isResponding}
                                        className="w-full py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-xl font-medium transition-colors"
                                    >
                                        Decline
                                    </button>
                                </div>
                            </div>
                        )}

                        {proposal.status === 'accepted' && (
                            <div className="p-6 rounded-2xl bg-green-500/20 border border-green-500/30">
                                <div className="text-green-300 font-semibold text-lg mb-2">✓ Proposal Accepted</div>
                                <p className="text-sm text-slate-300">
                                    You can now coordinate directly with the contractor.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
