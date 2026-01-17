'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

type Contractor = {
    profile_id: string
    company_name: string | null
    bio: string | null
    phone_number: string | null
    website_url: string | null
    address: any
    is_caps_certified: boolean
    license_number: string | null
    verification_status: string
    service_radius_miles: number | null
    created_at: string
    profiles: {
        id: string
        full_name: string | null
        avatar_url: string | null
    }
    specialties: string[]
}

const SPECIALTY_LABELS: Record<string, string> = {
    bathroom_modifications: 'Bathroom',
    stairlifts_ramps: 'Stairlifts & Ramps',
    grab_bars_handrails: 'Grab Bars',
    doorway_widening: 'Doorway Widening',
    flooring: 'Flooring',
    lighting: 'Lighting',
    kitchen_modifications: 'Kitchen',
    bedroom_modifications: 'Bedroom',
    smart_home: 'Smart Home',
    outdoor_access: 'Outdoor Access',
    general_accessibility: 'General',
}

export default function ContractorReviewList({ contractors }: { contractors: Contractor[] }) {
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
    const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null)
    const [isUpdating, setIsUpdating] = useState(false)
    const supabase = createClient()
    const router = useRouter()

    const filteredContractors = contractors.filter(c => {
        if (filter === 'all') return true
        return c.verification_status === filter
    })

    const updateStatus = async (contractorId: string, status: 'approved' | 'rejected') => {
        setIsUpdating(true)
        try {
            const { error } = await supabase
                .from('contractor_details')
                .update({ verification_status: status })
                .eq('profile_id', contractorId)

            if (error) throw error

            router.refresh()
            setSelectedContractor(null)
        } catch (error) {
            console.error('Error updating status:', error)
        } finally {
            setIsUpdating(false)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Approved</span>
            case 'rejected':
                return <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">Rejected</span>
            default:
                return <span className="px-2 py-1 text-xs rounded-full bg-amber-500/20 text-amber-400">Pending</span>
        }
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-2">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f
                                ? 'bg-slate-700 text-white'
                                : 'bg-slate-800/50 text-slate-400 hover:text-white'
                            }`}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                        {f === 'pending' && (
                            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-amber-500/30 text-amber-300">
                                {contractors.filter(c => c.verification_status === 'pending').length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Contractor List */}
            <div className="space-y-3">
                {filteredContractors.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-800/30 rounded-xl border border-slate-700">
                        No contractors found with this filter.
                    </div>
                ) : (
                    filteredContractors.map((contractor) => (
                        <div
                            key={contractor.profile_id}
                            className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-colors"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4 flex-1">
                                    {/* Avatar */}
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-lg font-bold flex-shrink-0">
                                        {contractor.company_name?.charAt(0) || contractor.profiles.full_name?.charAt(0) || '?'}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold">{contractor.company_name || 'No Company Name'}</h3>
                                            {getStatusBadge(contractor.verification_status)}
                                            {contractor.is_caps_certified && (
                                                <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-400">CAPS</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-400">{contractor.profiles.full_name}</p>
                                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{contractor.bio || 'No bio provided'}</p>

                                        {/* Specialties */}
                                        {contractor.specialties.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {contractor.specialties.slice(0, 5).map((s) => (
                                                    <span key={s} className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">
                                                        {SPECIALTY_LABELS[s] || s}
                                                    </span>
                                                ))}
                                                {contractor.specialties.length > 5 && (
                                                    <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-400">
                                                        +{contractor.specialties.length - 5} more
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => setSelectedContractor(contractor)}
                                        className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                    >
                                        Review
                                    </button>
                                    {contractor.verification_status === 'pending' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => updateStatus(contractor.profile_id, 'approved')}
                                                disabled={isUpdating}
                                                className="px-3 py-1.5 text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                ✓
                                            </button>
                                            <button
                                                onClick={() => updateStatus(contractor.profile_id, 'rejected')}
                                                disabled={isUpdating}
                                                className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                ✗
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Detail Modal */}
            {selectedContractor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl">
                        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                            <h2 className="text-xl font-semibold">Contractor Details</h2>
                            <button
                                onClick={() => setSelectedContractor(null)}
                                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Header */}
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-2xl font-bold">
                                    {selectedContractor.company_name?.charAt(0) || '?'}
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold">{selectedContractor.company_name || 'No Company Name'}</h3>
                                    <p className="text-slate-400">{selectedContractor.profiles.full_name}</p>
                                    {getStatusBadge(selectedContractor.verification_status)}
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-800/50 rounded-lg">
                                    <div className="text-xs text-slate-400">Phone</div>
                                    <div>{selectedContractor.phone_number || 'Not provided'}</div>
                                </div>
                                <div className="p-3 bg-slate-800/50 rounded-lg">
                                    <div className="text-xs text-slate-400">Website</div>
                                    <div className="truncate">{selectedContractor.website_url || 'Not provided'}</div>
                                </div>
                                <div className="p-3 bg-slate-800/50 rounded-lg">
                                    <div className="text-xs text-slate-400">License #</div>
                                    <div>{selectedContractor.license_number || 'Not provided'}</div>
                                </div>
                                <div className="p-3 bg-slate-800/50 rounded-lg">
                                    <div className="text-xs text-slate-400">Service Radius</div>
                                    <div>{selectedContractor.service_radius_miles || 25} miles</div>
                                </div>
                                <div className="p-3 bg-slate-800/50 rounded-lg col-span-2">
                                    <div className="text-xs text-slate-400">CAPS Certified</div>
                                    <div>{selectedContractor.is_caps_certified ? '✓ Yes' : '✗ No'}</div>
                                </div>
                            </div>

                            {/* Bio */}
                            <div>
                                <div className="text-sm font-medium mb-2">Bio</div>
                                <p className="text-slate-300 bg-slate-800/50 p-4 rounded-lg">
                                    {selectedContractor.bio || 'No bio provided'}
                                </p>
                            </div>

                            {/* Specialties */}
                            {selectedContractor.specialties.length > 0 && (
                                <div>
                                    <div className="text-sm font-medium mb-2">Specialties</div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedContractor.specialties.map((s) => (
                                            <span key={s} className="px-3 py-1 text-sm rounded-full bg-cyan-500/20 text-cyan-300">
                                                {SPECIALTY_LABELS[s] || s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t border-slate-700">
                                {selectedContractor.verification_status === 'pending' ? (
                                    <>
                                        <button
                                            onClick={() => updateStatus(selectedContractor.profile_id, 'approved')}
                                            disabled={isUpdating}
                                            className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded-xl font-medium transition-colors"
                                        >
                                            {isUpdating ? 'Updating...' : '✓ Approve Contractor'}
                                        </button>
                                        <button
                                            onClick={() => updateStatus(selectedContractor.profile_id, 'rejected')}
                                            disabled={isUpdating}
                                            className="flex-1 py-3 bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 rounded-xl font-medium transition-colors"
                                        >
                                            ✗ Reject
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => updateStatus(
                                            selectedContractor.profile_id,
                                            selectedContractor.verification_status === 'approved' ? 'rejected' : 'approved'
                                        )}
                                        disabled={isUpdating}
                                        className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-xl font-medium transition-colors"
                                    >
                                        {isUpdating ? 'Updating...' : selectedContractor.verification_status === 'approved' ? 'Revoke Approval' : 'Approve'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
