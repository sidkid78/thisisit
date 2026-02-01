'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { CinematicAnalysisLoader } from '@/components/CinematicAnalysisLoader'
import { FeedbackModal } from '@/components/FeedbackModal'
import { StyleSelector, getStylePromptModifier, type RenovationStyle } from '@/components/StyleSelector'
import { ARCameraMode } from '@/components/ARCameraMode'
import { MeasurementsOverlay } from '@/components/MeasurementsOverlay'
import { isHeicFile, convertHeicToJpeg, validateImageFile } from '@/utils/image'

interface UploadedImage {
    file: File
    preview: string
    uploading: boolean
    uploaded: boolean
    storagePath?: string
    publicUrl?: string
}

interface IdentifiedHazard {
    hazard: string
    details: string
    area?: string
    severity?: 'High' | 'Medium' | 'Low'
    position?: { x: number; y: number }
}

interface Recommendation {
    recommendation: string
    details: string
    priority?: 'High' | 'Medium' | 'Low'
    estimated_cost?: { min: number; max: number }
}

interface AssessmentResult {
    id: string
    project_id: string
    accessibility_score: number
    identified_hazards: IdentifiedHazard[]
    recommendations: Recommendation[]
    fal_ai_visualization_urls?: string[]
    gemini_analysis_raw?: any
    cost_estimate_min?: number
    cost_estimate_max?: number
    materials_needed?: string[]
}

