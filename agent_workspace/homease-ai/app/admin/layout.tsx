import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Check if user is admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        redirect('/dashboard')
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Admin Header */}
            <header className="border-b border-slate-800 bg-slate-900/50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link href="/admin" className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-sm font-bold">
                                A
                            </div>
                            <span className="font-semibold text-lg">Admin Panel</span>
                        </Link>
                        <nav className="flex items-center gap-4">
                            <Link
                                href="/admin"
                                className="text-sm text-slate-400 hover:text-white transition-colors"
                            >
                                Dashboard
                            </Link>
                            <Link
                                href="/admin/contractors"
                                className="text-sm text-slate-400 hover:text-white transition-colors"
                            >
                                Contractors
                            </Link>
                            <Link
                                href="/admin/users"
                                className="text-sm text-slate-400 hover:text-white transition-colors"
                            >
                                Users
                            </Link>
                        </nav>
                    </div>
                    <Link
                        href="/dashboard"
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        ← Back to Dashboard
                    </Link>
                </div>
            </header>

            {/* Admin Content */}
            <main className="max-w-7xl mx-auto p-6">
                {children}
            </main>
        </div>
    )
}
