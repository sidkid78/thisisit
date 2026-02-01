-- Migration: Add geospatial test data for contractor matching
-- Creates demo contractors with service areas for testing

-- Helper function to create circular service area polygons
CREATE OR REPLACE FUNCTION create_circle_polygon(
    center_lat DOUBLE PRECISION,
    center_lng DOUBLE PRECISION,
    radius_miles DOUBLE PRECISION,
    num_points INTEGER DEFAULT 32
) RETURNS GEOMETRY AS $$
DECLARE
    lat_degrees DOUBLE PRECISION;
    lng_degrees DOUBLE PRECISION;
    angle DOUBLE PRECISION;
    points TEXT[];
    i INTEGER;
    point_lat DOUBLE PRECISION;
    point_lng DOUBLE PRECISION;
BEGIN
    -- Convert miles to degrees (approximate)
    lat_degrees := radius_miles / 69.0;
    lng_degrees := radius_miles / (69.0 * cos(radians(center_lat)));
    
    points := ARRAY[]::TEXT[];
    
    FOR i IN 0..num_points LOOP
        angle := (2 * pi() * i) / num_points;
        point_lat := center_lat + lat_degrees * sin(angle);
        point_lng := center_lng + lng_degrees * cos(angle);
        points := array_append(points, point_lng || ' ' || point_lat);
    END LOOP;
    
    RETURN ST_GeomFromText('POLYGON((' || array_to_string(points, ', ') || '))', 4326);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Insert demo contractor profiles (only if they don't exist)
DO $$
DECLARE
    contractor1_id UUID := '11111111-1111-1111-1111-111111111111';
    contractor2_id UUID := '22222222-2222-2222-2222-222222222222';
    contractor3_id UUID := '33333333-3333-3333-3333-333333333333';
    contractor4_id UUID := '44444444-4444-4444-4444-444444444444';
    contractor5_id UUID := '55555555-5555-5555-5555-555555555555';
BEGIN
    -- Austin Accessibility Pros (Austin, TX - 30mi radius)
    INSERT INTO profiles (id, email, full_name, user_type, is_caps_certified, years_experience, 
                         license_number, verification_status, service_area_radius, service_area)
    VALUES (
        contractor1_id,
        'austin.pros@demo.homease.ai',
        'Austin Accessibility Pros',
        'contractor',
        true,
        12,
        'TX-AAP-2024-001',
        'approved',
        30,
        create_circle_polygon(30.2672, -97.7431, 30)
    ) ON CONFLICT (id) DO UPDATE SET
        service_area = create_circle_polygon(30.2672, -97.7431, 30),
        verification_status = 'approved';

    -- Gulf Coast Home Mods (Houston, TX - 40mi radius)
    INSERT INTO profiles (id, email, full_name, user_type, is_caps_certified, years_experience,
                         license_number, verification_status, service_area_radius, service_area)
    VALUES (
        contractor2_id,
        'gulfcoast@demo.homease.ai',
        'Gulf Coast Home Mods',
        'contractor',
        true,
        15,
        'TX-GCHM-2023-042',
        'approved',
        40,
        create_circle_polygon(29.7604, -95.3698, 40)
    ) ON CONFLICT (id) DO UPDATE SET
        service_area = create_circle_polygon(29.7604, -95.3698, 40),
        verification_status = 'approved';

    -- Bay Area Senior Solutions (San Francisco, CA - 25mi radius)
    INSERT INTO profiles (id, email, full_name, user_type, is_caps_certified, years_experience,
                         license_number, verification_status, service_area_radius, service_area)
    VALUES (
        contractor3_id,
        'bayarea@demo.homease.ai',
        'Bay Area Senior Solutions',
        'contractor',
        true,
        8,
        'CA-BASS-2024-108',
        'approved',
        25,
        create_circle_polygon(37.7749, -122.4194, 25)
    ) ON CONFLICT (id) DO UPDATE SET
        service_area = create_circle_polygon(37.7749, -122.4194, 25),
        verification_status = 'approved';

    -- Mile High Accessibility (Denver, CO - 35mi radius)
    INSERT INTO profiles (id, email, full_name, user_type, is_caps_certified, years_experience,
                         license_number, verification_status, service_area_radius, service_area)
    VALUES (
        contractor4_id,
        'milehigh@demo.homease.ai',
        'Mile High Accessibility',
        'contractor',
        false,
        6,
        'CO-MHA-2024-055',
        'approved',
        35,
        create_circle_polygon(39.7392, -104.9903, 35)
    ) ON CONFLICT (id) DO UPDATE SET
        service_area = create_circle_polygon(39.7392, -104.9903, 35),
        verification_status = 'approved';

    -- South Florida Safe Homes (Miami, FL - 30mi radius)
    INSERT INTO profiles (id, email, full_name, user_type, is_caps_certified, years_experience,
                         license_number, verification_status, service_area_radius, service_area)
    VALUES (
        contractor5_id,
        'southfl@demo.homease.ai',
        'South Florida Safe Homes',
        'contractor',
        true,
        10,
        'FL-SFSH-2023-201',
        'approved',
        30,
        create_circle_polygon(25.7617, -80.1918, 30)
    ) ON CONFLICT (id) DO UPDATE SET
        service_area = create_circle_polygon(25.7617, -80.1918, 30),
        verification_status = 'approved';

    -- Add skills for each contractor
    -- Austin Accessibility Pros
    INSERT INTO contractor_skills (contractor_id, skill_name) VALUES
        (contractor1_id, 'Walk-in Shower'),
        (contractor1_id, 'Grab Bars'),
        (contractor1_id, 'Wheelchair Ramps'),
        (contractor1_id, 'Bathroom Modifications'),
        (contractor1_id, 'Stair Lifts')
    ON CONFLICT DO NOTHING;

    -- Gulf Coast Home Mods
    INSERT INTO contractor_skills (contractor_id, skill_name) VALUES
        (contractor2_id, 'Walk-in Shower'),
        (contractor2_id, 'Grab Bars'),
        (contractor2_id, 'Door Widening'),
        (contractor2_id, 'Kitchen Modifications'),
        (contractor2_id, 'Non-slip Flooring')
    ON CONFLICT DO NOTHING;

    -- Bay Area Senior Solutions
    INSERT INTO contractor_skills (contractor_id, skill_name) VALUES
        (contractor3_id, 'Walk-in Shower'),
        (contractor3_id, 'Grab Bars'),
        (contractor3_id, 'Wheelchair Ramps'),
        (contractor3_id, 'Smart Home Integration'),
        (contractor3_id, 'Lighting Improvements')
    ON CONFLICT DO NOTHING;

    -- Mile High Accessibility
    INSERT INTO contractor_skills (contractor_id, skill_name) VALUES
        (contractor4_id, 'Grab Bars'),
        (contractor4_id, 'Handrails'),
        (contractor4_id, 'Non-slip Flooring'),
        (contractor4_id, 'Bathroom Modifications')
    ON CONFLICT DO NOTHING;

    -- South Florida Safe Homes
    INSERT INTO contractor_skills (contractor_id, skill_name) VALUES
        (contractor5_id, 'Walk-in Shower'),
        (contractor5_id, 'Grab Bars'),
        (contractor5_id, 'Wheelchair Ramps'),
        (contractor5_id, 'Pool Safety'),
        (contractor5_id, 'Hurricane-Resistant Modifications')
    ON CONFLICT DO NOTHING;

END $$;

-- Create spatial index on service_area for faster matching queries
CREATE INDEX IF NOT EXISTS idx_profiles_service_area_gist 
ON profiles USING GIST (service_area);

-- Add comment documenting the demo data
COMMENT ON FUNCTION create_circle_polygon IS 'Creates a circular polygon for contractor service areas. Used for geospatial matching.';
