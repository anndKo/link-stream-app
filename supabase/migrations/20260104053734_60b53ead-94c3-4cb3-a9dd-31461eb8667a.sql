-- Drop and recreate the public_profiles view as a security definer view
-- This allows anyone to see public profile information without exposing sensitive data

DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles 
WITH (security_invoker = false)
AS
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
FROM profiles;

-- Grant SELECT to everyone
GRANT SELECT ON public.public_profiles TO anon, authenticated;