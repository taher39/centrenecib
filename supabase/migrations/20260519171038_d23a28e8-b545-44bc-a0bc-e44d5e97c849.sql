
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.generate_client_code() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, public.permission_scope, public.permission_action) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_authenticated_staff(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_client_code() FROM anon, authenticated;
