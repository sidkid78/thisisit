'use client'

import { useState, useEffect } from 'react'
import { 
    CheckCircle, 
    Circle, 
    Clock, 
    FileText, 
    Camera, 
    Search, 
    Wrench, 
    Home,
    ChevronRight,
    Loader2
} from 'lucide-react'

export interface ProjectStage {
    id: string
    name: string
    description: string
    status: 'pending' | 'in_progress' | 'completed' | 'skipped'
    completedAt?: Date
    icon?: React.ReactNode
}

const DEFAULT_STAGES: Omit<ProjectStage, 'status'>[] = [
    {
        id: 'assessment',
        name: 'Assessment',
        description: 'AI safety assessment completed',
        icon: <Camera className="w-4 h-4" />
    },
    {
        id: 'review',
        name: 'Review',
        description: 'Review recommendations',
        icon: <FileText className="w-4 h-4" />
    },
    {
        id: 'published',
        name: 'Published',
        description: 'Listed on marketplace',
        icon: <Search className="w-4 h-4" />
    },
    {
        id: 'matched',
        name: 'Matched',
        description: 'Contractor matched',
        icon: <Wrench className="w-4 h-4" />
    },
    {
        id: 'in_progress',
        name: 'In Progress',
        description: 'Work underway',
        icon: <Clock className="w-4 h-4" />
    },
    {
        id: 'completed',
        name: 'Completed',
        description: 'Project finished',
        icon: <Home className="w-4 h-4" />
    }
]

interface ProjectProgressProps {
    currentStage: string
    stages?: ProjectStage[]
    progress?: number // 0-100 within current stage
    compact?: boolean
    showDescription?: boolean
    onStageClick?: (stageId: string) => void
}

