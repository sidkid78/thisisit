'use client'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SpecialtySelection from '@/components/SpecialtySelection'

type Profile = {
  full_name: string | null
  avatar_url: string | null
  role: string | null
} | null

type ContractorDetails = {
  company_name: string | null
  bio: string | null
  phone_number: string | null
  website_url: string | null
  address: {
    street?: string
    city?: string
    state?: string
    zip?: string
  } | null
  is_caps_certified: boolean
  license_number: string | null
  service_radius_miles: number | null
  verification_status: string | null
} | null

export default function AccountForm({
  user,
  profile,
  contractorDetails
}: {
  user: User
  profile: Profile
  contractorDetails?: ContractorDetails
}) {
  const supabase = createClient()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'basic' | 'business' | 'credentials' | 'specialties'>('basic')

  // Basic profile fields
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [role, setRole] = useState(profile?.role || 'homeowner')

  // Contractor business info
  const [companyName, setCompanyName] = useState(contractorDetails?.company_name || '')
  const [bio, setBio] = useState(contractorDetails?.bio || '')
  const [phone, setPhone] = useState(contractorDetails?.phone_number || '')
  const [website, setWebsite] = useState(contractorDetails?.website_url || '')
  const [serviceRadius, setServiceRadius] = useState(contractorDetails?.service_radius_miles || 25)

  // Address fields
  const [street, setStreet] = useState(contractorDetails?.address?.street || '')
  const [city, setCity] = useState(contractorDetails?.address?.city || '')
  const [state, setState] = useState(contractorDetails?.address?.state || '')
  const [zip, setZip] = useState(contractorDetails?.address?.zip || '')

  // Credentials
  const [isCaps, setIsCaps] = useState(contractorDetails?.is_caps_certified || false)
  const [licenseNumber, setLicenseNumber] = useState(contractorDetails?.license_number || '')

  // Compute profile completion percentage
  const getProfileCompletion = () => {
    if (role !== 'contractor') return 100
    const fields = [companyName, phone, bio, street, city, state, zip]
    const filled = fields.filter(f => f && f.trim() !== '').length
    return Math.round((filled / fields.length) * 100)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          role: role,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })

      if (profileError) throw profileError

      // If contractor, update contractor details
      if (role === 'contractor') {
        const contractorData = {
          profile_id: user.id,
          company_name: companyName || null,
          bio: bio || null,
          phone_number: phone || null,
          website_url: website || null,
          address: {
            street: street || null,
            city: city || null,
            state: state || null,
            zip: zip || null,
          },
          is_caps_certified: isCaps,
          license_number: licenseNumber || null,
          service_radius_miles: serviceRadius,
          updated_at: new Date().toISOString(),
        }

        const { error: contractorError } = await supabase
          .from('contractor_details')
          .upsert(contractorData, { onConflict: 'profile_id' })

        if (contractorError) throw contractorError
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' })
      router.refresh()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  const completion = getProfileCompletion()

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Profile Completion Banner for Contractors */}
      {role === 'contractor' && completion < 100 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-amber-300 font-medium">Complete your profile to receive leads</span>
            <span className="text-amber-400 text-sm">{completion}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      )}

      {/* Basic Info (Always visible) */}
      <div className="space-y-4">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium mb-2">Full Name</label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <div className="px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-400">
            {user.email}
          </div>
        </div>
      </div>

      {/* Role Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">I am a...</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRole('homeowner')}
            className={`p-4 rounded-xl border transition-all text-left ${role === 'homeowner'
              ? 'bg-blue-500/20 border-blue-500 text-blue-300'
              : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
              }`}
          >
            <div className="font-medium">Homeowner</div>
            <div className="text-sm text-slate-400">Get safety assessments</div>
          </button>
          <button
            type="button"
            onClick={() => setRole('contractor')}
            className={`p-4 rounded-xl border transition-all text-left ${role === 'contractor'
              ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
              : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
              }`}
          >
            <div className="font-medium">Contractor</div>
            <div className="text-sm text-slate-400">Find leads & projects</div>
          </button>
        </div>
      </div>

      {/* Contractor Details - Tabbed Interface */}
      {role === 'contractor' && (
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-700 bg-slate-800/30">
            {[
              { id: 'basic', label: 'Business Info', icon: '🏢' },
              { id: 'business', label: 'Location', icon: '📍' },
              { id: 'credentials', label: 'Credentials', icon: '📜' },
              { id: 'specialties', label: 'Specialties', icon: '🔧' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
                  ? 'bg-slate-700/50 text-white border-b-2 border-cyan-500'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-5 space-y-4 bg-slate-800/20">
            {/* Basic Business Info Tab */}
            {activeTab === 'basic' && (
              <>
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium mb-2">
                    Company Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g., Smith Home Modifications LLC"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium mb-2">
                    Business Phone <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="website" className="block text-sm font-medium mb-2">Website</label>
                  <input
                    id="website"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://yourcompany.com"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="bio" className="block text-sm font-medium mb-2">
                    About Your Business <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Share your experience with accessibility modifications, certifications, and why homeowners should choose you..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 focus:outline-none transition-colors resize-none"
                  />
                  <p className="mt-1 text-xs text-slate-500">{bio.length}/500 characters</p>
                </div>
              </>
            )}

            {/* Location & Service Tab */}
            {activeTab === 'business' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label htmlFor="street" className="block text-sm font-medium mb-2">
                      Business Address
                    </label>
                    <input
                      id="street"
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Street address"
                      className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="city" className="block text-sm font-medium mb-2">City</label>
                    <input
                      id="city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="state" className="block text-sm font-medium mb-2">State</label>
                      <input
                        id="state"
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="TX"
                        maxLength={2}
                        className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 focus:outline-none transition-colors uppercase"
                      />
                    </div>
                    <div>
                      <label htmlFor="zip" className="block text-sm font-medium mb-2">ZIP Code</label>
                      <input
                        id="zip"
                        type="text"
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                        placeholder="75001"
                        maxLength={10}
                        className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="serviceRadius" className="block text-sm font-medium mb-2">
                    Service Radius: <span className="text-cyan-400">{serviceRadius} miles</span>
                  </label>
                  <input
                    id="serviceRadius"
                    type="range"
                    value={serviceRadius}
                    onChange={(e) => setServiceRadius(parseInt(e.target.value))}
                    min={5}
                    max={200}
                    step={5}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-700 accent-cyan-500"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>5 mi</span>
                    <span>100 mi</span>
                    <span>200 mi</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-700/30 border border-slate-600">
                  <p className="text-sm text-slate-400">
                    📍 <strong className="text-white">Service Area Map</strong> — Coming soon!
                    You'll be able to draw your exact service coverage on an interactive map.
                  </p>
                </div>
              </>
            )}

            {/* Credentials Tab */}
            {activeTab === 'credentials' && (
              <>
                <label className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700 cursor-pointer hover:border-cyan-500/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={isCaps}
                    onChange={(e) => setIsCaps(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                  />
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      CAPS Certified
                      {isCaps && <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Verified</span>}
                    </div>
                    <div className="text-sm text-slate-400">Certified Aging-in-Place Specialist (NAHB)</div>
                  </div>
                </label>

                <div>
                  <label htmlFor="licenseNumber" className="block text-sm font-medium mb-2">Contractor License Number</label>
                  <input
                    id="licenseNumber"
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="e.g., TX123456789"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-700/30 border border-slate-600">
                  <p className="text-sm text-slate-400">
                    📄 <strong className="text-white">Document Upload</strong> — Coming soon!
                    Upload your license, insurance certificates, and CAPS certification for verification.
                  </p>
                </div>

                {/* Verification Status */}
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Verification Status</div>
                      <div className="text-sm text-slate-400">Your profile verification progress</div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${contractorDetails?.verification_status === 'approved'
                      ? 'bg-green-500/20 text-green-400'
                      : contractorDetails?.verification_status === 'rejected'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-amber-500/20 text-amber-400'
                      }`}>
                      {contractorDetails?.verification_status === 'approved' ? '✓ Verified'
                        : contractorDetails?.verification_status === 'rejected' ? '✗ Rejected'
                          : '⏳ Pending Review'}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Specialties Tab */}
            {activeTab === 'specialties' && (
              <SpecialtySelection
                contractorId={user.id}
                onUpdate={() => router.refresh()}
              />
            )}
          </div>
        </div>
      )}

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-xl ${message.type === 'success'
          ? 'bg-green-500/20 border border-green-500/30 text-green-300'
          : 'bg-red-500/20 border border-red-500/30 text-red-300'
          }`}>
          {message.text}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={handleSignOut}
          className="px-6 py-3 text-slate-400 hover:text-white transition-colors"
        >
          Sign Out
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 rounded-xl font-medium transition-all"
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
