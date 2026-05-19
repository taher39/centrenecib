
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, public.permission_scope, public.permission_action) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_authenticated_staff(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_client_code() FROM PUBLIC;
