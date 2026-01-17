import { createClient } from '@/utils/supabase/server'
import ContractorReviewList from './ContractorReviewList'

export default async function ContractorsPage() {
    const supabase = await createClient()

    // Fetch all contractors with their profile info
    const { data: contractors } = await supabase
        .from('contractor_details')
        .select(`
      *,
      profiles!inner(id, full_name, avatar_url, role)
    `)
        .order('created_at', { ascending: false })

    // Fetch specialties for each contractor
    const contractorIds = contractors?.map(c => c.profile_id) || []
    const { data: specialties } = await supabase
        .from('contractor_specialties')
        .select('contractor_id, specialty')
        .in('contractor_id', contractorIds)

    // Group specialties by contractor
    const specialtiesByContractor: Record<string, string[]> = {}
    specialties?.forEach(s => {
        if (!specialtiesByContractor[s.contractor_id]) {
            specialtiesByContractor[s.contractor_id] = []
        }
        specialtiesByContractor[s.contractor_id].push(s.specialty)
    })

    // Attach specialties to contractors
    const contractorsWithSpecialties = contractors?.map(c => ({
        ...c,
        specialties: specialtiesByContractor[c.profile_id] || []
    })) || []

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Contractor Management</h1>
                <p className="text-slate-400">Review and manage contractor applications</p>
            </div>

            <ContractorReviewList contractors={contractorsWithSpecialties} />
        </div>
    )
}
