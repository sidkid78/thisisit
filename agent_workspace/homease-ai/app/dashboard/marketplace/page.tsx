'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Loader2, ShieldAlert, MapPin, Camera, CheckCircle, ArrowRight, 
  Clock, AlertCircle, Home, X, RefreshCw, DollarSign, Eye, TrendingUp
} from 'lucide-react'
import { getMarketplaceLeads, lockAndPurchaseLead } from '@/lib/leads-api'
import type { MarketplaceLead } from '@/lib/types'

const ROOM_TAGS = ['bathroom', 'kitchen', 'bedroom', 'entryway', 'entry', 'hallway', 'living room', 'garage', 'exterior', 'interior', 'ramp', 'stairs']

const getScopeSummary = (title: string, tags?: string[]): string => {
  const roomTag = tags?.find(t => ROOM_TAGS.some(room => t.toLowerCase().includes(room)))
  if (roomTag) {
    const room = roomTag.charAt(0).toUpperCase() + roomTag.slice(1).toLowerCase()
    return `${room} accessibility improvements identified`
  }
  if (title.toLowerCase().includes('bathroom')) return 'Bathroom accessibility improvements identified'
  if (title.toLowerCase().includes('kitchen')) return 'Kitchen accessibility improvements identified'
  if (title.toLowerCase().includes('entry') || title.toLowerCase().includes('ramp')) return 'Entryway accessibility improvements identified'
  return 'Accessibility improvements identified'
}

const getIssueCount = (title: string): string => {
  const match = title.match(/\((\d+)\s*issues?\)/i)
  if (match && parseInt(match[1]) > 0) {
    return `${match[1]} issues identified`
  }
  return 'Issues identified'
}

const getTimeOnMarketplace = (postedDate: string): string => {
  if (!postedDate) return 'Recently listed'
  const date = new Date(postedDate)
  if (isNaN(date.getTime())) return 'Recently listed'
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 60) return `Listed ${diffMins} minutes ago`
  if (diffHours < 24) return `Listed ${diffHours} hours ago`
  if (diffDays < 7) return `Listed ${diffDays} days ago`
  return 'Recently listed'
}

const getPropertyContext = (tags?: string[]): string | null => {
  if (!tags || tags.length === 0) return null
  const roomTag = tags.find(t => ROOM_TAGS.some(room => t.toLowerCase().includes(room)))
  if (roomTag) {
    return roomTag.charAt(0).toUpperCase() + roomTag.slice(1).toLowerCase()
  }
  return null
}

