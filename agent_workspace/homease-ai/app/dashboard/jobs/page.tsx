'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { 
  Loader2, MapPin, Camera, CheckCircle, Clock, 
  Phone, Mail, FileText, ArrowRight, Briefcase, AlertCircle
} from 'lucide-react'
import { getMyLeads } from '@/lib/leads-api'
import type { Lead, JobStatus } from '@/lib/types'

const STATUS_LABELS: Record<JobStatus, string> = {
  AVAILABLE: 'Available',
  LOCKED: 'Locked',
  PURCHASED: 'Purchased',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
}

const STATUS_COLORS: Record<JobStatus, string> = {
  AVAILABLE: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
  LOCKED: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',
  PURCHASED: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
  IN_PROGRESS: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700',
  COMPLETED: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
  ARCHIVED: 'bg-gray-50 dark:bg-slate-700/50 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-600',
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export default function MyJobsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMyLeads()
      // Filter to show purchased leads
      const purchasedLeads = data.filter(lead => 
        lead.status === 'PURCHASED' || 
        lead.status === 'IN_PROGRESS' || 
        lead.status === 'COMPLETED'
      )
      setLeads(purchasedLeads)
    } catch (err: unknown) {
      console.error('Failed to fetch leads:', err)
      setError(err instanceof Error ? err.message : 'Failed to load your jobs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-sm">Loading your jobs…</span>
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
            Your Purchased Leads
          </p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Jobs</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">
            View and manage leads you&apos;ve purchased. Contact homeowners directly.
          </p>
        </div>
        <Link
          href="/dashboard/marketplace"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg text-white font-medium transition-colors"
        >
          <Briefcase className="w-4 h-4" />
          Browse Marketplace
        </Link>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center gap-2" role="alert">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {leads.length === 0 ? (
        <div className="mt-16 text-center space-y-4">
          <div className="w-20 h-20 mx-auto bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <Briefcase className="w-10 h-10 text-gray-400 dark:text-slate-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No purchased leads yet</h3>
          <p className="text-gray-600 dark:text-slate-400 max-w-md mx-auto">
            Visit the marketplace to browse available leads from homeowners in your area.
            Purchase leads to unlock full contact details.
          </p>
          <Link
            href="/dashboard/marketplace"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-xl font-semibold shadow hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Browse Marketplace
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        /* Jobs Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {leads.map(lead => (
            <div
              key={lead.id}
              className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-lg dark:hover:shadow-slate-900/50 transition-all overflow-hidden"
            >
              <div className="flex">
                {/* Preview Image */}
                <div className="relative w-40 h-auto bg-gray-100 dark:bg-slate-700 flex-shrink-0">
                  {lead.preview_image ? (
                    <img
                      src={lead.preview_image}
                      alt={lead.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center min-h-[160px]">
                      <Camera className="w-10 h-10 text-gray-400 dark:text-slate-500" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{lead.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[lead.status]}`}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-300 mb-3">
                    <MapPin className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    <span>{lead.location}</span>
                  </div>

                  {/* Project Value */}
                  {lead.project_value && (
                    <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                      <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                        Est. Project Value: ${lead.project_value.toLocaleString()}
                      </p>
                    </div>
                  )}

                  {/* Scope */}
                  {lead.scope && (
                    <div className="mb-3">
                      <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-slate-300">
                        <FileText className="w-4 h-4 text-gray-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{lead.scope}</span>
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {lead.tags && lead.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {lead.tags.map(tag => (
                        <span key={tag} className="bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs px-2 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400 mb-4">
                    {lead.purchased_at && (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>Purchased {formatDate(lead.purchased_at)}</span>
                      </div>
                    )}
                    {lead.created_at && !lead.purchased_at && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Created {formatDate(lead.created_at)}</span>
                      </div>
                    )}
                  </div>

                  {/* Contact Actions - Full details unlocked */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      Call Homeowner
                    </button>
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Send Message
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress bar for in-progress jobs */}
              {lead.status === 'IN_PROGRESS' && lead.progress !== undefined && (
                <div className="px-5 pb-4">
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-slate-400 mb-1">
                    <span>Project Progress</span>
                    <span>{lead.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                      style={{ width: `${lead.progress}%` }}
                    />
                  </div>
                  {lead.current_stage && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Current stage: {lead.current_stage}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
