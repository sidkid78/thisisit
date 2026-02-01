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
    
    current_skill_id INTEGER;
    skill_names TEXT[];
    s_name TEXT;
BEGIN
    -- 1. Ensure users exist in auth.users
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, aud, role)
    VALUES 
        (contractor1_id, 'austin.pros@demo.homease.ai', '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhash', now(), 'authenticated', 'authenticated'),
        (contractor2_id, 'gulfcoast@demo.homease.ai', '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhash', now(), 'authenticated', 'authenticated'),
        (contractor3_id, 'bayarea@demo.homease.ai', '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhash', now(), 'authenticated', 'authenticated'),
        (contractor4_id, 'milehigh@demo.homease.ai', '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhash', now(), 'authenticated', 'authenticated'),
        (contractor5_id, 'southfl@demo.homease.ai', '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhash', now(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;

    -- 2. Insert Profiles
    INSERT INTO profiles (id, full_name, role)
    VALUES 
        (contractor1_id, 'Austin Accessibility Pros', 'contractor'),
        (contractor2_id, 'Gulf Coast Home Mods', 'contractor'),
        (contractor3_id, 'Bay Area Senior Solutions', 'contractor'),
        (contractor4_id, 'Mile High Accessibility', 'contractor'),
        (contractor5_id, 'South Florida Safe Homes', 'contractor')
    ON CONFLICT (id) DO UPDATE SET role = 'contractor';

    -- 3. Insert Contractor Details
    
    -- Austin Accessibility Pros (Austin, TX - 30mi radius)
    INSERT INTO contractor_details (profile_id, company_name, is_caps_certified, license_number, verification_status, service_radius_miles, service_area)
    VALUES (contractor1_id, 'Austin Accessibility Pros', true, 'TX-AAP-2024-001', 'approved', 30, create_circle_polygon(30.2672, -97.7431, 30))
    ON CONFLICT (profile_id) DO UPDATE SET
        service_area = EXCLUDED.service_area,
        verification_status = 'approved';

    -- Gulf Coast Home Mods (Houston, TX - 40mi radius)
    INSERT INTO contractor_details (profile_id, company_name, is_caps_certified, license_number, verification_status, service_radius_miles, service_area)
    VALUES (contractor2_id, 'Gulf Coast Home Mods', true, 'TX-GCHM-2023-042', 'approved', 40, create_circle_polygon(29.7604, -95.3698, 40))
    ON CONFLICT (profile_id) DO UPDATE SET
        service_area = EXCLUDED.service_area,
        verification_status = 'approved';

    -- Bay Area Senior Solutions (San Francisco, CA - 25mi radius)
    INSERT INTO contractor_details (profile_id, company_name, is_caps_certified, license_number, verification_status, service_radius_miles, service_area)
    VALUES (contractor3_id, 'Bay Area Senior Solutions', true, 'CA-BASS-2024-108', 'approved', 25, create_circle_polygon(37.7749, -122.4194, 25))
    ON CONFLICT (profile_id) DO UPDATE SET
        service_area = EXCLUDED.service_area,
        verification_status = 'approved';

    -- Mile High Accessibility (Denver, CO - 35mi radius)
    INSERT INTO contractor_details (profile_id, company_name, is_caps_certified, license_number, verification_status, service_radius_miles, service_area)
    VALUES (contractor4_id, 'Mile High Accessibility', false, 'CO-MHA-2024-055', 'approved', 35, create_circle_polygon(39.7392, -104.9903, 35))
    ON CONFLICT (profile_id) DO UPDATE SET
        service_area = EXCLUDED.service_area,
        verification_status = 'approved';

    -- South Florida Safe Homes (Miami, FL - 30mi radius)
    INSERT INTO contractor_details (profile_id, company_name, is_caps_certified, license_number, verification_status, service_radius_miles, service_area)
    VALUES (contractor5_id, 'South Florida Safe Homes', true, 'FL-SFSH-2023-201', 'approved', 30, create_circle_polygon(25.7617, -80.1918, 30))
    ON CONFLICT (profile_id) DO UPDATE SET
        service_area = EXCLUDED.service_area,
        verification_status = 'approved';

    -- 4. Skills
    
    -- Austin Skills
    skill_names := ARRAY['Walk-in Shower', 'Grab Bars', 'Wheelchair Ramps', 'Bathroom Modifications', 'Stair Lifts'];
    FOREACH s_name IN ARRAY skill_names LOOP
        INSERT INTO skills (name) VALUES (s_name) ON CONFLICT (name) DO NOTHING;
        SELECT id INTO current_skill_id FROM skills WHERE name = s_name;
        INSERT INTO contractor_skills (contractor_id, skill_id) VALUES (contractor1_id, current_skill_id) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Gulf Coast Skills
    skill_names := ARRAY['Walk-in Shower', 'Grab Bars', 'Door Widening', 'Kitchen Modifications', 'Non-slip Flooring'];
    FOREACH s_name IN ARRAY skill_names LOOP
        INSERT INTO skills (name) VALUES (s_name) ON CONFLICT (name) DO NOTHING;
        SELECT id INTO current_skill_id FROM skills WHERE name = s_name;
        INSERT INTO contractor_skills (contractor_id, skill_id) VALUES (contractor2_id, current_skill_id) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Bay Area Skills
    skill_names := ARRAY['Walk-in Shower', 'Grab Bars', 'Wheelchair Ramps', 'Smart Home Integration', 'Lighting Improvements'];
    FOREACH s_name IN ARRAY skill_names LOOP
        INSERT INTO skills (name) VALUES (s_name) ON CONFLICT (name) DO NOTHING;
        SELECT id INTO current_skill_id FROM skills WHERE name = s_name;
        INSERT INTO contractor_skills (contractor_id, skill_id) VALUES (contractor3_id, current_skill_id) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Mile High Skills
    skill_names := ARRAY['Grab Bars', 'Handrails', 'Non-slip Flooring', 'Bathroom Modifications'];
    FOREACH s_name IN ARRAY skill_names LOOP
        INSERT INTO skills (name) VALUES (s_name) ON CONFLICT (name) DO NOTHING;
        SELECT id INTO current_skill_id FROM skills WHERE name = s_name;
        INSERT INTO contractor_skills (contractor_id, skill_id) VALUES (contractor4_id, current_skill_id) ON CONFLICT DO NOTHING;
    END LOOP;

    -- South Florida Skills
    skill_names := ARRAY['Walk-in Shower', 'Grab Bars', 'Wheelchair Ramps', 'Pool Safety', 'Hurricane-Resistant Modifications'];
    FOREACH s_name IN ARRAY skill_names LOOP
        INSERT INTO skills (name) VALUES (s_name) ON CONFLICT (name) DO NOTHING;
        SELECT id INTO current_skill_id FROM skills WHERE name = s_name;
        INSERT INTO contractor_skills (contractor_id, skill_id) VALUES (contractor5_id, current_skill_id) ON CONFLICT DO NOTHING;
    END LOOP;

END $$;

-- Create spatial index on service_area for faster matching queries
-- Note: Index should be on contractor_details now, not profiles
CREATE INDEX IF NOT EXISTS idx_contractor_details_service_area_gist 
ON contractor_details USING GIST (service_area);

-- Add comment
COMMENT ON FUNCTION create_circle_polygon IS 'Creates a circular polygon for contractor service areas. Used for geospatial matching.';
