'use client'

import { useState, useEffect, useRef } from 'react'
import { Scan, Sparkles, Shield, CheckCircle, AlertTriangle } from 'lucide-react'

interface CinematicAnalysisLoaderProps {
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error'
  progress?: number
  videoSrc?: string
  fallbackToAnimation?: boolean
  onVideoError?: () => void
  roomType?: string
}

const ANALYSIS_STAGES = [
  { icon: Scan, label: 'Scanning image...', duration: 2000 },
  { icon: Sparkles, label: 'Analyzing accessibility features...', duration: 3000 },
  { icon: Shield, label: 'Identifying hazards...', duration: 2500 },
  { icon: CheckCircle, label: 'Generating recommendations...', duration: 2000 },
]

export function CinematicAnalysisLoader({
  status,
  progress = 0,
  videoSrc,
  fallbackToAnimation = true,
  onVideoError,
  roomType
}: CinematicAnalysisLoaderProps) {
  const [currentStage, setCurrentStage] = useState(0)
  const [videoFailed, setVideoFailed] = useState(false)
  const [dots, setDots] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)

  // Animate through stages when processing
  useEffect(() => {
    if (status !== 'processing') {
      setCurrentStage(0)
      return
    }

    const advanceStage = () => {
      setCurrentStage(prev => (prev + 1) % ANALYSIS_STAGES.length)
    }

    const interval = setInterval(advanceStage, ANALYSIS_STAGES[currentStage]?.duration || 2000)
    return () => clearInterval(interval)
  }, [status, currentStage])

  // Animate loading dots
  useEffect(() => {
    if (status !== 'processing' && status !== 'uploading') return

    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'))
    }, 400)

    return () => clearInterval(interval)
  }, [status])

  // Handle video error
  const handleVideoError = () => {
    setVideoFailed(true)
    onVideoError?.()
  }

  const useVideo = videoSrc && !videoFailed && !fallbackToAnimation

  if (status === 'idle') return null

  if (status === 'complete') {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-scale-in">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <div className="absolute inset-0 rounded-full bg-green-400/20 animate-ping" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
          Analysis Complete!
        </h3>
        <p className="text-gray-500 dark:text-slate-400 text-sm">
          Your accessibility report is ready.
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
          Analysis Failed
        </h3>
        <p className="text-gray-500 dark:text-slate-400 text-sm">
          Something went wrong. Please try again.
        </p>
      </div>
    )
  }

  const CurrentIcon = ANALYSIS_STAGES[currentStage]?.icon || Scan
  const currentLabel = ANALYSIS_STAGES[currentStage]?.label || 'Processing...'

  return (
    <div className="relative flex flex-col items-center justify-center p-8 min-h-[300px]">
      {/* Video Background (if available) */}
      {useVideo && (
        <video
          ref={videoRef}
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          onError={handleVideoError}
          className="absolute inset-0 w-full h-full object-cover opacity-30 rounded-xl"
        />
      )}

      {/* Animated Background Gradients */}
      <div className="absolute inset-0 overflow-hidden rounded-xl">
        <div className="absolute -inset-[100%] animate-spin-slow">
          <div className="absolute top-1/2 left-1/2 w-[200%] h-[200%] bg-gradient-conic from-blue-500/20 via-purple-500/20 to-blue-500/20 blur-3xl" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Scanner Animation */}
        <div className="relative w-32 h-32 mb-6">
          {/* Outer Ring */}
          <div className="absolute inset-0 rounded-full border-4 border-blue-200/30 dark:border-blue-800/30" />
          
          {/* Spinning Ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="290"
              strokeDashoffset={290 - (progress / 100) * 290}
              className="text-blue-500 dark:text-blue-400 transition-all duration-500"
            />
          </svg>

          {/* Pulsing Inner Circle */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 dark:from-blue-400/20 dark:to-purple-400/20 animate-pulse" />
          
          {/* Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <CurrentIcon className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-pulse" />
          </div>

          {/* Scanning Line */}
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-scan" />
          </div>
        </div>

        {/* Status Text */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {status === 'uploading' ? 'Uploading image' : 'Analyzing'}{dots}
          </h3>
          <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">
            {status === 'uploading' ? 'Please wait...' : currentLabel}
          </p>
          {roomType && (
            <p className="text-gray-500 dark:text-slate-400 text-xs">
              Room type: {roomType}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-48 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mt-6 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
          {progress > 0 ? `${Math.round(progress)}% complete` : 'Starting analysis...'}
        </p>

        {/* Stage Indicators */}
        <div className="flex items-center gap-2 mt-6">
          {ANALYSIS_STAGES.map((stage, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentStage
                  ? 'w-6 bg-blue-500 dark:bg-blue-400'
                  : index < currentStage
                  ? 'bg-green-500 dark:bg-green-400'
                  : 'bg-gray-300 dark:bg-slate-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-blue-400/50 rounded-full animate-float"
            style={{
              left: `${20 + i * 15}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + i * 0.5}s`
            }}
          />
        ))}
      </div>
    </div>
  )
}

// Add these to your global CSS
const styles = `
@keyframes scan {
  0%, 100% { transform: translateY(-100%); opacity: 0; }
  50% { transform: translateY(5000%); opacity: 1; }
}

@keyframes float {
  0%, 100% { transform: translateY(100%) scale(0); opacity: 0; }
  10% { opacity: 1; }
  50% { transform: translateY(-50vh) scale(1); opacity: 0.5; }
  90% { opacity: 0; }
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes scale-in {
  0% { transform: scale(0); }
  80% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.animate-scan { animation: scan 2s ease-in-out infinite; }
.animate-float { animation: float 4s ease-in-out infinite; }
.animate-spin-slow { animation: spin-slow 20s linear infinite; }
.animate-scale-in { animation: scale-in 0.5s ease-out forwards; }
`
