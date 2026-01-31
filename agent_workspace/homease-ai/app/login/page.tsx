'use client'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/utils/supabase/client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const { isDark } = useTheme()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push('/dashboard')
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])

  // Theme-aware colors for Supabase Auth UI
  const authColors = isDark ? {
    brand: '#3b82f6',
    brandAccent: '#2563eb',
    brandButtonText: 'white',
    defaultButtonBackground: '#1e293b',
    defaultButtonBackgroundHover: '#334155',
    defaultButtonBorder: '#475569',
    defaultButtonText: 'white',
    inputBackground: '#0f172a',
    inputBorder: '#334155',
    inputBorderHover: '#3b82f6',
    inputBorderFocus: '#3b82f6',
    inputText: 'white',
    inputPlaceholder: '#64748b',
    inputLabelText: '#e2e8f0',
    anchorTextColor: '#60a5fa',
    anchorTextHoverColor: '#93c5fd',
  } : {
    brand: '#3b82f6',
    brandAccent: '#2563eb',
    brandButtonText: 'white',
    defaultButtonBackground: '#f1f5f9',
    defaultButtonBackgroundHover: '#e2e8f0',
    defaultButtonBorder: '#cbd5e1',
    defaultButtonText: '#1e293b',
    inputBackground: '#ffffff',
    inputBorder: '#cbd5e1',
    inputBorderHover: '#3b82f6',
    inputBorderFocus: '#3b82f6',
    inputText: '#1e293b',
    inputPlaceholder: '#94a3b8',
    inputLabelText: '#334155',
    anchorTextColor: '#3b82f6',
    anchorTextHoverColor: '#2563eb',
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-300 ${
      isDark 
        ? 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white' 
        : 'bg-gradient-to-b from-slate-100 via-white to-slate-100 text-gray-900'
    }`}>
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl animate-pulse ${
          isDark ? 'bg-blue-500/20' : 'bg-blue-500/10'
        }`} />
        <div className={`absolute top-1/2 -left-40 w-96 h-96 rounded-full blur-3xl animate-pulse ${
          isDark ? 'bg-cyan-500/10' : 'bg-cyan-500/5'
        }`} style={{ animationDelay: '1s' }} />
        <div className={`absolute -bottom-40 right-1/3 w-80 h-80 rounded-full blur-3xl animate-pulse ${
          isDark ? 'bg-blue-600/15' : 'bg-blue-600/10'
        }`} style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            HOMEase AI
          </span>
        </Link>

        {/* Auth Card */}
        <div className={`p-8 rounded-2xl backdrop-blur-sm transition-colors duration-300 ${
          isDark 
            ? 'bg-slate-800/50 border border-slate-700' 
            : 'bg-white/80 border border-gray-200 shadow-xl'
        }`}>
          <div className="text-center mb-6">
            <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Welcome to HOMEase
            </h1>
            <p className={isDark ? 'text-slate-400' : 'text-gray-500'}>
              Sign in or create an account to get started
            </p>
          </div>

          <Auth
            supabaseClient={supabase}
            view="sign_in"
            showLinks={true}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: authColors,
                  borderWidths: {
                    buttonBorderWidth: '1px',
                    inputBorderWidth: '1px',
                  },
                  radii: {
                    borderRadiusButton: '0.75rem',
                    buttonBorderRadius: '0.75rem',
                    inputBorderRadius: '0.75rem',
                  },
                  space: {
                    inputPadding: '0.75rem',
                    buttonPadding: '0.75rem',
                  },
                  fonts: {
                    bodyFontFamily: `inherit`,
                    buttonFontFamily: `inherit`,
                    inputFontFamily: `inherit`,
                    labelFontFamily: `inherit`,
                  },
                },
              },
              className: {
                container: 'auth-container',
                button: 'auth-button font-medium',
                input: 'auth-input',
                label: 'auth-label text-sm font-medium',
                anchor: 'auth-anchor text-sm',
              },
            }}
            providers={['google']}
            redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : ''}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Email address',
                  password_label: 'Password',
                  button_label: 'Sign In',
                  social_provider_text: 'Continue with {{provider}}',
                  link_text: "Don't have an account? Sign up",
                },
                sign_up: {
                  email_label: 'Email address',
                  password_label: 'Create a password',
                  button_label: 'Create Account',
                  social_provider_text: 'Continue with {{provider}}',
                  link_text: 'Already have an account? Sign in',
                },
              },
            }}
          />
        </div>

        {/* Footer */}
        <p className={`text-center text-sm mt-8 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
          By continuing, you agree to our{' '}
          <a href="#" className="text-blue-400 hover:text-blue-300">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-blue-400 hover:text-blue-300">Privacy Policy</a>
        </p>
      </div>
    </div>
  )
}
