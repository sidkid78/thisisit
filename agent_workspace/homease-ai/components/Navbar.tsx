'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { LogOut, User as UserIcon, Menu, X, Home, Sun, Moon } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { useTheme } from '@/contexts/ThemeContext'

interface Profile {
  id: string
  full_name: string | null
  role: 'homeowner' | 'contractor' | 'admin'
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const { theme, toggleTheme, isDark } = useTheme()

  useEffect(() => {
    const supabase = createClient()

    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('id', user.id)
          .single()
        
        setProfile(profileData)
      }
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setIsOpen(false)
    window.location.href = '/'
  }

  // Dynamic links based on user role
  const getLinks = () => {
    if (!user || !profile) return []

    switch (profile.role) {
      case 'homeowner':
        return [
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'New Assessment', path: '/dashboard/assessment' },
        ]
      case 'contractor':
        return [
          { label: 'Lead Market', path: '/dashboard/marketplace' },
          { label: 'My Jobs', path: '/dashboard/jobs' },
        ]
      case 'admin':
        return [
          { label: 'Overview', path: '/admin' },
          { label: 'Users', path: '/admin/users' },
        ]
      default:
        return []
    }
  }

  const links = getLinks()
  const isActive = (path: string) => pathname === path

  // Don't show navbar on landing page if not logged in
  const isLandingPage = pathname === '/'
  
  return (
    <nav className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-50 transition-colors duration-300" aria-label="Main Navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Desktop Nav */}
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center cursor-pointer gap-2" aria-label="HOMEase AI Home">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 dark:bg-blue-500/30 flex items-center justify-center">
                <Home className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight whitespace-nowrap">HOMEase | AI</span>
            </Link>

            {user && links.length > 0 && (
              <div className="hidden md:ml-8 md:flex md:space-x-4 lg:space-x-8">
                {links.map((link) => (
                  <Link
                    key={link.path}
                    href={link.path}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap relative
                      ${isActive(link.path)
                        ? 'border-blue-500 text-gray-900 dark:text-white'
                        : 'border-transparent text-gray-500 dark:text-slate-400 hover:border-blue-300 hover:text-gray-900 dark:hover:text-white'
                      }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Right Side Actions */}
          <div className="hidden md:flex items-center gap-2 lg:gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600 hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? (
                <Sun className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Moon className="h-5 w-5" aria-hidden="true" />
              )}
            </button>

            {loading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 animate-pulse" />
            ) : user && profile ? (
              <div className="flex items-center space-x-2 lg:space-x-4">
                <div className="flex flex-col text-right mr-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                    {profile.full_name || user.email?.split('@')[0]}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">{profile.role}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-gray-100 dark:bg-slate-700 p-2 rounded-full text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600 hover:text-red-500 focus:outline-none transition-colors"
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="space-x-2 lg:space-x-4 flex items-center">
                <Link href="/login" className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white font-medium transition-colors text-sm lg:text-base">
                  Login
                </Link>
                <Link href="/login" className="bg-blue-600 text-white px-3 py-1.5 lg:px-4 lg:py-2 rounded-md font-medium hover:bg-blue-700 transition-colors text-sm lg:text-base whitespace-nowrap">
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden gap-2">
            {/* Mobile Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? (
                <Sun className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Moon className="h-5 w-5" aria-hidden="true" />
              )}
            </button>

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none"
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
              aria-label="Open main menu"
            >
              {isOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 animate-fade-in" id="mobile-menu">
          <div className="pt-2 pb-3 space-y-1 px-2">
            {user && links.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                onClick={() => setIsOpen(false)}
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors flex items-center justify-between
                  ${isActive(link.path)
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:border-blue-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <span>{link.label}</span>
              </Link>
            ))}
            {!user && (
              <>
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white"
                >
                  Login
                </Link>
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="block pl-3 pr-4 py-2 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-base font-medium text-blue-700 dark:text-blue-400"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
          {user && profile && (
            <div className="pt-4 pb-4 border-t border-gray-200 dark:border-slate-700">
              <div className="flex items-center px-4">
                <div className="flex-shrink-0">
                  <UserIcon className="h-10 w-10 rounded-full bg-gray-100 dark:bg-slate-700 p-2 text-gray-500 dark:text-slate-400" />
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-900 dark:text-white">
                    {profile.full_name || user.email?.split('@')[0]}
                  </div>
                  <div className="text-sm font-medium text-gray-500 dark:text-slate-400">{user.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-auto bg-transparent flex-shrink-0 p-1 rounded-full text-gray-500 dark:text-slate-400 hover:text-red-500 focus:outline-none"
                  aria-label="Log out"
                >
                  <LogOut className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
