import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export default async function AdminDashboardPage() {
    const supabase = await createClient()

    // Get stats
    const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

    const { count: totalContractors } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'contractor')

    const { count: pendingContractors } = await supabase
        .from('contractor_details')
        .select('*', { count: 'exact', head: true })
        .eq('verification_status', 'pending')

    const { count: totalProjects } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">
                    Admin Dashboard
                </h1>
                <p className="text-slate-400 mt-1">Manage users, contractors, and platform operations</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700">
                    <div className="text-3xl font-bold">{totalUsers || 0}</div>
                    <div className="text-slate-400 text-sm">Total Users</div>
                </div>
                <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700">
                    <div className="text-3xl font-bold">{totalContractors || 0}</div>
                    <div className="text-slate-400 text-sm">Contractors</div>
                </div>
                <Link
                    href="/admin/contractors"
                    className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
                >
                    <div className="text-3xl font-bold text-amber-400">{pendingContractors || 0}</div>
                    <div className="text-amber-300 text-sm">Pending Review →</div>
                </Link>
                <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700">
                    <div className="text-3xl font-bold">{totalProjects || 0}</div>
                    <div className="text-slate-400 text-sm">Total Projects</div>
                </div>
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link
                        href="/admin/contractors"
                        className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-colors"
                    >
                        <div className="font-medium">Review Contractors</div>
                        <div className="text-sm text-slate-400">Approve or reject pending applications</div>
                    </Link>
                    <Link
                        href="/admin/users"
                        className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-colors"
                    >
                        <div className="font-medium">Manage Users</div>
                        <div className="text-sm text-slate-400">View and manage all platform users</div>
                    </Link>
                    <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700 opacity-50">
                        <div className="font-medium">Analytics</div>
                        <div className="text-sm text-slate-400">Coming soon...</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
