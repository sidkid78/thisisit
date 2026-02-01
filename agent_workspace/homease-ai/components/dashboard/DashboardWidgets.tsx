'use client'

import { ReactNode } from 'react'
import { SwipeableCards, StatCard } from '@/components/SwipeableCards'
import { ProjectProgress } from '@/components/ProjectProgress'
import { 
    FolderKanban, 
    CheckCircle2, 
    Radio, 
    ClipboardCheck,
    Users,
    FileText,
    Trophy,
    TrendingUp
} from 'lucide-react'

// Stat item interface
interface StatItem {
    id: string
    label: string
    value: number
    icon: ReactNode
    color: 'blue' | 'green' | 'amber' | 'purple' | 'red'
}

// Homeowner stats widget with mobile swipe support
interface HomeownerStatsProps {
    totalProjects: number
    completed: number
    activeLeads: number
    assessmentsDone: number
}

export function HomeownerStatsWidget({
    totalProjects,
    completed,
    activeLeads,
    assessmentsDone
}: HomeownerStatsProps) {
    const stats: StatItem[] = [
        {
            id: 'total',
            label: 'Total Projects',
            value: totalProjects,
            icon: <FolderKanban className="w-5 h-5" />,
            color: 'blue'
        },
        {
            id: 'completed',
            label: 'Completed',
            value: completed,
            icon: <CheckCircle2 className="w-5 h-5" />,
            color: 'green'
        },
        {
            id: 'active',
            label: 'Active Leads',
            value: activeLeads,
            icon: <Radio className="w-5 h-5" />,
            color: 'amber'
        },
        {
            id: 'assessments',
            label: 'Assessments Done',
            value: assessmentsDone,
            icon: <ClipboardCheck className="w-5 h-5" />,
            color: 'purple'
        }
    ]

    // Desktop: Grid layout
    // Mobile: Swipeable cards
    return (
        <>
            {/* Desktop Grid - hidden on mobile */}
            <div className="hidden md:grid md:grid-cols-4 gap-4">
                {stats.map(stat => (
                    <StatCard
                        key={stat.id}
                        label={stat.label}
                        value={stat.value}
                        icon={stat.icon}
                        color={stat.color}
                    />
                ))}
            </div>

            {/* Mobile Swipeable - hidden on desktop */}
            <div className="md:hidden">
                <SwipeableCards
                    cards={stats.map(stat => ({
                        id: stat.id,
                        content: (
                            <StatCard
                                label={stat.label}
                                value={stat.value}
                                icon={stat.icon}
                                color={stat.color}
                            />
                        )
                    }))}
                    showArrows={false}
                    cardClassName="px-1"
                />
            </div>
        </>
    )
}

// Contractor stats widget with mobile swipe support
interface ContractorStatsProps {
    totalMatches: number
    activeLeads: number
    proposalsSent: number
    jobsWon: number
}

export function ContractorStatsWidget({
    totalMatches,
    activeLeads,
    proposalsSent,
    jobsWon
}: ContractorStatsProps) {
    const stats: StatItem[] = [
        {
            id: 'matches',
            label: 'Total Matches',
            value: totalMatches,
            icon: <Users className="w-5 h-5" />,
            color: 'blue'
        },
        {
            id: 'active',
            label: 'Active Leads',
            value: activeLeads,
            icon: <Radio className="w-5 h-5" />,
            color: 'green'
        },
        {
            id: 'proposals',
            label: 'Proposals Sent',
            value: proposalsSent,
            icon: <FileText className="w-5 h-5" />,
            color: 'amber'
        },
        {
            id: 'won',
            label: 'Jobs Won',
            value: jobsWon,
            icon: <Trophy className="w-5 h-5" />,
            color: 'purple'
        }
    ]

    return (
        <>
            {/* Desktop Grid */}
            <div className="hidden md:grid md:grid-cols-4 gap-4">
                {stats.map(stat => (
                    <StatCard
                        key={stat.id}
                        label={stat.label}
                        value={stat.value}
                        icon={stat.icon}
                        color={stat.color}
                    />
                ))}
            </div>

            {/* Mobile Swipeable */}
            <div className="md:hidden">
                <SwipeableCards
                    cards={stats.map(stat => ({
                        id: stat.id,
                        content: (
                            <StatCard
                                label={stat.label}
                                value={stat.value}
                                icon={stat.icon}
                                color={stat.color}
                            />
                        )
                    }))}
                    showArrows={false}
                    cardClassName="px-1"
                />
            </div>
        </>
    )
}

