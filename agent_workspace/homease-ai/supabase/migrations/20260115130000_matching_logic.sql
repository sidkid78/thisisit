-- RPC function to find matching contractors
CREATE OR REPLACE FUNCTION find_matching_contractors(
  project_location GEOMETRY,
  required_skills TEXT[],
  limit_count INT
)
RETURNS TABLE (id UUID, company_name TEXT, is_caps_certified BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cd.profile_id as id,
    cd.company_name,
    cd.is_caps_certified
  FROM
    contractor_details AS cd
  -- Join to check skills if any required
  LEFT JOIN (
    SELECT cs.contractor_id, array_agg(s.name) as skill_names
    FROM contractor_skills cs
    JOIN skills s ON cs.skill_id = s.id
    GROUP BY cs.contractor_id
  ) AS skilled_contractors ON cd.profile_id = skilled_contractors.contractor_id
  WHERE
    -- Core Geospatial Query: Check if the project point is within the contractor's service area polygon
    (cd.service_area IS NULL OR ST_Contains(cd.service_area, project_location))
    AND cd.verification_status = 'approved'
    -- Ensure contractor has all required skills (if any)
    AND (
        array_length(required_skills, 1) IS NULL 
        OR (skilled_contractors.skill_names @> required_skills)
    )
  ORDER BY
    cd.is_caps_certified DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger for lead matching
CREATE OR REPLACE FUNCTION trigger_contractor_matching()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if the status is newly set to 'lead_submitted'
  IF NEW.status = 'lead_submitted' AND (OLD.status IS NULL OR OLD.status != 'lead_submitted') THEN
    -- In a real Supabase environment, we would use net.http_post
    -- For now, we assume the Edge Function is triggered via other means or this is a placeholder
    -- PERFORM net.http_post(
    --   url := 'https://' || current_setting('request.headers')::json->>'host' || '/functions/v1/match-contractors',
    --   headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    --   body := row_to_json(NEW)::jsonb
    -- );
    NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_project_submit_lead
AFTER UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION trigger_contractor_matching();