export function ProjectProgress({
    currentStage,
    stages,
    progress = 0,
    compact = false,
    showDescription = true,
    onStageClick
}: ProjectProgressProps) {
    // Build stages with status
    const stagesWithStatus: ProjectStage[] = (stages || DEFAULT_STAGES.map(s => ({ ...s, status: 'pending' as const }))).map((stage, index, arr) => {
        const currentIndex = arr.findIndex(s => s.id === currentStage)
        let status: ProjectStage['status'] = 'pending'
        
        if (index < currentIndex) {
            status = 'completed'
        } else if (index === currentIndex) {
            status = 'in_progress'
        }
        
        return { ...stage, status }
    })

    const currentIndex = stagesWithStatus.findIndex(s => s.id === currentStage)
    const overallProgress = ((currentIndex + (progress / 100)) / stagesWithStatus.length) * 100

    if (compact) {
        return (
            <div className="space-y-2">
                {/* Progress bar */}
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                            style={{ width: `${overallProgress}%` }}
                        />
                    </div>
                    <span className="text-sm font-medium text-gray-600 dark:text-slate-400">
                        {Math.round(overallProgress)}%
                    </span>
                </div>
                {/* Current stage */}
                <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        {stagesWithStatus[currentIndex]?.icon || <Circle className="w-3 h-3" />}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">
                        {stagesWithStatus[currentIndex]?.name}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500 dark:text-slate-400">
                        {stagesWithStatus[currentIndex + 1]?.name || 'Complete'}
                    </span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Overall progress bar */}
            <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500 ease-out"
                        style={{ width: `${overallProgress}%` }}
                    />
                </div>
                <span className="text-lg font-bold text-gray-900 dark:text-white min-w-[60px] text-right">
                    {Math.round(overallProgress)}%
                </span>
            </div>

            {/* Stage indicators */}
            <div className="relative">
                {/* Connection line */}
                <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-200 dark:bg-slate-700" />
                <div 
                    className="absolute top-5 left-5 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                    style={{ width: `${Math.max(0, (currentIndex / (stagesWithStatus.length - 1)) * 100)}%` }}
                />

                {/* Stage dots */}
                <div className="relative flex justify-between">
                    {stagesWithStatus.map((stage, index) => (
                        <button
                            key={stage.id}
                            onClick={() => onStageClick?.(stage.id)}
                            disabled={!onStageClick}
                            className={`flex flex-col items-center gap-2 ${onStageClick ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                            <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center
                                transition-all duration-300 relative z-10
                                ${stage.status === 'completed' 
                                    ? 'bg-green-500 text-white' 
                                    : stage.status === 'in_progress'
                                        ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white ring-4 ring-blue-200 dark:ring-blue-500/30'
                                        : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
                                }
                            `}>
                                {stage.status === 'completed' ? (
                                    <CheckCircle className="w-5 h-5" />
                                ) : stage.status === 'in_progress' ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    stage.icon || <Circle className="w-4 h-4" />
                                )}
                            </div>
                            <div className="text-center">
                                <p className={`text-xs font-medium ${
                                    stage.status === 'in_progress' 
                                        ? 'text-blue-600 dark:text-blue-400' 
                                        : stage.status === 'completed'
                                            ? 'text-green-600 dark:text-green-400'
                                            : 'text-gray-500 dark:text-slate-400'
                                }`}>
                                    {stage.name}
                                </p>
                                {showDescription && (
                                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 max-w-[80px]">
                                        {stage.description}
                                    </p>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

// Vertical timeline variant
interface ProjectTimelineProps {
    stages: ProjectStage[]
    currentStage: string
}

export function ProjectTimeline({ stages, currentStage }: ProjectTimelineProps) {
    const currentIndex = stages.findIndex(s => s.id === currentStage)

    return (
        <div className="space-y-0">
            {stages.map((stage, index) => {
                const isCompleted = index < currentIndex
                const isCurrent = index === currentIndex
                const isPending = index > currentIndex

                return (
                    <div key={stage.id} className="flex gap-4">
                        {/* Timeline */}
                        <div className="flex flex-col items-center">
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                                ${isCompleted 
                                    ? 'bg-green-500 text-white' 
                                    : isCurrent 
                                        ? 'bg-blue-500 text-white ring-4 ring-blue-200 dark:ring-blue-500/30'
                                        : 'bg-gray-200 dark:bg-slate-700 text-gray-400'
                                }
                            `}>
                                {isCompleted ? (
                                    <CheckCircle className="w-4 h-4" />
                                ) : isCurrent ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Circle className="w-3 h-3" />
                                )}
                            </div>
                            {index < stages.length - 1 && (
                                <div className={`w-0.5 h-12 ${
                                    isCompleted 
                                        ? 'bg-green-500' 
                                        : 'bg-gray-200 dark:bg-slate-700'
                                }`} />
                            )}
                        </div>

                        {/* Content */}
                        <div className={`pb-8 ${index === stages.length - 1 ? 'pb-0' : ''}`}>
                            <h4 className={`font-medium ${
                                isCurrent 
                                    ? 'text-blue-600 dark:text-blue-400' 
                                    : isCompleted
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-gray-500 dark:text-slate-400'
                            }`}>
                                {stage.name}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                                {stage.description}
                            </p>
                            {stage.completedAt && (
                                <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
                                    Completed {stage.completedAt.toLocaleDateString()}
                                </p>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// Hook for managing project progress
export function useProjectProgress(initialStage: string = 'assessment') {
    const [currentStage, setCurrentStage] = useState(initialStage)
    const [progress, setProgress] = useState(0)
    const [stages, setStages] = useState<ProjectStage[]>(
        DEFAULT_STAGES.map(s => ({ ...s, status: 'pending' as const }))
    )

    const advanceStage = () => {
        const currentIndex = stages.findIndex(s => s.id === currentStage)
        if (currentIndex < stages.length - 1) {
            // Mark current as completed
            setStages(prev => prev.map((s, i) => 
                i === currentIndex ? { ...s, status: 'completed', completedAt: new Date() } : s
            ))
            // Move to next stage
            setCurrentStage(stages[currentIndex + 1].id)
            setProgress(0)
        }
    }

    const goToStage = (stageId: string) => {
        setCurrentStage(stageId)
        setProgress(0)
    }

    const updateProgress = (newProgress: number) => {
        setProgress(Math.min(100, Math.max(0, newProgress)))
    }

    return {
        currentStage,
        progress,
        stages,
        advanceStage,
        goToStage,
        updateProgress
    }
}
