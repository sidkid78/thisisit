'use client'

import { useState, useRef, useEffect, ReactNode, TouchEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface SwipeableCard {
    id: string
    content: ReactNode
    title?: string
    subtitle?: string
}

interface SwipeableCardsProps {
    cards: SwipeableCard[]
    initialIndex?: number
    showIndicators?: boolean
    showArrows?: boolean
    autoPlay?: boolean
    autoPlayInterval?: number
    onCardChange?: (index: number, card: SwipeableCard) => void
    className?: string
    cardClassName?: string
}

export function SwipeableCards({
    cards,
    initialIndex = 0,
    showIndicators = true,
    showArrows = true,
    autoPlay = false,
    autoPlayInterval = 5000,
    onCardChange,
    className = '',
    cardClassName = ''
}: SwipeableCardsProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex)
    const [touchStart, setTouchStart] = useState<number | null>(null)
    const [touchEnd, setTouchEnd] = useState<number | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [dragOffset, setDragOffset] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)

    // Minimum swipe distance to trigger navigation
    const minSwipeDistance = 50

    const goToCard = (index: number) => {
        const newIndex = Math.max(0, Math.min(cards.length - 1, index))
        setCurrentIndex(newIndex)
        onCardChange?.(newIndex, cards[newIndex])
    }

    const goToPrevious = () => goToCard(currentIndex - 1)
    const goToNext = () => goToCard(currentIndex + 1)

    // Touch handlers
    const onTouchStart = (e: TouchEvent) => {
        setTouchEnd(null)
        setTouchStart(e.targetTouches[0].clientX)
        setIsDragging(true)
    }

    const onTouchMove = (e: TouchEvent) => {
        if (!touchStart) return
        const currentTouch = e.targetTouches[0].clientX
        setTouchEnd(currentTouch)
        setDragOffset(currentTouch - touchStart)
    }

    const onTouchEnd = () => {
        setIsDragging(false)
        setDragOffset(0)

        if (!touchStart || !touchEnd) return

        const distance = touchStart - touchEnd
        const isLeftSwipe = distance > minSwipeDistance
        const isRightSwipe = distance < -minSwipeDistance

        if (isLeftSwipe && currentIndex < cards.length - 1) {
            goToNext()
        } else if (isRightSwipe && currentIndex > 0) {
            goToPrevious()
        }

        setTouchStart(null)
        setTouchEnd(null)
    }

    // Auto-play
    useEffect(() => {
        if (!autoPlay) return

        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % cards.length)
        }, autoPlayInterval)

        return () => clearInterval(interval)
    }, [autoPlay, autoPlayInterval, cards.length])

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') goToPrevious()
            if (e.key === 'ArrowRight') goToNext()
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [currentIndex])

    if (cards.length === 0) return null

    return (
        <div className={`relative ${className}`}>
            {/* Cards Container */}
            <div 
                ref={containerRef}
                className="overflow-hidden rounded-2xl"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <div 
                    className="flex transition-transform duration-300 ease-out"
                    style={{ 
                        transform: `translateX(calc(-${currentIndex * 100}% + ${isDragging ? dragOffset : 0}px))`,
                        transition: isDragging ? 'none' : 'transform 0.3s ease-out'
                    }}
                >
                    {cards.map((card, index) => (
                        <div 
                            key={card.id}
                            className={`w-full flex-shrink-0 ${cardClassName}`}
                        >
                            {card.content}
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation Arrows (Desktop) */}
            {showArrows && cards.length > 1 && (
                <>
                    <button
                        onClick={goToPrevious}
                        disabled={currentIndex === 0}
                        className={`
                            absolute left-2 top-1/2 -translate-y-1/2 z-10
                            w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 
                            shadow-lg backdrop-blur-sm
                            flex items-center justify-center
                            transition-all duration-200
                            ${currentIndex === 0 
                                ? 'opacity-0 cursor-default' 
                                : 'opacity-100 hover:bg-white dark:hover:bg-slate-700 hover:scale-110'
                            }
                            hidden md:flex
                        `}
                        aria-label="Previous card"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-slate-300" />
                    </button>
                    <button
                        onClick={goToNext}
                        disabled={currentIndex === cards.length - 1}
                        className={`
                            absolute right-2 top-1/2 -translate-y-1/2 z-10
                            w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 
                            shadow-lg backdrop-blur-sm
                            flex items-center justify-center
                            transition-all duration-200
                            ${currentIndex === cards.length - 1 
                                ? 'opacity-0 cursor-default' 
                                : 'opacity-100 hover:bg-white dark:hover:bg-slate-700 hover:scale-110'
                            }
                            hidden md:flex
                        `}
                        aria-label="Next card"
                    >
                        <ChevronRight className="w-5 h-5 text-gray-700 dark:text-slate-300" />
                    </button>
                </>
            )}

            {/* Dot Indicators */}
            {showIndicators && cards.length > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    {cards.map((card, index) => (
                        <button
                            key={card.id}
                            onClick={() => goToCard(index)}
                            className={`
                                transition-all duration-200 rounded-full
                                ${index === currentIndex 
                                    ? 'w-6 h-2 bg-blue-500' 
                                    : 'w-2 h-2 bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-500'
                                }
                            `}
                            aria-label={`Go to card ${index + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Swipe hint for mobile */}
            {cards.length > 1 && (
                <div className="md:hidden flex justify-center mt-2">
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                        Swipe to navigate • {currentIndex + 1} of {cards.length}
                    </span>
                </div>
            )}
        </div>
    )
}

// Widget Card wrapper for consistent styling
interface WidgetCardProps {
    title: string
    subtitle?: string
    icon?: ReactNode
    children: ReactNode
    action?: {
        label: string
        onClick: () => void
    }
    gradient?: string
}

export function WidgetCard({ 
    title, 
    subtitle, 
    icon, 
    children, 
    action,
    gradient = 'from-blue-500 to-cyan-500'
}: WidgetCardProps) {
    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className={`p-4 bg-gradient-to-r ${gradient}`}>
                <div className="flex items-center gap-3">
                    {icon && (
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                            {icon}
                        </div>
                    )}
                    <div>
                        <h3 className="font-semibold text-white">{title}</h3>
                        {subtitle && (
                            <p className="text-sm text-white/80">{subtitle}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {children}
            </div>

            {/* Action */}
            {action && (
                <div className="px-4 pb-4">
                    <button
                        onClick={action.onClick}
                        className="w-full py-2 text-sm font-medium text-blue-600 dark:text-blue-400 
                            hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                    >
                        {action.label}
                    </button>
                </div>
            )}
        </div>
    )
}

// Dashboard Stats Card
interface StatCardProps {
    label: string
    value: string | number
    change?: {
        value: number
        isPositive: boolean
    }
    icon?: ReactNode
    color?: 'blue' | 'green' | 'amber' | 'purple' | 'red'
}

export function StatCard({ label, value, change, icon, color = 'blue' }: StatCardProps) {
    const colorClasses = {
        blue: 'from-blue-500 to-blue-600',
        green: 'from-green-500 to-green-600',
        amber: 'from-amber-500 to-amber-600',
        purple: 'from-purple-500 to-purple-600',
        red: 'from-red-500 to-red-600'
    }

    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-gray-200 dark:border-slate-700 p-4">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">{label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
                    {change && (
                        <p className={`text-sm mt-1 ${change.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                            {change.isPositive ? '↑' : '↓'} {Math.abs(change.value)}%
                        </p>
                    )}
                </div>
                {icon && (
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} 
                        flex items-center justify-center text-white`}>
                        {icon}
                    </div>
                )}
            </div>
        </div>
    )
}
