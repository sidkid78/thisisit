'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

interface UploadedImage {
    file: File
    preview: string
    uploading: boolean
    uploaded: boolean
    storagePath?: string
}

export default function AssessmentPage() {
    const [images, setImages] = useState<UploadedImage[]>([])
    const [roomType, setRoomType] = useState('bathroom')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [assessmentStatus, setAssessmentStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle')
    const [assessmentResult, setAssessmentResult] = useState<any>(null)
    const [errorMessage, setErrorMessage] = useState('')
    const router = useRouter()
    const supabase = createClient()

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

    const addFiles = (files: File[]) => {
        const newImages: UploadedImage[] = files.map(file => ({
            file,
            preview: URL.createObjectURL(file),
            uploading: false,
            uploaded: false
        }))
        setImages(prev => [...prev, ...newImages])
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

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('assessment-media')
                    .upload(fileName, image.file)

                if (uploadError) throw uploadError

                uploadedPaths.push(fileName)

                // Store media reference in database
                await supabase.from('assessment_media').insert({
                    assessment_id: assessment.id,
                    storage_path: fileName,
                    media_type: 'image'
                })

                setImages(prev => prev.map((img, idx) =>
                    idx === i ? { ...img, uploading: false, uploaded: true, storagePath: fileName } : img
                ))
            }

            setAssessmentStatus('processing')

            // Call the Edge Function to process the assessment
            const { data: fnData, error: fnError } = await supabase.functions.invoke('process-ar-assessment', {
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
                        setAssessmentResult(payload.new)
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
                    setAssessmentResult(updatedAssessment)
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

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="text-slate-400 hover:text-white mb-4 flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                        Start Safety Assessment
                    </h1>
                    <p className="text-slate-400 mt-2">
                        Upload photos of your room and our AI will analyze it for accessibility hazards.
                    </p>
                </div>

                {assessmentStatus === 'idle' && (
                    <>
                        {/* Room Type Selection */}
                        <div className="mb-8">
                            <label className="block text-sm font-medium mb-3">Room Type</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {['bathroom', 'bedroom', 'kitchen', 'living room', 'entryway', 'stairs', 'hallway', 'other'].map((room) => (
                                    <button
                                        key={room}
                                        onClick={() => setRoomType(room)}
                                        className={`p-3 rounded-xl border transition-all ${roomType === room
                                            ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                                            }`}
                                    >
                                        {room.charAt(0).toUpperCase() + room.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Upload Area */}
                        <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            className="border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-2xl p-12 text-center transition-colors bg-slate-900/50"
                        >
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <p className="text-lg font-medium mb-2">Drag and drop photos here</p>
                            <p className="text-slate-400 mb-4">or</p>
                            <label className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-full font-medium cursor-pointer transition-all">
                                Browse Files
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                            </label>
                            <p className="text-sm text-slate-500 mt-4">
                                Supported formats: JPG, PNG, WebP (Max 10MB each)
                            </p>
                        </div>

                        {/* Preview Grid */}
                        {images.length > 0 && (
                            <div className="mt-8">
                                <h3 className="text-lg font-medium mb-4">Uploaded Images ({images.length})</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {images.map((image, index) => (
                                        <div key={index} className="relative group rounded-xl overflow-hidden border border-slate-700">
                                            <img
                                                src={image.preview}
                                                alt={`Upload ${index + 1}`}
                                                className="w-full h-32 object-cover"
                                            />
                                            <button
                                                title="Remove image"
                                                onClick={() => removeImage(index)}
                                                className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
                                                <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-500/80 rounded text-xs">
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
                                    className="px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 rounded-full font-semibold text-lg transition-all"
                                >
                                    {isSubmitting ? 'Processing...' : 'Start AI Analysis'}
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* Processing State */}
                {(assessmentStatus === 'uploading' || assessmentStatus === 'processing') && (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">
                            {assessmentStatus === 'uploading' ? 'Uploading Images...' : 'AI is Analyzing Your Room...'}
                        </h2>
                        <p className="text-slate-400">
                            {assessmentStatus === 'uploading'
                                ? 'Please wait while we upload your photos'
                                : 'This may take a minute. We\'re identifying hazards and generating recommendations.'}
                        </p>
                    </div>
                )}

                {/* Error State */}
                {assessmentStatus === 'error' && (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold mb-2 text-red-400">Analysis Failed</h2>
                        <p className="text-slate-400 mb-6">{errorMessage}</p>
                        <button
                            onClick={() => {
                                setAssessmentStatus('idle')
                                setImages([])
                            }}
                            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-full font-medium"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Results State */}
                {assessmentStatus === 'complete' && assessmentResult && (
                    <div className="space-y-8">
                        {/* Score Card */}
                        <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold">Safety Assessment Results</h2>
                                <div className="text-right">
                                    <div className="text-sm text-slate-400">Overall Score</div>
                                    <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                                        {assessmentResult.accessibility_score}<span className="text-lg text-slate-400">/100</span>
                                    </div>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-1000"
                                    style={{ width: `${assessmentResult.accessibility_score}%` }}
                                />
                            </div>
                        </div>

                        {/* Hazards */}
                        {assessmentResult.identified_hazards && assessmentResult.identified_hazards.length > 0 && (
                            <div>
                                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-sm">⚠</span>
                                    Identified Hazards
                                </h3>
                                <div className="space-y-3">
                                    {assessmentResult.identified_hazards.map((hazard: any, index: number) => (
                                        <div key={index} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                                            <div className="font-medium text-amber-300">{hazard.hazard}</div>
                                            <div className="text-slate-400 text-sm mt-1">{hazard.details}</div>
                                            {hazard.area && <div className="text-xs text-slate-500 mt-2">Area: {hazard.area}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recommendations */}
                        {assessmentResult.recommendations && assessmentResult.recommendations.length > 0 && (
                            <div>
                                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-sm">✓</span>
                                    Recommendations
                                </h3>
                                <div className="space-y-3">
                                    {assessmentResult.recommendations.map((rec: any, index: number) => (
                                        <div key={index} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                                            <div className="font-medium text-green-300">{rec.recommendation}</div>
                                            <div className="text-slate-400 text-sm mt-1">{rec.details}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <button
                                onClick={() => {
                                    setAssessmentStatus('idle')
                                    setImages([])
                                    setAssessmentResult(null)
                                }}
                                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-full font-medium"
                            >
                                Start New Assessment
                            </button>
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-full font-medium"
                            >
                                Find Contractors
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
