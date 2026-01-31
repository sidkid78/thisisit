'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface LineItem {
    id: string
    description: string
    fromRecommendation: boolean
    price: number
    included: boolean
}

export default function ProposalPage() {
    const [match, setMatch] = useState<any>(null)
    const [project, setProject] = useState<any>(null)
    const [assessment, setAssessment] = useState<any>(null)
    const [lineItems, setLineItems] = useState<LineItem[]>([])
    const [customItem, setCustomItem] = useState({ description: '', price: '' })
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const router = useRouter()
    const params = useParams()
    const supabase = createClient()

    useEffect(() => {
        loadMatchData()
    }, [params.id])

    const loadMatchData = async () => {
        setIsLoading(true)
        setError(null)

        try {
            // Get the match with project and assessment
            const { data: matchData, error: matchError } = await supabase
                .from('project_matches')
                .select('*, projects(*, ar_assessments(*))')
                .eq('id', params.id)
                .single()

            if (matchError || !matchData) {
                setError('Match not found')
                return
            }

            setMatch(matchData)
            setProject(matchData.projects)
            setAssessment(matchData.projects?.ar_assessments)

            // Convert recommendations to line items
            const recommendations = matchData.projects?.ar_assessments?.recommendations || []
            const initialItems: LineItem[] = recommendations.map((rec: any, index: number) => ({
                id: `rec-${index}`,
                description: rec.recommendation || rec.details || `Recommendation ${index + 1}`,
                fromRecommendation: true,
                price: estimatePrice(rec.recommendation || rec.details || ''),
                included: true
            }))
            setLineItems(initialItems)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    // Simple price estimation based on common accessibility modifications
    const estimatePrice = (description: string): number => {
        const lower = description.toLowerCase()
        if (lower.includes('grab bar')) return 150
        if (lower.includes('ramp')) return 2500
        if (lower.includes('walk-in shower') || lower.includes('shower')) return 5000
        if (lower.includes('doorway') || lower.includes('widen')) return 1500
        if (lower.includes('handrail') || lower.includes('rail')) return 300
        if (lower.includes('lighting') || lower.includes('light')) return 200
        if (lower.includes('flooring') || lower.includes('floor')) return 800
        return 500 // Default estimate
    }

    const toggleItem = (id: string) => {
        setLineItems(items =>
            items.map(item =>
                item.id === id ? { ...item, included: !item.included } : item
            )
        )
    }

    const updatePrice = (id: string, price: number) => {
        setLineItems(items =>
            items.map(item =>
                item.id === id ? { ...item, price } : item
            )
        )
    }

    const addCustomItem = () => {
        if (!customItem.description || !customItem.price) return

        const newItem: LineItem = {
            id: `custom-${Date.now()}`,
            description: customItem.description,
            fromRecommendation: false,
            price: parseFloat(customItem.price),
            included: true
        }
        setLineItems([...lineItems, newItem])
        setCustomItem({ description: '', price: '' })
    }

    const removeItem = (id: string) => {
        setLineItems(items => items.filter(item => item.id !== id))
    }

    const calculateTotal = () => {
        return lineItems
            .filter(item => item.included)
            .reduce((sum, item) => sum + item.price, 0)
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)
        setError(null)

        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const includedItems = lineItems.filter(item => item.included).map(item => ({
                description: item.description,
                quantity: 1,
                unit_price: item.price * 100, // cents
                total: item.price * 100,
                from_recommendation: item.fromRecommendation
            }))

            const totalCents = calculateTotal() * 100

            // Create proposal record
            const { error: proposalError } = await supabase
                .from('proposals')
                .insert({
                    match_id: match.id,
                    project_id: project.id,
                    contractor_id: user.id,
                    homeowner_id: project.homeowner_id,
                    title: `Proposal for ${project.title}`,
                    summary: `Accessibility modifications based on AI assessment. Includes ${includedItems.length} items.`,
                    line_items: includedItems,
                    total_amount_cents: totalCents,
                    estimated_duration: '2-4 weeks',
                    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
                    status: 'sent',
                    sent_at: new Date().toISOString()
                })

            if (proposalError) throw proposalError

            // Also update match status
            const { error: updateError } = await supabase
                .from('project_matches')
                .update({
                    proposal_details: { line_items: includedItems },
                    proposed_cost: calculateTotal(),
                    status: 'proposal_sent',
                    updated_at: new Date().toISOString()
                })
                .eq('id', match.id)

            if (updateError) throw updateError

            router.push('/dashboard')
        } catch (err: any) {
            setError(err.message)
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

    if (error && !match) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white p-8 transition-colors">
                <div className="max-w-2xl mx-auto text-center">
                    <h1 className="text-2xl font-bold mb-4">Error</h1>
                    <p className="text-gray-600 dark:text-slate-400 mb-6">{error}</p>
                    <Link href="/dashboard" className="text-blue-600 dark:text-blue-400 hover:underline">
                        Back to Dashboard
                    </Link>
                </div>
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
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Proposal</h1>
                    <p className="text-gray-600 dark:text-slate-400 mt-1">for {project?.title}</p>
                </div>

                {/* Project Summary */}
                <div className="mb-8 p-6 rounded-2xl bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Project Summary</h2>
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <div className="text-gray-500 dark:text-slate-400">Safety Score</div>
                            <div className="text-xl font-bold text-gray-900 dark:text-white">{assessment?.accessibility_score || 'N/A'}/100</div>
                        </div>
                        <div>
                            <div className="text-gray-500 dark:text-slate-400">Hazards Found</div>
                            <div className="text-xl font-bold text-gray-900 dark:text-white">{assessment?.identified_hazards?.length || 0}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 dark:text-slate-400">Budget Range</div>
                            <div className="text-xl font-bold text-gray-900 dark:text-white">{project?.budget_range || 'Not specified'}</div>
                        </div>
                    </div>
                </div>

                {/* Scope Builder */}
                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Scope Builder</h2>
                    <p className="text-gray-600 dark:text-slate-400 text-sm mb-6">
                        Select which recommendations to include and set your prices. You can also add custom items.
                    </p>

                    {/* Line Items */}
                    <div className="space-y-3 mb-6">
                        {lineItems.map((item) => (
                            <div
                                key={item.id}
                                className={`p-4 rounded-xl border transition-all ${item.included
                                    ? 'bg-white dark:bg-slate-800/50 border-blue-300 dark:border-blue-500/50'
                                    : 'bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-700 opacity-60'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Toggle */}
                                    <button
                                        onClick={() => toggleItem(item.id)}
                                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${item.included
                                            ? 'bg-blue-500 border-blue-500'
                                            : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
                                            }`}
                                    >
                                        {item.included && (
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>

                                    {/* Description */}
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900 dark:text-white">{item.description}</div>
                                        {item.fromRecommendation && (
                                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">From AI Assessment</div>
                                        )}
                                    </div>

                                    {/* Price Input */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400 dark:text-slate-400">$</span>
                                        <input
                                            title="price input"
                                            type="number"
                                            value={item.price}
                                            onChange={(e) => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                                            className="w-24 px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-right focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white"
                                        />
                                    </div>

                                    {/* Remove (only for custom items) */}
                                    {!item.fromRecommendation && (
                                        <button
                                            title="remove"
                                            onClick={() => removeItem(item.id)}
                                            className="text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add Custom Item */}
                    <div className="p-4 rounded-xl border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/30">
                        <div className="flex items-center gap-4">
                            <input
                                type="text"
                                placeholder="Add custom item..."
                                value={customItem.description}
                                onChange={(e) => setCustomItem({ ...customItem, description: e.target.value })}
                                className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                            />
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400 dark:text-slate-400">$</span>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={customItem.price}
                                    onChange={(e) => setCustomItem({ ...customItem, price: e.target.value })}
                                    className="w-24 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-right focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                                />
                            </div>
                            <button
                                onClick={addCustomItem}
                                disabled={!customItem.description || !customItem.price}
                                className="px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-gray-900 dark:text-white"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>

                {/* Total & Submit */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-50 dark:from-blue-500/10 to-cyan-50 dark:to-cyan-500/10 border border-blue-200 dark:border-blue-500/30">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <div className="text-sm text-gray-500 dark:text-slate-400">Total Proposal</div>
                            <div className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                                ${calculateTotal().toLocaleString()}
                            </div>
                        </div>
                        <div className="text-right text-sm text-gray-500 dark:text-slate-400">
                            {lineItems.filter(i => i.included).length} items included
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || lineItems.filter(i => i.included).length === 0}
                        className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-lg transition-all text-white"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Proposal'}
                    </button>
                </div>
            </div>
        </div>
    )
}
