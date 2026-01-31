// Types for HOMEase AI

export type UserRole = 'homeowner' | 'contractor' | 'admin'

export type JobStatus = 
  | 'AVAILABLE' 
  | 'LOCKED' 
  | 'PURCHASED' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'ARCHIVED'

export interface User {
  id: string
  email: string
  name?: string
  role: UserRole
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface ContractorProfile {
  id: string
  user_id: string
  company_name: string
  contact_name: string
  email: string
  phone: string
  license_number?: string
  insurance_url?: string
  service_areas: string[]
  services_offered: string[]
  caps_certified: boolean
  years_experience?: number
  created_at: string
  updated_at: string
}

export interface ScanSession {
  id: string
  homeowner_id: string
  original_image_url?: string
  generated_image_url?: string
  room_type?: string
  analysis_result?: AnalysisResult
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  homeowner_id: string
  contractor_id?: string
  fingerprint?: string
  title: string
  location: string
  scope?: string
  description?: string
  price: number
  status: JobStatus
  project_value?: number
  estimated_value?: number
  tags: string[]
  scope_tags: string[]
  preview_image?: string
  scan_id?: string
  assessment_id?: string
  project_id?: string
  accessibility_score?: number
  locked_at?: string
  locked_by_id?: string
  stripe_payment_intent_id?: string
  purchased_at?: string
  completed_at?: string
  current_stage?: string
  progress?: number
  view_count?: number
  created_at: string
  updated_at: string
}

export interface MarketplaceLead extends Lead {
  purchased?: boolean
  postedDate?: string
}

export interface LeadEvent {
  id: string
  lead_id: string
  actor_id?: string
  type: string
  metadata?: Record<string, any>
  created_at: string
}

export interface AnalysisResult {
  accessibility_score: number
  identified_hazards: Array<{
    hazard: string
    details: string
    area: string
    severity?: 'High' | 'Medium' | 'Low'
    position?: { x: number; y: number }
  }>
  recommendations: Array<{
    recommendation: string
    details: string
    priority?: 'High' | 'Medium' | 'Low'
  }>
  cost_estimate_min?: number
  cost_estimate_max?: number
  materials_needed?: string[]
  estimated_measurements?: {
    doorway_width_inches?: number
    aisle_width_inches?: number
    threshold_height_inches?: number
    grab_bar_length_inches?: number
    ramp_length_feet?: number
    [key: string]: number | undefined
  }
}

// API Response types
export interface ApiError {
  errorCode: string
  message: string
  details?: any
}

export interface LockLeadResponse {
  lead: Lead
  clientSecret?: string
  message: string
}

export interface PurchaseLeadResponse {
  status: JobStatus
  lead: Lead
  message: string
}
