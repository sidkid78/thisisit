'use client'

import { useState } from 'react'
import { X, Star, MessageSquare, ThumbsUp, Send, Loader2 } from 'lucide-react'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  assessmentId?: string
  onSubmit?: (feedback: FeedbackData) => Promise<void>
}

export interface FeedbackData {
  rating: number
  helpful: boolean | null
  comment: string
  assessmentId?: string
}

export function FeedbackModal({ isOpen, onClose, assessmentId, onSubmit }: FeedbackModalProps) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [helpful, setHelpful] = useState<boolean | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (rating === 0) return

    setSubmitting(true)
    try {
      const feedbackData: FeedbackData = {
        rating,
        helpful,
        comment: comment.trim(),
        assessmentId
      }

      if (onSubmit) {
        await onSubmit(feedbackData)
      } else {
        // Default behavior: send to API
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feedbackData)
        })
      }

      setSubmitted(true)
      setTimeout(() => {
        onClose()
        // Reset state for next time
        setRating(0)
        setHelpful(null)
        setComment('')
        setSubmitted(false)
      }, 2000)
    } catch (err) {
      console.error('Failed to submit feedback:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSkip = () => {
    onClose()
    setRating(0)
    setHelpful(null)
    setComment('')
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {submitted ? 'Thank You!' : 'How was your experience?'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {submitted ? 'Your feedback helps us improve.' : 'Your feedback helps us improve HOMEase AI.'}
                </p>
              </div>
            </div>
            {!submitted && (
              <button
                aria-label="Close feedback modal"
                onClick={handleSkip}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <ThumbsUp className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-gray-600 dark:text-slate-300">
                We appreciate you taking the time to share your thoughts.
              </p>
            </div>
          ) : (
            <>
              {/* Star Rating */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Rate your scan experience
                </label>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      aria-label={`Rate ${star} stars`}
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="p-1 transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${star <= (hoveredRating || rating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-gray-300 dark:text-slate-600'
                          }`}
                      />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className="text-center text-sm text-gray-500 dark:text-slate-400">
                    {rating === 1 && 'Poor'}
                    {rating === 2 && 'Fair'}
                    {rating === 3 && 'Good'}
                    {rating === 4 && 'Very Good'}
                    {rating === 5 && 'Excellent'}
                  </p>
                )}
              </div>

              {/* Helpful Toggle */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Were the recommendations helpful?
                </label>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setHelpful(true)}
                    className={`px-6 py-2 rounded-lg font-medium transition-all ${helpful === true
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-2 border-green-500'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-2 border-transparent hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                  >
                    Yes, helpful
                  </button>
                  <button
                    onClick={() => setHelpful(false)}
                    className={`px-6 py-2 rounded-lg font-medium transition-all ${helpful === false
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-2 border-red-500'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-2 border-transparent hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                  >
                    Not really
                  </button>
                </div>
              </div>

              {/* Comment */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Additional comments (optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us what you liked or how we can improve..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!submitted && (
          <div className="p-6 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 font-medium transition-colors"
            >
              Skip for now
            </button>
            <button
              onClick={handleSubmit}
              disabled={rating === 0 || submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Feedback
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
