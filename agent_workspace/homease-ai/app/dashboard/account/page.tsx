import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import AccountForm from "./account-form";
import Link from "next/link";

export default async function AccountPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Get contractor details if applicable
  let contractorDetails = null;
  if (profile?.role === 'contractor') {
    const { data } = await supabase
      .from('contractor_details')
      .select('*')
      .eq('profile_id', user.id)
      .single();
    contractorDetails = data;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white p-8 transition-colors">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white mb-4 flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
            Account Settings
          </h1>
          <p className="text-gray-600 dark:text-slate-400 mt-2">Manage your profile and preferences</p>
        </div>

        {/* Profile Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-2xl font-bold text-white dark:text-slate-900">
              {profile?.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{profile?.full_name || 'Set your name'}</h2>
              <p className="text-gray-500 dark:text-slate-400">{user.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 capitalize">
                {profile?.role || 'homeowner'}
              </span>
            </div>
          </div>

          <AccountForm user={user} profile={profile} contractorDetails={contractorDetails} />
        </div>

        {/* Security Section */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Security</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-slate-700/30">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Email</div>
                <div className="text-sm text-gray-500 dark:text-slate-400">{user.email}</div>
              </div>
              <span className="px-3 py-1 text-xs rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300">Verified</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-slate-700/30">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Password</div>
                <div className="text-sm text-gray-500 dark:text-slate-400">••••••••••</div>
              </div>
              <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">Change</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
