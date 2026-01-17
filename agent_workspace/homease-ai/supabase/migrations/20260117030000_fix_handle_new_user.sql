-- Fix handle_new_user trigger to handle role metadata properly
-- The issue is that the role casting might fail if the value is unexpected

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role_value user_role;
BEGIN
  -- Safely determine the role with explicit validation
  IF new.raw_user_meta_data->>'role' = 'contractor' THEN
    user_role_value := 'contractor'::user_role;
  ELSIF new.raw_user_meta_data->>'role' = 'admin' THEN
    user_role_value := 'admin'::user_role;
  ELSE
    user_role_value := 'homeowner'::user_role;
  END IF;

  -- Insert into profiles
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url',
    user_role_value
  );
  
  -- If contractor, also create contractor_details entry
  IF user_role_value = 'contractor'::user_role THEN
    INSERT INTO public.contractor_details (profile_id) VALUES (new.id);
  END IF;
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the user creation
  RAISE LOG 'handle_new_user failed for user %: %', new.id, SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The trigger already exists, so this just updates the function