// Circular score indicator component
const ScoreIndicator = ({ score }: { score: number }) => {
  const getScoreColor = () => {
    if (score >= 80) return { ring: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' }
    if (score >= 60) return { ring: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' }
    if (score >= 40) return { ring: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' }
    return { ring: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' }
  }
  
  const colors = getScoreColor()
  const circumference = 2 * Math.PI * 18
  const strokeDashoffset = circumference - (score / 100) * circumference
  
  return (
    <div className={`relative inline-flex items-center justify-center w-12 h-12 rounded-full ${colors.bg}`}>
      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 40 40">
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-gray-200 dark:text-slate-600"
        />
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={colors.ring}
        />
      </svg>
      <span className={`absolute text-xs font-bold ${colors.text}`}>{score}</span>
    </div>
  )
}

// Format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

// Preview leads for demo/empty state
const PREVIEW_LEADS: MarketplaceLead[] = [
  {
    id: 'preview-1',
    homeowner_id: 'preview',
    title: 'Accessibility Upgrade (3 Issues)',
    location: 'Austin, TX',
    price: 85,
    status: 'AVAILABLE',
    tags: ['Bathroom'],
    scope_tags: [],
    preview_image: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=500&q=80',
    purchased: false,
    postedDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    accessibility_score: 42,
    estimated_value: 3500,
    view_count: 12,
  },
  {
    id: 'preview-2',
    homeowner_id: 'preview',
    title: 'Accessibility Upgrade (2 Issues)',
    location: 'Round Rock, TX',
    price: 65,
    status: 'AVAILABLE',
    tags: ['Entryway'],
    scope_tags: [],
    preview_image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=500&q=80',
    purchased: false,
    postedDate: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    accessibility_score: 65,
    estimated_value: 2200,
    view_count: 8,
  },
  {
    id: 'preview-3',
    homeowner_id: 'preview',
    title: 'Accessibility Upgrade (4 Issues)',
    location: 'Cedar Park, TX',
    price: 75,
    status: 'AVAILABLE',
    tags: ['Kitchen'],
    scope_tags: [],
    preview_image: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=500&q=80',
    purchased: false,
    postedDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    accessibility_score: 38,
    estimated_value: 5800,
    view_count: 23,
  },
]

// Track a lead view
const trackLeadView = async (leadId: string) => {
  if (leadId.startsWith('preview-')) return
  try {
    await fetch(`/api/leads/${leadId}/view`, { method: 'POST' })
  } catch (err) {
    // Non-critical, ignore errors
  }
}

export default function LeadMarketplace() {
  const router = useRouter()
  const [leads, setLeads] = useState<MarketplaceLead[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [optimisticPurchasedIds, setOptimisticPurchasedIds] = useState<Set<string>>(new Set())
  const [showPurchaseSuccess, setShowPurchaseSuccess] = useState<string | null>(null)
  const [viewedLeadIds, setViewedLeadIds] = useState<Set<string>>(new Set())
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const clearRedirectTimer = useCallback(() => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current)
      redirectTimerRef.current = null
    }
  }, [])

  const refreshMarketplaceLeads = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMarketplaceLeads()
      setLeads(data)
    } catch (err) {
      console.error('Failed to fetch marketplace leads', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshMarketplaceLeads()
  }, [refreshMarketplaceLeads])

  // Track views using IntersectionObserver
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const leadId = entry.target.getAttribute('data-lead-id')
            if (leadId && !viewedLeadIds.has(leadId)) {
              setViewedLeadIds(prev => new Set(prev).add(leadId))
              trackLeadView(leadId)
            }
          }
        })
      },
      { threshold: 0.5 }
    )

    return () => {
      observerRef.current?.disconnect()
    }
  }, [viewedLeadIds])

  useEffect(() => {
    setPurchaseError(null)
  }, [leads])

  useEffect(() => {
    return () => clearRedirectTimer()
  }, [clearRedirectTimer])

  const usingPreviewFallback = leads.length === 0
  const effectiveLeads = usingPreviewFallback ? PREVIEW_LEADS : leads

  const isLeadPurchased = useCallback((leadId: string, leadPurchased?: boolean) => {
    return leadPurchased || optimisticPurchasedIds.has(leadId)
  }, [optimisticPurchasedIds])

  const handleStayOnMarketplace = useCallback(() => {
    clearRedirectTimer()
    setShowPurchaseSuccess(null)
  }, [clearRedirectTimer])

  const handleDismissSuccessBanner = useCallback(() => {
    clearRedirectTimer()
    setShowPurchaseSuccess(null)
  }, [clearRedirectTimer])

  const handleViewMyJobs = useCallback(() => {
    clearRedirectTimer()
    setShowPurchaseSuccess(null)
    router.push('/dashboard/jobs')
  }, [clearRedirectTimer, router])

  const handlePurchase = async (leadId: string) => {
    if (purchasingId) return
    if (optimisticPurchasedIds.has(leadId)) return

    setOptimisticPurchasedIds(prev => new Set(prev).add(leadId))
    setPurchasingId(leadId)
    setPurchaseError(null)

    const isPreviewLead = leadId.startsWith('preview-')

    const startSuccessFlow = () => {
      setShowPurchaseSuccess(leadId)
      clearRedirectTimer()
      redirectTimerRef.current = setTimeout(() => {
        router.push('/dashboard/jobs')
      }, 1500)
    }

    // Handle preview/demo leads
    if (isPreviewLead) {
      await new Promise(resolve => setTimeout(resolve, 800))
      startSuccessFlow()
      setPurchasingId(null)
      return
    }

    try {
      const result = await lockAndPurchaseLead(leadId)

      if (result.success) {
        await refreshMarketplaceLeads()
        startSuccessFlow()
        setPurchaseError(null)
      } else {
        setOptimisticPurchasedIds(prev => {
          const next = new Set(prev)
          next.delete(leadId)
          return next
        })
        const is409 = result.error?.includes('already been purchased') || result.error?.includes('409')
        const message = is409
          ? 'This lead has already been purchased and is no longer available.'
          : (result.error || 'Purchase failed. Refresh or try again in a moment.')
        setPurchaseError(message)
      }
    } catch (err: unknown) {
      setOptimisticPurchasedIds(prev => {
        const next = new Set(prev)
        next.delete(leadId)
        return next
      })
      const message = 'Network error. Please check your connection and try again.'
      setPurchaseError(message)
    } finally {
      setPurchasingId(null)
    }
  }

  // Register card for view tracking
  const registerCardRef = useCallback((node: HTMLDivElement | null) => {
    if (node && observerRef.current) {
      observerRef.current.observe(node)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-sm">Loading available leads…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-blue-500 dark:text-blue-400 font-semibold mb-1">
            Available Home Modification Projects
          </p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Lead Marketplace</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">
            Preview projects in your service area. Purchase to unlock full details.
          </p>
        </div>
        <button
          onClick={refreshMarketplaceLeads}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg text-gray-700 dark:text-slate-200 font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Success Banner */}
      {showPurchaseSuccess && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-800 dark:text-green-300 animate-fade-in" role="alert">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-green-600 dark:text-green-400" />
              <span className="font-semibold">Lead purchased successfully. It&apos;s now available in My Jobs.</span>
            </div>
            <button
              onClick={handleDismissSuccessBanner}
              className="p-1 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 rounded transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleViewMyJobs}
              className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg font-semibold text-sm hover:bg-green-700 dark:hover:bg-green-600 transition-colors flex items-center gap-2"
            >
              View My Jobs <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleStayOnMarketplace}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 rounded-lg font-semibold text-sm hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
            >
              Stay on Marketplace
            </button>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">Redirecting to My Jobs in a moment...</p>
        </div>
      )}

      {/* Error Banner */}
      {purchaseError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center gap-2" role="alert">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{purchaseError}</span>
        </div>
      )}

      {/* Preview Fallback Notice */}
      {usingPreviewFallback && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Showing demo leads. Real leads will appear when homeowners publish assessments.</span>
        </div>
      )}

      {/* Empty State */}
      {effectiveLeads.length === 0 ? (
        <div className="mt-16 text-center space-y-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No leads available</h3>
          <p className="text-gray-600 dark:text-slate-400">
            New homeowner assessments will appear here when published. Purchased leads move to My Jobs.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              type="button"
              onClick={refreshMarketplaceLeads}
              className="px-5 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-xl font-semibold shadow hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              Refresh leads
            </button>
            <Link
              href="/dashboard/jobs"
              className="px-5 py-3 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              View My Jobs
            </Link>
          </div>
        </div>
      ) : (
        /* Lead Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {effectiveLeads.map(lead => (
            <div
              key={lead.id}
              ref={registerCardRef}
              data-lead-id={lead.id}
              className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-lg hover:border-blue-500/30 dark:hover:border-blue-500/50 transition-all overflow-hidden flex flex-col"
            >
              {/* Preview Image */}
              <div className="relative h-48 bg-gray-100 dark:bg-slate-700">
                {lead.preview_image ? (
                  <img
                    src={lead.preview_image}
                    alt={lead.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera className="w-12 h-12 text-gray-400 dark:text-slate-500" />
                  </div>
                )}
                {/* Price Badge */}
                <div className="absolute bottom-3 right-3 pointer-events-none">
                  <div className="bg-gradient-to-br from-green-500 to-green-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-bold text-lg sm:text-xl shadow-lg border border-white/30">
                    ${lead.price}
                  </div>
                </div>
                {/* Tags */}
                {lead.tags && lead.tags.length > 0 && (
                  <div className="absolute top-3 left-3 flex gap-1">
                    {lead.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {/* Accessibility Score Badge */}
                {lead.accessibility_score !== undefined && (
                  <div className="absolute top-3 right-3">
                    <ScoreIndicator score={lead.accessibility_score} />
                  </div>
                )}
              </div>

              <div className="p-5 flex flex-col flex-1">
                {/* Title */}
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{lead.title}</h3>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {getPropertyContext(lead.tags) && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                      {getPropertyContext(lead.tags)}
                    </span>
                  )}
                  {lead.tags && lead.tags.length > 0 && (
                    <span className="text-xs text-gray-500 dark:text-slate-400">AI-verified</span>
                  )}
                </div>

                {/* Location */}
                <div className="flex items-center justify-between gap-2 text-sm mb-4 flex-wrap">
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-slate-300">
                    <MapPin className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    <span>{lead.location}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    lead.status === 'AVAILABLE' 
                      ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700' 
                      : 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-700'
                  }`}>
                    {lead.status === 'AVAILABLE' ? 'Available' : 'Locked'}
                  </span>
                </div>

                {/* Project Value & Views Row */}
                {(lead.estimated_value || lead.view_count !== undefined) && (
                  <div className="flex items-center justify-between gap-3 mb-3 p-2 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800/30">
                    {lead.estimated_value && (
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                          Est. {formatCurrency(lead.estimated_value)}
                        </span>
                      </div>
                    )}
                    {lead.view_count !== undefined && lead.view_count > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                        <span className="text-xs text-blue-600 dark:text-blue-300">
                          {lead.view_count} view{lead.view_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Lead Preview Details */}
                <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-100 dark:border-slate-600 space-y-2">
                  <div className="flex items-start gap-2 text-sm text-gray-900 dark:text-white">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{getScopeSummary(lead.title, lead.tags)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                    <ShieldAlert className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                    <span>{getIssueCount(lead.title)}</span>
                  </div>
                  {lead.accessibility_score !== undefined && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                      <TrendingUp className="w-4 h-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
                      <span>Safety Score: {lead.accessibility_score}/100</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                    <Clock className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                    <span>{getTimeOnMarketplace(lead.postedDate || lead.created_at)}</span>
                  </div>
                  {getPropertyContext(lead.tags) && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                      <Home className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                      <span>{getPropertyContext(lead.tags)}</span>
                    </div>
                  )}
                  {!isLeadPurchased(lead.id, lead.purchased) && (
                    <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-slate-400">
                      <ShieldAlert className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                      <span>Preview hidden until purchase. Full project details unlock after checkout.</span>
                    </div>
                  )}
                </div>

                {/* Purchase Button */}
                <div className="mt-auto">
                  {isLeadPurchased(lead.id, lead.purchased) ? (
                    <div className="space-y-2">
                      <div className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        <span>You own this lead. View it in My Jobs.</span>
                      </div>
                      <div className="w-full py-3.5 rounded-xl text-base font-bold bg-gradient-to-r from-emerald-500 to-green-500 text-white flex items-center justify-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        <span>Purchased</span>
                      </div>
                      <Link
                        href="/dashboard/jobs"
                        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
                      >
                        <span>View in My Jobs</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  ) : (
                    <>
                      <button
                        disabled={purchasingId === lead.id}
                        onClick={() => handlePurchase(lead.id)}
                        aria-busy={purchasingId === lead.id}
                        className="w-full min-h-[52px] py-3.5 rounded-xl text-base font-bold transition-all bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl disabled:opacity-80 border-2 border-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 animate-pulse-glow"
                      >
                        {purchasingId === lead.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Purchasing…
                          </span>
                        ) : (
                          'Buy This Lead Now'
                        )}
                      </button>
                      <p className="text-center text-xs text-gray-500 dark:text-slate-400 mt-2">
                        One-time purchase • Instant access
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
