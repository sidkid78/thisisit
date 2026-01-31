'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { 
    Camera, 
    X, 
    Zap, 
    AlertTriangle, 
    CheckCircle,
    RotateCcw,
    Sun,
    Grid3X3,
    Focus,
    Maximize2,
    Download
} from 'lucide-react'

interface DetectedHazard {
    id: string
    type: string
    label: string
    confidence: number
    boundingBox: {
        x: number
        y: number
        width: number
        height: number
    }
    severity: 'low' | 'medium' | 'high'
}

interface ARCameraModeProps {
    isOpen: boolean
    onClose: () => void
    onCapture: (imageData: string, detectedHazards: DetectedHazard[]) => void
    onDetection?: (hazards: DetectedHazard[]) => void
    enableLiveDetection?: boolean
    detectionInterval?: number // ms between detections
}

export function ARCameraMode({
    isOpen,
    onClose,
    onCapture,
    onDetection,
    enableLiveDetection = true,
    detectionInterval = 2000
}: ARCameraModeProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
    const [detectedHazards, setDetectedHazards] = useState<DetectedHazard[]>([])
    const [isDetecting, setIsDetecting] = useState(false)
    const [showGrid, setShowGrid] = useState(false)
    const [flashEnabled, setFlashEnabled] = useState(false)
    const [isCapturing, setIsCapturing] = useState(false)

    // Start camera
    const startCamera = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            // Stop existing stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop())
            }

            const constraints: MediaStreamConstraints = {
                video: {
                    facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            }

            const stream = await navigator.mediaDevices.getUserMedia(constraints)
            streamRef.current = stream

            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play()
            }

            setIsLoading(false)
        } catch (err) {
            console.error('Camera error:', err)
            setError(
                err instanceof Error && err.name === 'NotAllowedError'
                    ? 'Camera access denied. Please enable camera permissions.'
                    : 'Unable to access camera. Please check your device settings.'
            )
            setIsLoading(false)
        }
    }, [facingMode])

    // Stop camera
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
    }, [])

    // Toggle camera facing
    const toggleCamera = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
    }

    // Simulate hazard detection (in production, this would call an AI model)
    const detectHazards = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || isDetecting) return

        setIsDetecting(true)

        try {
            const video = videoRef.current
            const canvas = canvasRef.current
            const ctx = canvas.getContext('2d')

            if (!ctx) return

            // Set canvas size to match video
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight

            // Draw current frame
            ctx.drawImage(video, 0, 0)

            // Get image data for analysis
            const imageData = canvas.toDataURL('image/jpeg', 0.8)

            // In production, send to AI endpoint for detection
            // For now, simulate detection with random hazards
            const mockHazards: DetectedHazard[] = simulateDetection(canvas.width, canvas.height)

            setDetectedHazards(mockHazards)
            onDetection?.(mockHazards)

            // Draw detection overlay
            drawDetectionOverlay(mockHazards)
        } catch (err) {
            console.error('Detection error:', err)
        } finally {
            setIsDetecting(false)
        }
    }, [isDetecting, onDetection])

    // Simulate detection (replace with actual AI call in production)
    const simulateDetection = (width: number, height: number): DetectedHazard[] => {
        // Only generate hazards occasionally for demo
        if (Math.random() > 0.3) return []

        const hazardTypes = [
            { type: 'trip_hazard', label: 'Trip Hazard', severity: 'high' as const },
            { type: 'poor_lighting', label: 'Low Lighting', severity: 'medium' as const },
            { type: 'missing_grab_bar', label: 'Missing Grab Bar', severity: 'high' as const },
            { type: 'slippery_surface', label: 'Slippery Surface', severity: 'medium' as const },
            { type: 'narrow_doorway', label: 'Narrow Doorway', severity: 'low' as const },
            { type: 'stairs_no_railing', label: 'Stairs Without Railing', severity: 'high' as const }
        ]

        const hazard = hazardTypes[Math.floor(Math.random() * hazardTypes.length)]
        
        return [{
            id: `hazard-${Date.now()}`,
            ...hazard,
            confidence: 0.7 + Math.random() * 0.25,
            boundingBox: {
                x: Math.random() * (width - 200) + 50,
                y: Math.random() * (height - 150) + 50,
                width: 150 + Math.random() * 100,
                height: 100 + Math.random() * 80
            }
        }]
    }

    // Draw detection boxes on overlay canvas
    const drawDetectionOverlay = (hazards: DetectedHazard[]) => {
        if (!overlayCanvasRef.current || !videoRef.current) return

        const canvas = overlayCanvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Match video dimensions
        const video = videoRef.current
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        // Clear previous drawings
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw each hazard
        hazards.forEach(hazard => {
            const { boundingBox, label, confidence, severity } = hazard

            // Color based on severity
            const colors = {
                low: { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.2)' },
                medium: { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.2)' },
                high: { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.2)' }
            }
            const color = colors[severity]

            // Draw bounding box
            ctx.strokeStyle = color.stroke
            ctx.lineWidth = 3
            ctx.fillStyle = color.fill
            ctx.fillRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height)
            ctx.strokeRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height)

            // Draw label background
            ctx.fillStyle = color.stroke
            const labelText = `${label} (${Math.round(confidence * 100)}%)`
            ctx.font = 'bold 14px sans-serif'
            const textMetrics = ctx.measureText(labelText)
            const labelHeight = 24
            const labelPadding = 8

            ctx.fillRect(
                boundingBox.x,
                boundingBox.y - labelHeight - 4,
                textMetrics.width + labelPadding * 2,
                labelHeight
            )

            // Draw label text
            ctx.fillStyle = 'white'
            ctx.fillText(
                labelText,
                boundingBox.x + labelPadding,
                boundingBox.y - 10
            )

            // Draw corner markers
            const markerSize = 15
            ctx.strokeStyle = color.stroke
            ctx.lineWidth = 4

            // Top-left
            ctx.beginPath()
            ctx.moveTo(boundingBox.x, boundingBox.y + markerSize)
            ctx.lineTo(boundingBox.x, boundingBox.y)
            ctx.lineTo(boundingBox.x + markerSize, boundingBox.y)
            ctx.stroke()

            // Top-right
            ctx.beginPath()
            ctx.moveTo(boundingBox.x + boundingBox.width - markerSize, boundingBox.y)
            ctx.lineTo(boundingBox.x + boundingBox.width, boundingBox.y)
            ctx.lineTo(boundingBox.x + boundingBox.width, boundingBox.y + markerSize)
            ctx.stroke()

            // Bottom-left
            ctx.beginPath()
            ctx.moveTo(boundingBox.x, boundingBox.y + boundingBox.height - markerSize)
            ctx.lineTo(boundingBox.x, boundingBox.y + boundingBox.height)
            ctx.lineTo(boundingBox.x + markerSize, boundingBox.y + boundingBox.height)
            ctx.stroke()

            // Bottom-right
            ctx.beginPath()
            ctx.moveTo(boundingBox.x + boundingBox.width - markerSize, boundingBox.y + boundingBox.height)
            ctx.lineTo(boundingBox.x + boundingBox.width, boundingBox.y + boundingBox.height)
            ctx.lineTo(boundingBox.x + boundingBox.width, boundingBox.y + boundingBox.height - markerSize)
            ctx.stroke()
        })
    }

    // Capture photo
    const capturePhoto = async () => {
        if (!videoRef.current || !canvasRef.current) return

        setIsCapturing(true)

        try {
            const video = videoRef.current
            const canvas = canvasRef.current
            const ctx = canvas.getContext('2d')

            if (!ctx) return

            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0)

            // Run final detection on captured image
            await detectHazards()

            const imageData = canvas.toDataURL('image/jpeg', 0.9)
            onCapture(imageData, detectedHazards)

            // Flash effect
            if (flashEnabled) {
                const flash = document.createElement('div')
                flash.className = 'fixed inset-0 bg-white z-50 animate-flash'
                document.body.appendChild(flash)
                setTimeout(() => flash.remove(), 150)
            }
        } finally {
            setIsCapturing(false)
        }
    }

    // Live detection interval
    useEffect(() => {
        if (!enableLiveDetection || !isOpen || isLoading) return

        const interval = setInterval(detectHazards, detectionInterval)
        return () => clearInterval(interval)
    }, [enableLiveDetection, isOpen, isLoading, detectionInterval, detectHazards])

    // Start/stop camera based on isOpen
    useEffect(() => {
        if (isOpen) {
            startCamera()
        } else {
            stopCamera()
            setDetectedHazards([])
        }

        return () => stopCamera()
    }, [isOpen, startCamera, stopCamera])

    // Restart camera when facing mode changes
    useEffect(() => {
        if (isOpen) {
            startCamera()
        }
    }, [facingMode, isOpen, startCamera])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 bg-black">
            {/* Camera view */}
            <div className="relative w-full h-full">
                {/* Video feed */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                />

                {/* Detection overlay */}
                <canvas
                    ref={overlayCanvasRef}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />

                {/* Hidden canvas for capture */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Grid overlay */}
                {showGrid && (
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                            {Array.from({ length: 9 }).map((_, i) => (
                                <div key={i} className="border border-white/30" />
                            ))}
                        </div>
                    </div>
                )}

                {/* Loading overlay */}
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                        <div className="text-center">
                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="mt-4 text-white">Starting camera...</p>
                        </div>
                    </div>
                )}

                {/* Error overlay */}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
                        <div className="text-center max-w-md">
                            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                            <p className="mt-4 text-white">{error}</p>
                            <button
                                onClick={startCamera}
                                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                )}

                {/* Detection indicator */}
                {isDetecting && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-blue-500/80 rounded-full flex items-center gap-2">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        <span className="text-white text-sm font-medium">Scanning...</span>
                    </div>
                )}

                {/* Hazard count */}
                {detectedHazards.length > 0 && (
                    <div className="absolute top-20 right-4 px-3 py-2 bg-red-500/90 rounded-xl">
                        <div className="flex items-center gap-2 text-white">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="font-medium">{detectedHazards.length} hazard{detectedHazards.length !== 1 ? 's' : ''} detected</span>
                        </div>
                    </div>
                )}

                {/* Top controls */}
                <div className="absolute top-4 left-0 right-0 px-4 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowGrid(!showGrid)}
                            className={`w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center text-white
                                ${showGrid ? 'bg-blue-500' : 'bg-black/50'}`}
                        >
                            <Grid3X3 className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setFlashEnabled(!flashEnabled)}
                            className={`w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center text-white
                                ${flashEnabled ? 'bg-yellow-500' : 'bg-black/50'}`}
                        >
                            <Sun className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Bottom controls */}
                <div className="absolute bottom-0 left-0 right-0 p-6 pb-safe">
                    <div className="flex items-center justify-around">
                        {/* Toggle camera */}
                        <button
                            onClick={toggleCamera}
                            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white"
                        >
                            <RotateCcw className="w-6 h-6" />
                        </button>

                        {/* Capture button */}
                        <button
                            onClick={capturePhoto}
                            disabled={isCapturing || isLoading}
                            className="w-20 h-20 rounded-full bg-white flex items-center justify-center
                                disabled:opacity-50 transition-transform active:scale-95"
                        >
                            <div className="w-16 h-16 rounded-full border-4 border-gray-900 flex items-center justify-center">
                                {isCapturing ? (
                                    <div className="w-8 h-8 bg-red-500 rounded animate-pulse" />
                                ) : (
                                    <Camera className="w-8 h-8 text-gray-900" />
                                )}
                            </div>
                        </button>

                        {/* Focus/detection toggle */}
                        <button
                            onClick={detectHazards}
                            disabled={isDetecting}
                            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white"
                        >
                            <Focus className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Hint text */}
                    <p className="text-center text-white/70 text-sm mt-4">
                        Point camera at room to detect safety hazards
                    </p>
                </div>
            </div>
        </div>
    )
}

// Add flash animation to tailwind
// Add to globals.css: @keyframes flash { from { opacity: 1; } to { opacity: 0; } }
// .animate-flash { animation: flash 0.15s ease-out; }
