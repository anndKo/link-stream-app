-- Create a public-safe view that excludes sensitive columns
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  cover_url,
  bio,
  user_id_code,
  is_banned,
  created_at,
  updated_at
FROM public.profiles;

-- Grant select on the view to authenticated and anon users
GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- Create a function for admins to get full profile with IP
CREATE OR REPLACE FUNCTION public.get_full_profile(profile_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  cover_url text,
  bio text,
  user_id_code text,
  registration_ip text,
  is_banned boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.cover_url,
    p.bio,
    p.user_id_code,
    CASE WHEN public.is_admin() THEN p.registration_ip ELSE NULL END,
    p.is_banned,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.id = profile_id;
$$;