'use client'

import { useState } from 'react'
import { X, Mail, Phone, MessageCircle, Send, Loader2, User, Building, Clock, CheckCircle } from 'lucide-react'

interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
  leadId?: string
  contractorInfo?: {
    name: string
    company?: string
    email?: string
    phone?: string
  }
  homeownerInfo?: {
    name?: string
    email?: string
    phone?: string
    preferredContact?: 'email' | 'phone' | 'either'
  }
  projectTitle?: string
  onSend?: (message: ContactMessage) => Promise<void>
}

export interface ContactMessage {
  leadId?: string
  type: 'email' | 'phone' | 'message'
  subject: string
  message: string
  preferredTime?: string
}

export function ContactModal({
  isOpen,
  onClose,
  leadId,
  contractorInfo,
  homeownerInfo,
  projectTitle,
  onSend
}: ContactModalProps) {
  const [contactType, setContactType] = useState<'email' | 'phone' | 'message'>('message')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [preferredTime, setPreferredTime] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (!isOpen) return null

  const handleSend = async () => {
    if (!message.trim()) return

    setSending(true)
    try {
      const contactMessage: ContactMessage = {
        leadId,
        type: contactType,
        subject: subject.trim() || `Inquiry about ${projectTitle || 'your project'}`,
        message: message.trim(),
        preferredTime: preferredTime.trim() || undefined
      }

      if (onSend) {
        await onSend(contactMessage)
      } else {
        // Default behavior: send to API
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contactMessage)
        })
      }

      setSent(true)
      setTimeout(() => {
        onClose()
        // Reset state
        setSubject('')
        setMessage('')
        setPreferredTime('')
        setSent(false)
      }, 2500)
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
    }
  }

  const getDefaultMessage = () => {
    if (contractorInfo) {
      return `Hi${homeownerInfo?.name ? ` ${homeownerInfo.name}` : ''},\n\nI'm ${contractorInfo.name}${contractorInfo.company ? ` from ${contractorInfo.company}` : ''} and I'm interested in discussing your accessibility project${projectTitle ? `: "${projectTitle}"` : ''}.\n\nI'd love to schedule a time to discuss the scope of work and provide you with a detailed estimate.\n\nPlease let me know your availability.\n\nBest regards,\n${contractorInfo.name}`
    }
    return ''
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {sent ? 'Message Sent!' : 'Contact About Project'}
                </h2>
                {projectTitle && !sent && (
                  <p className="text-sm text-gray-500 dark:text-slate-400 truncate max-w-[250px]">
                    {projectTitle}
                  </p>
                )}
              </div>
            </div>
            <button
              aria-label="Close contact modal"
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {sent ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Message sent successfully!
              </h3>
              <p className="text-gray-600 dark:text-slate-300">
                {homeownerInfo?.name || 'The homeowner'} will receive your message shortly.
              </p>
            </div>
          ) : (
            <>
              {/* Contact Info Display */}
              {homeownerInfo && (
                <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
                    Contact Information
                  </h3>
                  {homeownerInfo.name && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600 dark:text-slate-300">{homeownerInfo.name}</span>
                    </div>
                  )}
                  {homeownerInfo.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <a
                        href={`mailto:${homeownerInfo.email}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {homeownerInfo.email}
                      </a>
                    </div>
                  )}
                  {homeownerInfo.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <a
                        href={`tel:${homeownerInfo.phone}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {homeownerInfo.phone}
                      </a>
                    </div>
                  )}
                  {homeownerInfo.preferredContact && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                      Preferred contact: {homeownerInfo.preferredContact}
                    </p>
                  )}
                </div>
              )}

              {/* From Info */}
              {contractorInfo && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-800/50 rounded-full">
                      <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Sending as: {contractorInfo.name}
                      </p>
                      {contractorInfo.company && (
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {contractorInfo.company}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Contact Type */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Contact Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'message' as const, icon: MessageCircle, label: 'In-App' },
                    { type: 'email' as const, icon: Mail, label: 'Email' },
                    { type: 'phone' as const, icon: Phone, label: 'Call' },
                  ].map(({ type, icon: Icon, label }) => (
                    <button
                      key={type}
                      onClick={() => setContactType(type)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${contactType === type
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-500'
                        }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={`Inquiry about ${projectTitle || 'your project'}`}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                    Message
                  </label>
                  {contractorInfo && !message && (
                    <button
                      onClick={() => setMessage(getDefaultMessage())}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Use template
                    </button>
                  )}
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message..."
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Preferred Time (for phone/meeting) */}
              {contactType === 'phone' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Preferred callback time (optional)
                  </label>
                  <input
                    type="text"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    placeholder="e.g., Weekdays 9am-5pm, or Tue/Thu afternoons"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!sent && (
          <div className="p-6 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Message
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