// Before/After Image Comparison Component
function ImageComparison({
    beforeUrl,
    afterUrl,
    hazards
}: {
    beforeUrl: string
    afterUrl?: string
    hazards?: IdentifiedHazard[]
}) {
    const [sliderPosition, setSliderPosition] = useState(50)
    const [activeHazard, setActiveHazard] = useState<number | null>(null)
    const [showAfter, setShowAfter] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const isDragging = useRef(false)

    const handleMouseDown = () => { isDragging.current = true }
    const handleMouseUp = () => { isDragging.current = false }
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 100
        setSliderPosition(Math.min(100, Math.max(0, x)))
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const touch = e.touches[0]
        const x = ((touch.clientX - rect.left) / rect.width) * 100
        setSliderPosition(Math.min(100, Math.max(0, x)))
    }

    const getSeverityColor = (severity?: string) => {
        switch (severity) {
            case 'High': return 'bg-red-500 border-red-400'
            case 'Medium': return 'bg-amber-500 border-amber-400'
            case 'Low': return 'bg-blue-500 border-blue-400'
            default: return 'bg-amber-500 border-amber-400'
        }
    }

    return (
        <div className="space-y-4">
            {/* Toggle buttons */}
            {afterUrl && (
                <div className="flex gap-2 justify-center">
                    <button
                        onClick={() => setShowAfter(false)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${!showAfter
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                            }`}
                    >
                        Before
                    </button>
                    <button
                        onClick={() => setShowAfter(true)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${showAfter
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                            }`}
                    >
                        After (AI Preview)
                    </button>
                </div>
            )}

            {/* Image container with comparison slider */}
            <div
                ref={containerRef}
                className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700 select-none"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchMove={handleTouchMove}
            >
                {/* Before image with hazard markers */}
                <div className="relative">
                    <img
                        src={showAfter && afterUrl ? afterUrl : beforeUrl}
                        alt={showAfter ? "After" : "Before"}
                        className="w-full h-auto"
                    />

                    {/* Hazard markers - only show on "before" view */}
                    {!showAfter && hazards && hazards.map((hazard, index) => (
                        hazard.position && (
                            <button
                                key={index}
                                className={`absolute w-8 h-8 rounded-full border-2 flex items-center justify-center 
                                    text-white text-sm font-bold cursor-pointer transform -translate-x-1/2 -translate-y-1/2
                                    transition-all hover:scale-110 ${getSeverityColor(hazard.severity)}
                                    ${activeHazard === index ? 'ring-4 ring-white/50 scale-125' : ''}`}
                                style={{
                                    left: `${hazard.position.x}%`,
                                    top: `${hazard.position.y}%`
                                }}
                                onClick={() => setActiveHazard(activeHazard === index ? null : index)}
                                title={hazard.hazard}
                            >
                                {index + 1}
                            </button>
                        )
                    ))}

                    {/* Image label */}
                    <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-sm font-medium ${showAfter
                            ? 'bg-green-500/90 text-white'
                            : 'bg-gray-900/80 text-white'
                        }`}>
                        {showAfter ? 'AFTER (AI Preview)' : 'BEFORE'}
                    </div>
                </div>

                {/* Comparison slider (when both images exist and not in toggle mode) */}
                {afterUrl && !showAfter && (
                    <>
                        <div
                            className="absolute inset-0 overflow-hidden"
                            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                        >
                            <img
                                src={afterUrl}
                                alt="After"
                                className="w-full h-auto"
                            />
                            <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-sm font-medium bg-green-500/90 text-white">
                                AFTER
                            </div>
                        </div>

                        {/* Slider handle */}
                        <div
                            className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize"
                            style={{ left: `${sliderPosition}%` }}
                            onMouseDown={handleMouseDown}
                            onTouchStart={handleMouseDown}
                        >
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                                </svg>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Active hazard tooltip */}
            {activeHazard !== null && hazards && hazards[activeHazard] && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                    <div className="flex items-start gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${getSeverityColor(hazards[activeHazard].severity)}`}>
                            {activeHazard + 1}
                        </span>
                        <div>
                            <div className="font-medium text-amber-800 dark:text-amber-300">
                                {hazards[activeHazard].hazard}
                            </div>
                            <div className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                                {hazards[activeHazard].details}
                            </div>
                            {hazards[activeHazard].area && (
                                <div className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                                    Area: {hazards[activeHazard].area}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Priority Badge Component
function PriorityBadge({ priority }: { priority?: string }) {
    const config = {
        High: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30',
        Medium: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
        Low: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
    }
    if (!priority) return null
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${config[priority as keyof typeof config] || config.Medium}`}>
            {priority}
        </span>
    )
}

// Circular Score Component
function CircularScore({ score }: { score: number }) {
    const circumference = 2 * Math.PI * 45
    const strokeDashoffset = circumference - (score / 100) * circumference
    const getScoreColor = (s: number) => {
        if (s >= 80) return 'text-green-500'
        if (s >= 60) return 'text-blue-500'
        if (s >= 40) return 'text-amber-500'
        return 'text-red-500'
    }
    const getStrokeColor = (s: number) => {
        if (s >= 80) return 'stroke-green-500'
        if (s >= 60) return 'stroke-blue-500'
        if (s >= 40) return 'stroke-amber-500'
        return 'stroke-red-500'
    }

    return (
        <div className="relative w-32 h-32">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
                <circle
                    cx="64"
                    cy="64"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-gray-200 dark:text-slate-700"
                />
                <circle
                    cx="64"
                    cy="64"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeLinecap="round"
                    className={`transition-all duration-1000 ${getStrokeColor(score)}`}
                    style={{
                        strokeDasharray: circumference,
                        strokeDashoffset: strokeDashoffset,
                    }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</span>
                <span className="text-xs text-gray-500 dark:text-slate-400">/ 100</span>
            </div>
        </div>
    )
}

// Privacy Consent Modal
function PrivacyConsentModal({
    isOpen,
    onClose,
    onConfirm,
    isLoading
}: {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    isLoading?: boolean
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Privacy & Data Sharing
                </h3>
                <p className="text-gray-600 dark:text-slate-400 mb-4">
                    By publishing this assessment to the contractor marketplace, you agree to share:
                </p>
                <ul className="text-sm text-gray-600 dark:text-slate-400 space-y-2 mb-6">
                    <li className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Assessment photos and AI analysis results
                    </li>
                    <li className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        General location (city/zip, not exact address)
                    </li>
                    <li className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                        </svg>
                        Contact info shared only after contractor purchase
                    </li>
                </ul>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 font-medium text-gray-900 dark:text-white transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 font-medium text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Publishing...
                            </>
                        ) : (
                            'Publish Lead'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

// Cost Estimate Card
function CostEstimateCard({ min, max }: { min?: number; max?: number }) {
    if (!min && !max) return null

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount)
    }

    return (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-green-50 dark:from-green-500/10 to-emerald-50 dark:to-emerald-500/10 border border-green-200 dark:border-green-500/30">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">
                    Estimated Project Cost
                </h3>
            </div>
            <div className="text-3xl font-bold text-green-700 dark:text-green-200">
                {min && max ? (
                    <>{formatCurrency(min)} - {formatCurrency(max)}</>
                ) : min ? (
                    <>From {formatCurrency(min)}</>
                ) : max ? (
                    <>Up to {formatCurrency(max)}</>
                ) : null}
            </div>
            <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                Based on AI analysis of recommended modifications
            </p>
        </div>
    )
}

export default function AssessmentPage() {
    const [images, setImages] = useState<UploadedImage[]>([])
    const [roomType, setRoomType] = useState('bathroom')
    const [selectedStyle, setSelectedStyle] = useState('modern')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [assessmentStatus, setAssessmentStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle')
    const [showARCamera, setShowARCamera] = useState(false)
    const [showMeasurements, setShowMeasurements] = useState(false)
    const [isConvertingHeic, setIsConvertingHeic] = useState(false)
    const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null)
    const [errorMessage, setErrorMessage] = useState('')
    const [projectId, setProjectId] = useState<string | null>(null)
    const [showPrivacyModal, setShowPrivacyModal] = useState(false)
    const [isPublishing, setIsPublishing] = useState(false)
    const [publishSuccess, setPublishSuccess] = useState(false)
    const [showFeedbackModal, setShowFeedbackModal] = useState(false)
    const [processingProgress, setProcessingProgress] = useState(0)
    const router = useRouter()
    const supabase = createClient()

    // Show feedback modal after user has engaged with results (published or starting new)
    useEffect(() => {
        if (publishSuccess) {
            // Show feedback after successfully publishing to marketplace
            const timer = setTimeout(() => setShowFeedbackModal(true), 1500)
            return () => clearTimeout(timer)
        }
    }, [publishSuccess])

    // Simulate progress during processing
    useEffect(() => {
        if (assessmentStatus === 'uploading' || assessmentStatus === 'processing') {
            setProcessingProgress(0)
            const interval = setInterval(() => {
                setProcessingProgress(prev => {
                    // Uploading phase: 0-30%
                    if (assessmentStatus === 'uploading') {
                        return Math.min(prev + 2, 30)
                    }
                    // Processing phase: 30-95% (never quite reaches 100 until complete)
                    return Math.min(prev + 1, 95)
                })
            }, 500)
            return () => clearInterval(interval)
        } else if (assessmentStatus === 'complete') {
            setProcessingProgress(100)
        }
    }, [assessmentStatus])

    // Get the first uploaded image URL for the comparison view
    const getFirstImageUrl = useCallback(() => {
        if (images.length > 0 && images[0].storagePath) {
            const { data } = supabase.storage
                .from('assessment-media')
                .getPublicUrl(images[0].storagePath)
            return data.publicUrl
        }
        return images[0]?.preview || ''
    }, [images, supabase])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
        addFiles(files)
    }, [])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'))
            addFiles(files)
        }
    }

    const addFiles = async (files: File[]) => {
        setIsConvertingHeic(true)
        const processedImages: UploadedImage[] = []

        for (const file of files) {
            try {
                // Validate file
                const validation = await validateImageFile(file, { maxSizeMB: 10 })
                if (!validation.valid) {
                    console.warn(`Skipping file ${file.name}: ${validation.error}`)
                    continue
                }

                // Convert HEIC/HEIF files (common from iOS)
                let processedFile = file
                if (isHeicFile(file)) {
                    try {
                        processedFile = await convertHeicToJpeg(file)
                    } catch (conversionError) {
                        console.error('HEIC conversion failed:', conversionError)
                        // Still add original if conversion fails
                    }
                }

                processedImages.push({
                    file: processedFile,
                    preview: URL.createObjectURL(processedFile),
                    uploading: false,
                    uploaded: false
                })
            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error)
            }
        }

        setIsConvertingHeic(false)
        setImages(prev => [...prev, ...processedImages])
    }

    const removeImage = (index: number) => {
        setImages(prev => {
            const newImages = [...prev]
            URL.revokeObjectURL(newImages[index].preview)
            newImages.splice(index, 1)
            return newImages
        })
    }

    const handleSubmit = async () => {
        if (images.length === 0) return

        setIsSubmitting(true)
        setAssessmentStatus('uploading')
        setErrorMessage('')

        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            // Create a project first
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .insert({
                    homeowner_id: user.id,
                    title: `${roomType.charAt(0).toUpperCase() + roomType.slice(1)} Assessment`,
                    description: `AI Safety Assessment for ${roomType}`,
                    address: { street: '', city: '', state: '', zip: '' },
                    status: 'draft'
                })
                .select()
                .single()

            if (projectError) throw projectError
            setProjectId(project.id)

            // Create AR assessment record
            const { data: assessment, error: assessmentError } = await supabase
                .from('ar_assessments')
                .insert({
                    project_id: project.id,
                    room_type: roomType,
                    status: 'pending'
                })
                .select()
                .single()

            if (assessmentError) throw assessmentError

            // Upload images to Supabase Storage
            const uploadedPaths: string[] = []

            for (let i = 0; i < images.length; i++) {
                const image = images[i]
                const fileName = `${project.id}/${Date.now()}-${i}.${image.file.name.split('.').pop()}`

                setImages(prev => prev.map((img, idx) =>
                    idx === i ? { ...img, uploading: true } : img
                ))

                const { error: uploadError } = await supabase.storage
                    .from('assessment-media')
                    .upload(fileName, image.file)

                if (uploadError) throw uploadError

                uploadedPaths.push(fileName)

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('assessment-media')
                    .getPublicUrl(fileName)

                // Store media reference in database
                await supabase.from('assessment_media').insert({
                    assessment_id: assessment.id,
                    storage_path: fileName,
                    media_type: 'image'
                })

                setImages(prev => prev.map((img, idx) =>
                    idx === i ? { ...img, uploading: false, uploaded: true, storagePath: fileName, publicUrl: urlData.publicUrl } : img
                ))
            }

            setAssessmentStatus('processing')

            // Call the Edge Function to process the assessment
            const { error: fnError } = await supabase.functions.invoke('process-ar-assessment', {
                body: {
                    assessmentId: assessment.id,
                    imagePaths: uploadedPaths
                }
            })

            if (fnError) throw fnError

            // Subscribe to real-time updates for this assessment
            const channel = supabase
                .channel(`assessment-${assessment.id}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'ar_assessments',
                    filter: `id=eq.${assessment.id}`
                }, (payload) => {
                    if (payload.new.status === 'completed') {
                        setAssessmentResult(payload.new as AssessmentResult)
                        setAssessmentStatus('complete')
                        channel.unsubscribe()
                    } else if (payload.new.status === 'failed') {
                        setErrorMessage(payload.new.error_message || 'Analysis failed')
                        setAssessmentStatus('error')
                        channel.unsubscribe()
                    }
                })
                .subscribe()

            // Poll as backup (in case realtime doesn't work)
            const pollInterval = setInterval(async () => {
                const { data: updatedAssessment } = await supabase
                    .from('ar_assessments')
                    .select('*')
                    .eq('id', assessment.id)
                    .single()

                if (updatedAssessment?.status === 'completed') {
                    setAssessmentResult(updatedAssessment as AssessmentResult)
                    setAssessmentStatus('complete')
                    clearInterval(pollInterval)
                    channel.unsubscribe()
                } else if (updatedAssessment?.status === 'failed') {
                    setErrorMessage(updatedAssessment.error_message || 'Analysis failed')
                    setAssessmentStatus('error')
                    clearInterval(pollInterval)
                    channel.unsubscribe()
                }
            }, 3000)

            // Cleanup after 2 minutes
            setTimeout(() => {
                clearInterval(pollInterval)
                channel.unsubscribe()
            }, 120000)

        } catch (error: any) {
            setErrorMessage(error.message || 'An error occurred')
            setAssessmentStatus('error')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handlePublishLead = async () => {
        if (!assessmentResult || !projectId) return

        setIsPublishing(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            // Create a lead from the assessment
            const leadData = {
                homeowner_id: user.id,
                project_id: projectId,
                assessment_id: assessmentResult.id,
                title: `${roomType.charAt(0).toUpperCase() + roomType.slice(1)} Accessibility Modification`,
                description: assessmentResult.recommendations?.map(r => r.recommendation).join(', ') || 'Home safety assessment',
                location: 'Location TBD', // Would come from user profile
                scope_tags: assessmentResult.recommendations?.map(r => r.recommendation).slice(0, 5) || [],
                estimated_value: assessmentResult.cost_estimate_max || assessmentResult.cost_estimate_min || 5000,
                price: Math.round((assessmentResult.cost_estimate_min || 100) * 0.05), // 5% of min estimate as lead price
                status: 'available',
                preview_image_url: images[0]?.publicUrl || images[0]?.preview,
                accessibility_score: assessmentResult.accessibility_score,
            }

            const { error: leadError } = await supabase
                .from('leads')
                .insert(leadData)

            if (leadError) throw leadError

            // Update project status
            await supabase
                .from('projects')
                .update({ status: 'published' })
                .eq('id', projectId)

            setPublishSuccess(true)
            setShowPrivacyModal(false)

        } catch (error: any) {
            setErrorMessage(error.message || 'Failed to publish lead')
        } finally {
            setIsPublishing(false)
        }
    }

    // Add hazard positions based on area descriptions (simulated for demo)
    const hazardsWithPositions = assessmentResult?.identified_hazards?.map((hazard, index) => ({
        ...hazard,
        severity: hazard.severity || (['High', 'Medium', 'Low'][index % 3] as 'High' | 'Medium' | 'Low'),
        position: hazard.position || {
            x: 20 + (index * 25) % 60,
            y: 30 + (index * 20) % 40
        }
    }))

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white p-4 md:p-8 transition-colors">
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
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                        {assessmentStatus === 'complete' ? 'Assessment Results' : 'Start Safety Assessment'}
                    </h1>
                    <p className="text-gray-600 dark:text-slate-400 mt-2">
                        {assessmentStatus === 'complete'
                            ? 'Review your AI-powered safety analysis and recommendations.'
                            : 'Upload photos of your room and our AI will analyze it for accessibility hazards.'}
                    </p>
                </div>

                {assessmentStatus === 'idle' && (
                    <>
                        {/* Room Type Selection */}
                        <div className="mb-8">
                            <label className="block text-sm font-medium mb-3 text-gray-900 dark:text-white">Room Type</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {['bathroom', 'bedroom', 'kitchen', 'living room', 'entryway', 'stairs', 'hallway', 'other'].map((room) => (
                                    <button
                                        key={room}
                                        onClick={() => setRoomType(room)}
                                        className={`p-3 rounded-xl border transition-all ${roomType === room
                                            ? 'bg-blue-50 dark:bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300'
                                            : 'bg-white dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 text-gray-700 dark:text-slate-300'
                                            }`}
                                    >
                                        {room.charAt(0).toUpperCase() + room.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Style Selector */}
                        <div className="mb-8">
                            <label className="block text-sm font-medium mb-3 text-gray-900 dark:text-white">Renovation Style</label>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                                Choose a style for AI-generated renovation previews
                            </p>
                            <StyleSelector
                                selectedStyle={selectedStyle}
                                onStyleSelect={(style) => setSelectedStyle(style.id)}
                                showPreview={true}
                            />
                        </div>

                        {/* AR Camera Option */}
                        <div className="mb-8 p-4 rounded-2xl bg-gradient-to-br from-purple-50 dark:from-purple-500/10 to-blue-50 dark:to-blue-500/10 border border-purple-200 dark:border-purple-500/30">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-purple-800 dark:text-purple-200">AR Camera Mode</h3>
                                        <p className="text-sm text-purple-600 dark:text-purple-300">Live hazard detection with your camera</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowARCamera(true)}
                                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-medium rounded-lg transition-all"
                                >
                                    Open Camera
                                </button>
                            </div>
                        </div>

                        {/* Upload Area */}


                        {/* Upload Area */}
                        <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            className="border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-blue-500/50 dark:hover:border-blue-500/50 rounded-2xl p-12 text-center transition-colors bg-white dark:bg-slate-900/50"
                        >
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <p className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Drag and drop photos here</p>
                            <p className="text-gray-500 dark:text-slate-400 mb-4">or</p>
                            <label className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-full font-medium cursor-pointer transition-all text-white">
                                Browse Files
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                            </label>
                            <p className="text-sm text-gray-400 dark:text-slate-500 mt-4">
                                Supported formats: JPG, PNG, WebP, HEIC (Max 10MB each)
                            </p>
                        </div>

                        {/* Preview Grid */}
                        {images.length > 0 && (
                            <div className="mt-8">
                                <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Uploaded Images ({images.length})</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {images.map((image, index) => (
                                        <div key={index} className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
                                            <img
                                                src={image.preview}
                                                alt={`Upload ${index + 1}`}
                                                className="w-full h-32 object-cover"
                                            />
                                            <button
                                                title="Remove image"
                                                onClick={() => removeImage(index)}
                                                className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                            {image.uploading && (
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                    <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                                </div>
                                            )}
                                            {image.uploaded && (
                                                <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-500/80 rounded text-xs text-white">
                                                    ✓ Uploaded
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        {images.length > 0 && (
                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 rounded-full font-semibold text-lg transition-all text-white"
                                >
                                    {isSubmitting ? 'Processing...' : 'Start AI Analysis'}
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* Processing State - Cinematic Loader */}
                {(assessmentStatus === 'uploading' || assessmentStatus === 'processing') && (
                    <CinematicAnalysisLoader
                        status={assessmentStatus}
                        progress={processingProgress}
                    />
                )}

                {/* Error State */}
                {assessmentStatus === 'error' && (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                            <svg className="w-10 h-10 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold mb-2 text-red-600 dark:text-red-400">Analysis Failed</h2>
                        <p className="text-gray-600 dark:text-slate-400 mb-6">{errorMessage}</p>
                        <button
                            onClick={() => {
                                setAssessmentStatus('idle')
                                setImages([])
                            }}
                            className="px-6 py-3 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full font-medium text-gray-900 dark:text-white transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Results State */}
                {assessmentStatus === 'complete' && assessmentResult && (
                    <div className="space-y-8">
                        {/* Score and Image Section */}
                        <div className="grid md:grid-cols-3 gap-6">
                            {/* Score Card */}
                            <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center">
                                <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-4">Safety Score</h3>
                                <CircularScore score={assessmentResult.accessibility_score || 0} />
                                <p className="text-sm text-gray-500 dark:text-slate-400 mt-4 text-center">
                                    {assessmentResult.accessibility_score >= 80 ? 'Good condition' :
                                        assessmentResult.accessibility_score >= 60 ? 'Needs attention' :
                                            assessmentResult.accessibility_score >= 40 ? 'Requires modifications' :
                                                'Urgent improvements needed'}
                                </p>
                            </div>

                            {/* Image Comparison */}
                            <div className="md:col-span-2">
                                <ImageComparison
                                    beforeUrl={getFirstImageUrl()}
                                    afterUrl={assessmentResult.fal_ai_visualization_urls?.[0]}
                                    hazards={hazardsWithPositions}
                                />
                            </div>
                        </div>

                        {/* Cost Estimate */}
                        <CostEstimateCard
                            min={assessmentResult.cost_estimate_min || assessmentResult.gemini_analysis_raw?.cost_estimate_min}
                            max={assessmentResult.cost_estimate_max || assessmentResult.gemini_analysis_raw?.cost_estimate_max}
                        />

                        {/* Hazards Section */}
                        {hazardsWithPositions && hazardsWithPositions.length > 0 && (
                            <div>
                                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                                    <span className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </span>
                                    Identified Hazards ({hazardsWithPositions.length})
                                </h3>
                                <div className="space-y-3">
                                    {hazardsWithPositions.map((hazard, index) => (
                                        <div key={index} className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                                            <div className="flex items-start gap-3">
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${hazard.severity === 'High' ? 'bg-red-500' :
                                                        hazard.severity === 'Medium' ? 'bg-amber-500' : 'bg-blue-500'
                                                    }`}>
                                                    {index + 1}
                                                </span>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-medium text-gray-900 dark:text-white">{hazard.hazard}</span>
                                                        <PriorityBadge priority={hazard.severity} />
                                                    </div>
                                                    <p className="text-gray-600 dark:text-slate-400 text-sm mt-1">{hazard.details}</p>
                                                    {hazard.area && (
                                                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">Area: {hazard.area}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recommendations Section */}
                        {assessmentResult.recommendations && assessmentResult.recommendations.length > 0 && (
                            <div>
                                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                                    <span className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </span>
                                    Recommendations ({assessmentResult.recommendations.length})
                                </h3>
                                <div className="space-y-3">
                                    {assessmentResult.recommendations.map((rec, index) => (
                                        <div key={index} className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-medium text-green-700 dark:text-green-300">{rec.recommendation}</span>
                                                        <PriorityBadge priority={rec.priority} />
                                                    </div>
                                                    <p className="text-gray-600 dark:text-slate-400 text-sm mt-1">{rec.details}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Materials Needed */}
                        {assessmentResult.materials_needed && assessmentResult.materials_needed.length > 0 && (
                            <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Materials Needed</h3>
                                <div className="flex flex-wrap gap-2">
                                    {assessmentResult.materials_needed.map((material, index) => (
                                        <span
                                            key={index}
                                            className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-sm"
                                        >
                                            {material}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-4 pt-4 flex-wrap">
                            <button
                                onClick={() => {
                                    setAssessmentStatus('idle')
                                    setImages([])
                                    setAssessmentResult(null)
                                    setProjectId(null)
                                    setPublishSuccess(false)
                                }}
                                className="px-6 py-3 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full font-medium text-gray-900 dark:text-white transition-colors"
                            >
                                Start New Assessment
                            </button>
                            <button
                                onClick={() => setShowMeasurements(true)}
                                className="px-6 py-3 bg-purple-100 dark:bg-purple-500/20 hover:bg-purple-200 dark:hover:bg-purple-500/30 rounded-full font-medium text-purple-700 dark:text-purple-300 transition-colors flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                                Measure Distances
                            </button>
                            {!publishSuccess ? (
                                <button
                                    onClick={() => setShowPrivacyModal(true)}
                                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-full font-medium text-white flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                    Publish to Marketplace
                                </button>
                            ) : (
                                <div className="px-6 py-3 bg-green-100 dark:bg-green-500/20 rounded-full font-medium text-green-700 dark:text-green-300 flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Published to Marketplace!
                                </div>
                            )}
                            <button
                                onClick={() => router.push('/dashboard/marketplace')}
                                className="px-6 py-3 border border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 rounded-full font-medium text-gray-700 dark:text-slate-300 transition-colors"
                            >
                                View Marketplace
                            </button>
                        </div>
                    </div>
                )}

                {/* Privacy Modal */}
                <PrivacyConsentModal
                    isOpen={showPrivacyModal}
                    onClose={() => setShowPrivacyModal(false)}
                    onConfirm={handlePublishLead}
                    isLoading={isPublishing}
                />

                {/* Feedback Modal */}
                <FeedbackModal
                    isOpen={showFeedbackModal}
                    onClose={() => setShowFeedbackModal(false)}
                    assessmentId={assessmentResult?.id}
                    onSubmit={async (data) => {
                        try {
                            await fetch('/api/feedback', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            })
                        } catch (error) {
                            console.error('Failed to submit feedback:', error)
                        }
                    }}
                />

                {/* AR Camera Mode */}
                <ARCameraMode
                    isOpen={showARCamera}
                    onClose={() => setShowARCamera(false)}
                    onCapture={(imageData, detectedHazards) => {
                        // Convert base64 to blob and create file
                        fetch(imageData)
                            .then(res => res.blob())
                            .then(blob => {
                                const file = new File([blob], `ar-capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
                                addFiles([file])
                                setShowARCamera(false)
                            })
                    }}
                    enableLiveDetection={true}
                />

                {/* Measurements Overlay Modal */}
                {showMeasurements && assessmentResult && getFirstImageUrl() && (
                    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Measure Distances</h3>
                                <button
                                    onClick={() => setShowMeasurements(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <MeasurementsOverlay
                                imageUrl={getFirstImageUrl()}
                                unit="inches"
                                onMeasurementsChange={(measurements) => {
                                    console.log('Measurements updated:', measurements)
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* HEIC Conversion Loading */}
                {isConvertingHeic && (
                    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 text-center">
                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-gray-900 dark:text-white font-medium">Converting iOS photos...</p>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">This may take a moment</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
