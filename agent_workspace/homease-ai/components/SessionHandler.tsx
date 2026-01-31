'use client'

import { useEffect, useState, useCallback, createContext, useContext, ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCw, LogIn, X } from 'lucide-react'

interface SessionState {
    isValid: boolean
    isExpired: boolean
    expiresAt: Date | null
    isRecovering: boolean
}

interface SessionContextType {
    session: SessionState
    refreshSession: () => Promise<boolean>
    clearSession: () => void
}

const SessionContext = createContext<SessionContextType | null>(null)

export function useSession() {
    const context = useContext(SessionContext)
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider')
    }
    return context
}

interface SessionProviderProps {
    children: ReactNode
    onSessionExpired?: () => void
    warningMinutes?: number // Show warning before expiry
}

export function SessionProvider({
    children,
    onSessionExpired,
    warningMinutes = 5
}: SessionProviderProps) {
    const [session, setSession] = useState<SessionState>({
        isValid: true,
        isExpired: false,
        expiresAt: null,
        isRecovering: false
    })
    const [showWarning, setShowWarning] = useState(false)
    const [showExpiredModal, setShowExpiredModal] = useState(false)

    const router = useRouter()
    const supabase = createClient()

    // Check session status
    const checkSession = useCallback(async () => {
        try {
            const { data: { session: currentSession }, error } = await supabase.auth.getSession()

            if (error || !currentSession) {
                setSession(prev => ({
                    ...prev,
                    isValid: false,
                    isExpired: true
                }))
                setShowExpiredModal(true)
                onSessionExpired?.()
                return false
            }

            const expiresAt = new Date(currentSession.expires_at! * 1000)
            const now = new Date()
            const timeUntilExpiry = expiresAt.getTime() - now.getTime()
            const warningThreshold = warningMinutes * 60 * 1000

            setSession({
                isValid: true,
                isExpired: false,
                expiresAt,
                isRecovering: false
            })

            // Show warning if close to expiry
            if (timeUntilExpiry > 0 && timeUntilExpiry < warningThreshold) {
                setShowWarning(true)
            } else {
                setShowWarning(false)
            }

            return true
        } catch (error) {
            console.error('Session check failed:', error)
            return false
        }
    }, [supabase, warningMinutes, onSessionExpired])

    // Refresh session
    const refreshSession = useCallback(async (): Promise<boolean> => {
        setSession(prev => ({ ...prev, isRecovering: true }))

        try {
            const { data: { session: newSession }, error } = await supabase.auth.refreshSession()

            if (error || !newSession) {
                setSession(prev => ({
                    ...prev,
                    isValid: false,
                    isExpired: true,
                    isRecovering: false
                }))
                setShowExpiredModal(true)
                return false
            }

            const expiresAt = new Date(newSession.expires_at! * 1000)
            setSession({
                isValid: true,
                isExpired: false,
                expiresAt,
                isRecovering: false
            })
            setShowWarning(false)
            setShowExpiredModal(false)
            return true
        } catch (error) {
            console.error('Session refresh failed:', error)
            setSession(prev => ({ ...prev, isRecovering: false }))
            return false
        }
    }, [supabase])

    // Clear session and redirect to login
    const clearSession = useCallback(() => {
        supabase.auth.signOut()
        setSession({
            isValid: false,
            isExpired: true,
            expiresAt: null,
            isRecovering: false
        })
        setShowExpiredModal(false)
        router.push('/login')
    }, [supabase, router])

    // Initial check and periodic checks
    useEffect(() => {
        checkSession()

        // Check session every minute
        const interval = setInterval(checkSession, 60000)

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                checkSession()
            }
            if (event === 'SIGNED_IN' && session) {
                setShowExpiredModal(false)
                setShowWarning(false)
            }
        })

        return () => {
            clearInterval(interval)
            subscription.unsubscribe()
        }
    }, [checkSession, supabase])

    return (
        <SessionContext.Provider value={{ session, refreshSession, clearSession }}>
            {children}

            {/* Session Warning Banner */}
            {showWarning && !showExpiredModal && (
                <SessionWarningBanner
                    onRefresh={refreshSession}
                    onDismiss={() => setShowWarning(false)}
                    isRefreshing={session.isRecovering}
                    expiresAt={session.expiresAt}
                />
            )}

            {/* Session Expired Modal */}
            {showExpiredModal && (
                <SessionExpiredModal
                    onRefresh={refreshSession}
                    onLogin={clearSession}
                    isRefreshing={session.isRecovering}
                />
            )}
        </SessionContext.Provider>
    )
}

