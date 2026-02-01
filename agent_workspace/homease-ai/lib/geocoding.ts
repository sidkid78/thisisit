/**
 * Geocoding utilities for converting addresses to coordinates
 * and creating PostGIS-compatible geometry data
 */

export interface GeocodingResult {
    lat: number
    lng: number
    formattedAddress?: string
}

interface AddressData {
    street?: string
    city: string
    state: string
    zip: string
}

// Major US cities fallback coordinates for when API is unavailable
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
    'austin,tx': { lat: 30.2672, lng: -97.7431 },
    'houston,tx': { lat: 29.7604, lng: -95.3698 },
    'dallas,tx': { lat: 32.7767, lng: -96.7970 },
    'san antonio,tx': { lat: 29.4241, lng: -98.4936 },
    'fort worth,tx': { lat: 32.7555, lng: -97.3308 },
    'san francisco,ca': { lat: 37.7749, lng: -122.4194 },
    'los angeles,ca': { lat: 34.0522, lng: -118.2437 },
    'san diego,ca': { lat: 32.7157, lng: -117.1611 },
    'san jose,ca': { lat: 37.3382, lng: -121.8863 },
    'denver,co': { lat: 39.7392, lng: -104.9903 },
    'miami,fl': { lat: 25.7617, lng: -80.1918 },
    'orlando,fl': { lat: 28.5383, lng: -81.3792 },
    'tampa,fl': { lat: 27.9506, lng: -82.4572 },
    'jacksonville,fl': { lat: 30.3322, lng: -81.6557 },
    'new york,ny': { lat: 40.7128, lng: -74.0060 },
    'chicago,il': { lat: 41.8781, lng: -87.6298 },
    'phoenix,az': { lat: 33.4484, lng: -112.0740 },
    'seattle,wa': { lat: 47.6062, lng: -122.3321 },
    'portland,or': { lat: 45.5051, lng: -122.6750 },
    'atlanta,ga': { lat: 33.7490, lng: -84.3880 },
    'boston,ma': { lat: 42.3601, lng: -71.0589 },
    'philadelphia,pa': { lat: 39.9526, lng: -75.1652 },
    'washington,dc': { lat: 38.9072, lng: -77.0369 },
    'las vegas,nv': { lat: 36.1699, lng: -115.1398 },
    'nashville,tn': { lat: 36.1627, lng: -86.7816 },
    'minneapolis,mn': { lat: 44.9778, lng: -93.2650 },
    'detroit,mi': { lat: 42.3314, lng: -83.0458 },
    'charlotte,nc': { lat: 35.2271, lng: -80.8431 },
    'raleigh,nc': { lat: 35.7796, lng: -78.6382 },
    'cleveland,oh': { lat: 41.4993, lng: -81.6944 },
    'columbus,oh': { lat: 39.9612, lng: -82.9988 },
    'indianapolis,in': { lat: 39.7684, lng: -86.1581 },
    'kansas city,mo': { lat: 39.0997, lng: -94.5786 },
    'st louis,mo': { lat: 38.6270, lng: -90.1994 },
    'new orleans,la': { lat: 29.9511, lng: -90.0715 },
    'salt lake city,ut': { lat: 40.7608, lng: -111.8910 },
    'pittsburgh,pa': { lat: 40.4406, lng: -79.9959 },
    'baltimore,md': { lat: 39.2904, lng: -76.6122 },
    'milwaukee,wi': { lat: 43.0389, lng: -87.9065 },
    'albuquerque,nm': { lat: 35.0844, lng: -106.6504 },
}

/**
 * Geocode an address using Google Maps API with fallback to city coordinates
 */
export async function geocodeAddress(address: AddressData): Promise<GeocodingResult | null> {
    const fullAddress = [
        address.street,
        address.city,
        address.state,
        address.zip
    ].filter(Boolean).join(', ')

    // Try Google Maps API first
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (apiKey) {
        try {
            const encodedAddress = encodeURIComponent(fullAddress)
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`
            )
            const data = await response.json()

            if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
                const { lat, lng } = data.results[0].geometry.location
                return {
                    lat,
                    lng,
                    formattedAddress: data.results[0].formatted_address
                }
            }
        } catch (error) {
            console.error('Google Maps API error:', error)
        }
    }

    // Fallback to city coordinates
    const cityKey = `${address.city.toLowerCase()},${address.state.toLowerCase()}`
    const cityCoords = CITY_COORDINATES[cityKey]
    if (cityCoords) {
        // Add slight random offset for city-level coordinates (within ~5 miles)
        const offset = 0.05
        return {
            lat: cityCoords.lat + (Math.random() - 0.5) * offset,
            lng: cityCoords.lng + (Math.random() - 0.5) * offset,
            formattedAddress: fullAddress
        }
    }

    // Try state-level fallback by finding any city in the state
    const stateKey = address.state.toLowerCase()
    for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
        if (key.endsWith(`,${stateKey}`)) {
            const offset = 0.1
            return {
                lat: coords.lat + (Math.random() - 0.5) * offset,
                lng: coords.lng + (Math.random() - 0.5) * offset,
                formattedAddress: fullAddress
            }
        }
    }

    console.warn('Could not geocode address:', fullAddress)
    return null
}

/**
 * Convert lat/lng coordinates to PostGIS WKT Point format
 * Uses SRID 4326 (WGS84) for geographic coordinates
 */
export function toPostGISPoint(lat: number, lng: number): string {
    // PostGIS expects POINT(longitude latitude) order
    return `SRID=4326;POINT(${lng} ${lat})`
}

/**
 * Create a circular service area polygon for a contractor
 * @param centerLat Center latitude
 * @param centerLng Center longitude  
 * @param radiusMiles Radius in miles
 * @param numPoints Number of points for the polygon (default 32)
 */
export function createServiceAreaPolygon(
    centerLat: number,
    centerLng: number,
    radiusMiles: number,
    numPoints: number = 32
): string {
    // Convert miles to degrees (approximate)
    // 1 degree of latitude ≈ 69 miles
    // 1 degree of longitude varies by latitude
    const latDegrees = radiusMiles / 69
    const lngDegrees = radiusMiles / (69 * Math.cos(centerLat * Math.PI / 180))

    const points: string[] = []
    for (let i = 0; i <= numPoints; i++) {
        const angle = (2 * Math.PI * i) / numPoints
        const lat = centerLat + latDegrees * Math.sin(angle)
        const lng = centerLng + lngDegrees * Math.cos(angle)
        points.push(`${lng} ${lat}`)
    }

    return `SRID=4326;POLYGON((${points.join(', ')}))`
}

/**
 * Calculate distance between two points in miles using Haversine formula
 */
export function calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 3959 // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}
