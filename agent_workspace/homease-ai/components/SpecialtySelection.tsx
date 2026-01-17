'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

// Specialty labels for display
const SPECIALTY_OPTIONS = [
    { value: 'bathroom_modifications', label: 'Bathroom Modifications', icon: '🚿', description: 'Walk-in showers, grab bars, raised toilets' },
    { value: 'stairlifts_ramps', label: 'Stairlifts & Ramps', icon: '🏗️', description: 'Wheelchair ramps, stair lifts, elevators' },
    { value: 'grab_bars_handrails', label: 'Grab Bars & Handrails', icon: '🤝', description: 'Safety rails, support bars throughout home' },
    { value: 'doorway_widening', label: 'Doorway Widening', icon: '🚪', description: 'Wider doorways for wheelchair access' },
    { value: 'flooring', label: 'Flooring', icon: '🏠', description: 'Non-slip flooring, threshold elimination' },
    { value: 'lighting', label: 'Lighting', icon: '💡', description: 'Motion-sensor lights, improved visibility' },
    { value: 'kitchen_modifications', label: 'Kitchen Modifications', icon: '🍳', description: 'Accessible counters, pull-out shelves' },
    { value: 'bedroom_modifications', label: 'Bedroom Modifications', icon: '🛏️', description: 'Adjustable beds, closet access' },
    { value: 'smart_home', label: 'Smart Home', icon: '📱', description: 'Voice controls, automated systems' },
    { value: 'outdoor_access', label: 'Outdoor Access', icon: '🌳', description: 'Pathways, patio accessibility, entry points' },
    { value: 'general_accessibility', label: 'General Accessibility', icon: '♿', description: 'Overall home accessibility consulting' },
]

type SpecialtySelectionProps = {
    contractorId: string
    onUpdate?: () => void
}

export default function SpecialtySelection({ contractorId, onUpdate }: SpecialtySelectionProps) {
    const supabase = createClient()
    const [selectedSpecialties, setSelectedSpecialties] = useState<Set<string>>(new Set())
    const [isLoading, setIsLoading] = useState(false)
    const [isFetching, setIsFetching] = useState(true)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    // Load existing specialties on mount
    useEffect(() => {
        async function fetchSpecialties() {
            setIsFetching(true)
            const { data, error } = await supabase
                .from('contractor_specialties')
                .select('specialty')
                .eq('contractor_id', contractorId)

            if (error) {
                console.error('Error fetching specialties:', error)
            } else if (data) {
                setSelectedSpecialties(new Set(data.map(s => s.specialty)))
            }
            setIsFetching(false)
        }

        if (contractorId) {
            fetchSpecialties()
        }
    }, [contractorId, supabase])

    const toggleSpecialty = (specialty: string) => {
        const newSet = new Set(selectedSpecialties)
        if (newSet.has(specialty)) {
            newSet.delete(specialty)
        } else {
            newSet.add(specialty)
        }
        setSelectedSpecialties(newSet)
    }

    const handleSave = async () => {
        setIsLoading(true)
        setMessage(null)

        try {
            // Delete existing specialties
            const { error: deleteError } = await supabase
                .from('contractor_specialties')
                .delete()
                .eq('contractor_id', contractorId)

            if (deleteError) {
                console.error('Delete error:', deleteError)
                throw deleteError
            }

            // Insert new specialties
            if (selectedSpecialties.size > 0) {
                const inserts = Array.from(selectedSpecialties).map(specialty => ({
                    contractor_id: contractorId,
                    specialty: specialty,
                }))

                const { error: insertError } = await supabase
                    .from('contractor_specialties')
                    .insert(inserts)

                if (insertError) {
                    console.error('Insert error:', insertError)
                    throw insertError
                }
            }

            setMessage({ type: 'success', text: 'Specialties saved successfully!' })
            onUpdate?.()
        } catch (error: any) {
            console.error('Save error:', error)
            setMessage({ type: 'error', text: error.message || 'Failed to update specialties' })
        } finally {
            setIsLoading(false)
        }
    }

    if (isFetching) {
        return (
            <div className="p-8 text-center text-slate-400">
                Loading specialties...
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="font-medium">Your Specialties</h4>
                    <p className="text-sm text-slate-400">Select all areas you specialize in</p>
                </div>
                <span className="text-sm text-cyan-400">{selectedSpecialties.size} selected</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SPECIALTY_OPTIONS.map((specialty) => (
                    <button
                        key={specialty.value}
                        type="button"
                        onClick={() => toggleSpecialty(specialty.value)}
                        className={`p-3 rounded-xl border text-left transition-all ${selectedSpecialties.has(specialty.value)
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                            : 'bg-slate-800/30 border-slate-700 hover:border-slate-600'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-xl">{specialty.icon}</span>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{specialty.label}</div>
                                <div className="text-xs text-slate-400 truncate">{specialty.description}</div>
                            </div>
                            {selectedSpecialties.has(specialty.value) && (
                                <svg className="w-5 h-5 text-cyan-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                    </button>
                ))}
            </div>

            {message && (
                <div className={`p-3 rounded-lg text-sm ${message.type === 'success'
                    ? 'bg-green-500/20 text-green-300'
                    : 'bg-red-500/20 text-red-300'
                    }`}>
                    {message.text}
                </div>
            )}

            <button
                type="button"
                onClick={handleSave}
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 rounded-xl font-medium transition-all"
            >
                {isLoading ? 'Saving...' : 'Save Specialties'}
            </button>
        </div>
    )
}