// Warning banner shown before session expires
function SessionWarningBanner({
    onRefresh,
    onDismiss,
    isRefreshing,
    expiresAt
}: {
    onRefresh: () => Promise<boolean>
    onDismiss: () => void
    isRefreshing: boolean
    expiresAt: Date | null
}) {
    const [timeLeft, setTimeLeft] = useState('')

    useEffect(() => {
        if (!expiresAt) return

        const updateTimeLeft = () => {
            const now = new Date()
            const diff = expiresAt.getTime() - now.getTime()
            if (diff <= 0) {
                setTimeLeft('expired')
                return
            }
            const minutes = Math.floor(diff / 60000)
            const seconds = Math.floor((diff % 60000) / 1000)
            setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`)
        }

        updateTimeLeft()
        const interval = setInterval(updateTimeLeft, 1000)
        return () => clearInterval(interval)
    }, [expiresAt])

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-md animate-slide-up">
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl p-4 shadow-lg">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-medium text-amber-800 dark:text-amber-200">
                            Session Expiring Soon
                        </h4>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                            Your session will expire in <span className="font-mono font-bold">{timeLeft}</span>.
                            Extend to continue working.
                        </p>
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={onRefresh}
                                disabled={isRefreshing}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 
                                    text-white text-sm font-medium rounded-lg transition-colors
                                    flex items-center gap-2"
                            >
                                {isRefreshing ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Extending...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4" />
                                        Extend Session
                                    </>
                                )}
                            </button>
                            <button
                                onClick={onDismiss}
                                className="px-3 py-1.5 text-amber-700 dark:text-amber-300 text-sm hover:underline"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={onDismiss}
                        className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    )
}

// Modal shown when session has expired
function SessionExpiredModal({
    onRefresh,
    onLogin,
    isRefreshing
}: {
    onRefresh: () => Promise<boolean>
    onLogin: () => void
    isRefreshing: boolean
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl animate-scale-in">
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        Session Expired
                    </h3>
                    <p className="text-gray-600 dark:text-slate-400 mb-6">
                        Your session has expired for security reasons.
                        You can try to reconnect or sign in again.
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={onRefresh}
                            disabled={isRefreshing}
                            className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 
                                hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50
                                text-white font-medium rounded-xl transition-all
                                flex items-center justify-center gap-2"
                        >
                            {isRefreshing ? (
                                <>
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                    Reconnecting...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-5 h-5" />
                                    Try to Reconnect
                                </>
                            )}
                        </button>
                        <button
                            onClick={onLogin}
                            className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-700 
                                hover:bg-gray-200 dark:hover:bg-slate-600
                                text-gray-900 dark:text-white font-medium rounded-xl transition-colors
                                flex items-center justify-center gap-2"
                        >
                            <LogIn className="w-5 h-5" />
                            Sign In Again
                        </button>
                    </div>

                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-4">
                        Any unsaved changes may be lost
                    </p>
                </div>
            </div>
        </div>
    )
}

// Standalone hook for checking auth in API calls
export function useAuthCheck() {
    const supabase = createClient()

    const checkAuth = useCallback(async (): Promise<boolean> => {
        const { data: { session }, error } = await supabase.auth.getSession()
        return !error && !!session
    }, [supabase])

    const withAuth = useCallback(async <T,>(
        callback: () => Promise<T>,
        onUnauthorized?: () => void
    ): Promise<T | null> => {
        const isAuthed = await checkAuth()
        if (!isAuthed) {
            onUnauthorized?.()
            return null
        }
        return callback()
    }, [checkAuth])

    return { checkAuth, withAuth }
}
