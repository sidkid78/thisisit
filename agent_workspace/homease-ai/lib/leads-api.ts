// Leads API client

import type { Lead, MarketplaceLead, LockLeadResponse, PurchaseLeadResponse } from './types'

const API_BASE = '/api'

/**
 * Fetch marketplace leads (public, AVAILABLE only)
 */
export async function getMarketplaceLeads(): Promise<MarketplaceLead[]> {
  const response = await fetch(`${API_BASE}/leads`)
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to fetch leads')
  }
  
  const leads = await response.json()
  
  // Transform to MarketplaceLead format
  return leads.map((lead: Lead) => ({
    ...lead,
    purchased: false,
    postedDate: lead.created_at,
  }))
}

/**
 * Fetch user's own leads (role-aware)
 */
export async function getMyLeads(): Promise<Lead[]> {
  const response = await fetch(`${API_BASE}/me/leads`)
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to fetch leads')
  }
  
  return response.json()
}

/**
 * Create a new lead (homeowner only)
 */
export async function createLead(data: {
  title: string
  location: string
  scope?: string
  price?: number
  tags?: string[]
  scopeTags?: string[]
  projectValue?: number
  scanId?: string
  previewImage?: string
}): Promise<Lead> {
  const response = await fetch(`${API_BASE}/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to create lead')
  }
  
  return response.json()
}

/**
 * Lock a lead for purchase (contractor only)
 */
export async function lockLead(leadId: string): Promise<LockLeadResponse> {
  const idempotencyKey = `lock_${leadId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const response = await fetch(`${API_BASE}/leads/${leadId}/lock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to lock lead')
  }
  
  return response.json()
}

/**
 * Complete lead purchase (contractor only, mock mode)
 */
export async function purchaseLead(leadId: string): Promise<PurchaseLeadResponse> {
  const response = await fetch(`${API_BASE}/leads/${leadId}/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to purchase lead')
  }
  
  return response.json()
}

/**
 * Combined lock + purchase for simplified flow
 */
export async function lockAndPurchaseLead(leadId: string): Promise<{ success: boolean; lead?: Lead; error?: string }> {
  try {
    // First lock the lead
    await lockLead(leadId)
    
    // Then complete purchase
    const result = await purchaseLead(leadId)
    
    return { success: true, lead: result.lead }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
