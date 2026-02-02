-- Drop the existing public SELECT policy on profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create new policy: only the profile owner or admin can view full profile (including registration_ip)
CREATE POLICY "Users can view own profile or admin can view all" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id OR public.is_admin());

-- Drop the SECURITY DEFINER view and recreate as SECURITY INVOKER
DROP VIEW IF EXISTS public.public_profiles;

-- Recreate public_profiles view as SECURITY INVOKER (safe view without sensitive fields)
CREATE VIEW public.public_profiles 
WITH (security_invoker = true)
AS SELECT 
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