// Project card with progress indicator
interface ProjectCardProgressProps {
    status: string
    assessmentStatus?: string
    compact?: boolean
}

export function ProjectCardProgress({ status, assessmentStatus, compact = true }: ProjectCardProgressProps) {
    // Map project status to stage
    const getStageFromStatus = (status: string, assessmentStatus?: string): string => {
        if (status === 'completed') return 'completed'
        if (status === 'in_progress') return 'in_progress'
        if (status === 'matched' || status === 'proposal_accepted') return 'matched'
        if (status === 'open_for_bids') return 'published'
        if (assessmentStatus === 'completed') return 'review'
        return 'assessment'
    }

    const currentStage = getStageFromStatus(status, assessmentStatus)

    return (
        <ProjectProgress
            currentStage={currentStage}
            compact={compact}
            showDescription={!compact}
        />
    )
}

// Quick action cards for mobile
interface QuickAction {
    id: string
    title: string
    description: string
    icon: ReactNode
    href: string
    gradient: string
}

interface QuickActionsWidgetProps {
    actions: QuickAction[]
    onActionClick?: (action: QuickAction) => void
}

export function QuickActionsWidget({ actions, onActionClick }: QuickActionsWidgetProps) {
    return (
        <div className="md:hidden">
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-3">Quick Actions</h3>
            <SwipeableCards
                cards={actions.map(action => ({
                    id: action.id,
                    content: (
                        <button
                            onClick={() => onActionClick?.(action)}
                            className="w-full text-left"
                        >
                            <div className={`p-4 rounded-xl bg-gradient-to-br ${action.gradient} text-white`}>
                                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center mb-3">
                                    {action.icon}
                                </div>
                                <h4 className="font-semibold">{action.title}</h4>
                                <p className="text-sm text-white/80 mt-1">{action.description}</p>
                            </div>
                        </button>
                    )
                }))}
                showArrows={false}
                cardClassName="px-1"
            />
        </div>
    )
}

// Activity feed widget (swipeable on mobile)
interface ActivityItem {
    id: string
    type: 'assessment' | 'proposal' | 'match' | 'message'
    title: string
    description: string
    timestamp: Date
    icon?: ReactNode
}

interface ActivityFeedWidgetProps {
    activities: ActivityItem[]
    maxItems?: number
}

export function ActivityFeedWidget({ activities, maxItems = 5 }: ActivityFeedWidgetProps) {
    const displayActivities = activities.slice(0, maxItems)

    const getActivityIcon = (type: ActivityItem['type']) => {
        switch (type) {
            case 'assessment':
                return <ClipboardCheck className="w-4 h-4 text-blue-500" />
            case 'proposal':
                return <FileText className="w-4 h-4 text-green-500" />
            case 'match':
                return <Users className="w-4 h-4 text-purple-500" />
            case 'message':
                return <TrendingUp className="w-4 h-4 text-amber-500" />
            default:
                return <Radio className="w-4 h-4 text-gray-500" />
        }
    }

    const formatTimestamp = (date: Date) => {
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)

        if (minutes < 1) return 'Just now'
        if (minutes < 60) return `${minutes}m ago`
        if (hours < 24) return `${hours}h ago`
        if (days < 7) return `${days}d ago`
        return date.toLocaleDateString()
    }

    if (displayActivities.length === 0) {
        return null
    }

    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
            <div className="space-y-3">
                {displayActivities.map(activity => (
                    <div key={activity.id} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                            {activity.icon || getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {activity.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                                {activity.description}
                            </p>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">
                            {formatTimestamp(activity.timestamp)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
