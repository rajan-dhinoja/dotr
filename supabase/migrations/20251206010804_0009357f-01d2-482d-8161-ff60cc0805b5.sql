-- Add the existing user as admin (only if that user exists in auth.users; skipped on fresh projects)
INSERT INTO public.user_roles (user_id, role)
SELECT '37f411c8-219d-4e8b-aea9-549aa0d6bcf6', 'admin'::app_role
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = '37f411c8-219d-4e8b-aea9-549aa0d6bcf6')
ON CONFLICT (user_id, role) DO NOTHING;