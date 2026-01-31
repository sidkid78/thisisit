'use client'

import { useState } from 'react'
import { Check, Sparkles, Palette, Home, Leaf, Building2, Zap } from 'lucide-react'

export interface RenovationStyle {
    id: string
    name: string
    description: string
    icon: React.ReactNode
    previewImage?: string
    promptModifier: string
    colors: {
        primary: string
        secondary: string
        accent: string
    }
}

const RENOVATION_STYLES: RenovationStyle[] = [
    {
        id: 'modern',
        name: 'Modern',
        description: 'Clean lines, minimalist aesthetic',
        icon: <Building2 className="w-5 h-5" />,
        promptModifier: 'modern minimalist design with clean lines, neutral colors, contemporary fixtures',
        colors: {
            primary: 'from-slate-500 to-slate-700',
            secondary: 'bg-slate-100 dark:bg-slate-800',
            accent: 'text-slate-600 dark:text-slate-300'
        }
    },
    {
        id: 'traditional',
        name: 'Traditional',
        description: 'Classic, timeless elegance',
        icon: <Home className="w-5 h-5" />,
        promptModifier: 'traditional classic design with warm wood tones, elegant fixtures, timeless appeal',
        colors: {
            primary: 'from-amber-600 to-amber-800',
            secondary: 'bg-amber-50 dark:bg-amber-900/20',
            accent: 'text-amber-700 dark:text-amber-300'
        }
    },
    {
        id: 'transitional',
        name: 'Transitional',
        description: 'Blend of modern and traditional',
        icon: <Sparkles className="w-5 h-5" />,
        promptModifier: 'transitional design blending modern and traditional elements, balanced aesthetic',
        colors: {
            primary: 'from-blue-500 to-blue-700',
            secondary: 'bg-blue-50 dark:bg-blue-900/20',
            accent: 'text-blue-600 dark:text-blue-300'
        }
    },
    {
        id: 'contemporary',
        name: 'Contemporary',
        description: 'Current trends, bold choices',
        icon: <Zap className="w-5 h-5" />,
        promptModifier: 'contemporary design with current trends, bold color accents, innovative materials',
        colors: {
            primary: 'from-purple-500 to-purple-700',
            secondary: 'bg-purple-50 dark:bg-purple-900/20',
            accent: 'text-purple-600 dark:text-purple-300'
        }
    },
    {
        id: 'natural',
        name: 'Natural',
        description: 'Organic materials, earthy tones',
        icon: <Leaf className="w-5 h-5" />,
        promptModifier: 'natural organic design with wood, stone, plants, earthy tones, biophilic elements',
        colors: {
            primary: 'from-green-500 to-green-700',
            secondary: 'bg-green-50 dark:bg-green-900/20',
            accent: 'text-green-600 dark:text-green-300'
        }
    },
    {
        id: 'accessible',
        name: 'Accessible First',
        description: 'Function meets style',
        icon: <Palette className="w-5 h-5" />,
        promptModifier: 'accessibility-focused design with grab bars, wide doorways, non-slip surfaces, stylishly integrated safety features',
        colors: {
            primary: 'from-cyan-500 to-cyan-700',
            secondary: 'bg-cyan-50 dark:bg-cyan-900/20',
            accent: 'text-cyan-600 dark:text-cyan-300'
        }
    }
]

interface StyleSelectorProps {
    selectedStyle: string
    onStyleSelect: (style: RenovationStyle) => void
    compact?: boolean
    showPreview?: boolean
}

export function StyleSelector({ 
    selectedStyle, 
    onStyleSelect, 
    compact = false,
    showPreview = false 
}: StyleSelectorProps) {
    const [hoveredStyle, setHoveredStyle] = useState<string | null>(null)

    if (compact) {
        return (
            <div className="flex flex-wrap gap-2">
                {RENOVATION_STYLES.map((style) => (
                    <button
                        key={style.id}
                        onClick={() => onStyleSelect(style)}
                        onMouseEnter={() => setHoveredStyle(style.id)}
                        onMouseLeave={() => setHoveredStyle(null)}
                        className={`
                            relative px-3 py-2 rounded-lg border-2 transition-all duration-200
                            flex items-center gap-2
                            ${selectedStyle === style.id 
                                ? `border-transparent bg-gradient-to-r ${style.colors.primary} text-white shadow-lg`
                                : `border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 
                                   bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300`
                            }
                        `}
                    >
                        {style.icon}
                        <span className="font-medium text-sm">{style.name}</span>
                        {selectedStyle === style.id && (
                            <Check className="w-4 h-4 ml-1" />
                        )}
                    </button>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {RENOVATION_STYLES.map((style) => (
                    <button
                        key={style.id}
                        onClick={() => onStyleSelect(style)}
                        onMouseEnter={() => setHoveredStyle(style.id)}
                        onMouseLeave={() => setHoveredStyle(null)}
                        className={`
                            relative p-4 rounded-xl border-2 transition-all duration-200 text-left
                            ${selectedStyle === style.id 
                                ? `border-transparent bg-gradient-to-br ${style.colors.primary} text-white shadow-lg scale-[1.02]`
                                : `border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 
                                   bg-white dark:bg-slate-800/50 hover:shadow-md`
                            }
                        `}
                    >
                        {/* Selected indicator */}
                        {selectedStyle === style.id && (
                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                <Check className="w-4 h-4" />
                            </div>
                        )}

                        {/* Icon and name */}
                        <div className={`flex items-center gap-2 mb-2 ${
                            selectedStyle === style.id ? 'text-white' : style.colors.accent
                        }`}>
                            {style.icon}
                            <span className="font-semibold">{style.name}</span>
                        </div>

                        {/* Description */}
                        <p className={`text-sm ${
                            selectedStyle === style.id 
                                ? 'text-white/80' 
                                : 'text-gray-500 dark:text-slate-400'
                        }`}>
                            {style.description}
                        </p>

                        {/* Color accent bar */}
                        {selectedStyle !== style.id && (
                            <div className={`absolute bottom-0 left-0 right-0 h-1 rounded-b-xl bg-gradient-to-r ${style.colors.primary} 
                                opacity-0 group-hover:opacity-100 transition-opacity`} 
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Style preview tooltip */}
            {showPreview && hoveredStyle && (
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                    <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${
                            RENOVATION_STYLES.find(s => s.id === hoveredStyle)?.colors.primary
                        } flex items-center justify-center text-white`}>
                            {RENOVATION_STYLES.find(s => s.id === hoveredStyle)?.icon}
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                                {RENOVATION_STYLES.find(s => s.id === hoveredStyle)?.name} Style
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                                AI will generate visualizations with: {' '}
                                <span className="italic">
                                    {RENOVATION_STYLES.find(s => s.id === hoveredStyle)?.promptModifier}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Export styles for use in other components
export { RENOVATION_STYLES }

// Helper to get style by ID
export function getStyleById(id: string): RenovationStyle | undefined {
    return RENOVATION_STYLES.find(style => style.id === id)
}

// Helper to get prompt modifier for a style
export function getStylePromptModifier(styleId: string): string {
    const style = getStyleById(styleId)
    return style?.promptModifier || ''
}
