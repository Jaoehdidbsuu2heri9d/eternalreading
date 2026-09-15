
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_invite_code(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_invite_code(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_xp(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_invite_code(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_xp(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
