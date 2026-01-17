import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()
    profile = data
  }

  // If user is logged in and on dashboard, show dashboard header style
  // Otherwise show the public header

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 group">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            HOMEase AI
          </span>
        </Link>

        {user ? (
          /* Logged-in Navigation */
          <>
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
              >
                Dashboard
              </Link>
              {profile?.role === 'homeowner' && (
                <Link
                  href="/dashboard/assessment"
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                >
                  New Assessment
                </Link>
              )}
              {profile?.role === 'contractor' && (
                <Link
                  href="/dashboard"
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                >
                  My Leads
                </Link>
              )}
              {profile?.role === 'admin' && (
                <Link
                  href="/admin"
                  className="px-4 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-slate-800/50 rounded-lg transition-colors"
                >
                  Admin Panel
                </Link>
              )}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              <button className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>

              {/* Profile Link */}
              <Link
                href="/dashboard/account"
                className="flex items-center gap-3 px-3 py-1.5 hover:bg-slate-800/50 rounded-xl transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-sm font-bold text-slate-900">
                  {profile?.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-white">
                    {profile?.full_name || 'Account'}
                  </div>
                  <div className="text-xs text-slate-400 capitalize">
                    {profile?.role || 'User'}
                  </div>
                </div>
              </Link>
            </div>
          </>
        ) : (
          /* Logged-out Navigation */
          <>
            <nav className="hidden md:flex items-center gap-6">
              <a href="/#features" className="text-sm text-slate-300 hover:text-white transition-colors">Features</a>
              <a href="/#how-it-works" className="text-sm text-slate-300 hover:text-white transition-colors">How It Works</a>
              <a href="/#testimonials" className="text-sm text-slate-300 hover:text-white transition-colors">Testimonials</a>
            </nav>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm text-slate-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-5 py-2 text-sm bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-full font-medium transition-all hover:shadow-lg hover:shadow-blue-500/25"
              >
                Get Started
              </Link>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
