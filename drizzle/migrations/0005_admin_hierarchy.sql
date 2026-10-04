CREATE TABLE public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  target_user_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_logs TO authenticated;
GRANT ALL ON public.admin_logs TO service_role;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_logs staff read" ON public.admin_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX admin_logs_created_idx ON public.admin_logs(created_at DESC);

-- Dono: sempre também admin. Backfill para a conta principal.
INSERT INTO public.user_roles(user_id, role)
  SELECT u.id, r.role FROM auth.users u
  CROSS JOIN (VALUES ('admin'::public.app_role), ('owner'::public.app_role)) r(role)
  WHERE lower(u.email) = 'joaomacal100@gmail.com'
  ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_owner_admin()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id AND lower(email) = 'joaomacal100@gmail.com') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin'), (NEW.id, 'owner') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.write_admin_log(p_action text, p_target uuid, p_details jsonb)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ INSERT INTO public.admin_logs(actor_id, target_user_id, action, details) VALUES (auth.uid(), p_target, p_action, COALESCE(p_details,'{}'::jsonb)); $$;
REVOKE EXECUTE ON FUNCTION public.write_admin_log(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- Lista de usuários (somente equipe)
CREATE OR REPLACE FUNCTION public.admin_list_users(p_search text DEFAULT NULL, p_plan public.plan_tier DEFAULT NULL)
 RETURNS TABLE(id uuid, username text, display_name text, email text, avatar_path text, avatar_url text,
               plan public.plan_tier, level int, xp int, is_admin boolean, is_owner boolean, admin_since timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.display_name, u.email::text, p.avatar_path, p.avatar_url, p.plan, p.level, p.xp,
    EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = p.id AND r.role = 'admin'),
    EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = p.id AND r.role = 'owner'),
    (SELECT r.created_at FROM user_roles r WHERE r.user_id = p.id AND r.role = 'admin')
  FROM profiles p JOIN auth.users u ON u.id = p.id
  WHERE (p_plan IS NULL OR p.plan = p_plan)
    AND (p_search IS NULL OR trim(p_search) = '' OR p.username ILIKE '%'||trim(p_search)||'%'
         OR p.display_name ILIKE '%'||trim(p_search)||'%' OR u.email ILIKE '%'||trim(p_search)||'%')
  ORDER BY p.created_at DESC LIMIT 100;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_plan(p_user uuid, p_plan public.plan_tier)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE old_plan public.plan_tier;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT plan INTO old_plan FROM profiles WHERE id = p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found'; END IF;
  UPDATE profiles SET plan = p_plan,
    gif_banner_equipped = CASE WHEN p_plan = 'free' THEN false ELSE gif_banner_equipped END
    WHERE id = p_user;
  PERFORM public.write_admin_log('plan_changed', p_user, jsonb_build_object('from', old_plan, 'to', p_plan));
END $$;

CREATE OR REPLACE FUNCTION public.owner_add_admin(p_user uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN RAISE EXCEPTION 'only owner'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user) THEN RAISE EXCEPTION 'user not found'; END IF;
  INSERT INTO user_roles(user_id, role) VALUES (p_user, 'admin') ON CONFLICT DO NOTHING;
  PERFORM public.write_admin_log('admin_added', p_user, '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.owner_remove_admin(p_user uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN RAISE EXCEPTION 'only owner'; END IF;
  IF public.has_role(p_user, 'owner') THEN RAISE EXCEPTION 'cannot remove owner'; END IF;
  DELETE FROM user_roles WHERE user_id = p_user AND role IN ('admin','moderator');
  PERFORM public.write_admin_log('admin_removed', p_user, '{}'::jsonb);
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users(text, public.plan_tier) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_plan(uuid, public.plan_tier) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owner_add_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owner_remove_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, public.plan_tier) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_plan(uuid, public.plan_tier) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_add_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_remove_admin(uuid) TO authenticated;

-- Registro automático: códigos e pedidos de parceria
CREATE OR REPLACE FUNCTION public.log_invite_code_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_admin_log('code_created', NULL, jsonb_build_object('code', NEW.code));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.write_admin_log('code_deleted', NULL, jsonb_build_object('code', OLD.code));
  ELSIF NEW.active IS DISTINCT FROM OLD.active THEN
    PERFORM public.write_admin_log(CASE WHEN NEW.active THEN 'code_activated' ELSE 'code_blocked' END, NULL, jsonb_build_object('code', NEW.code));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER invite_codes_log AFTER INSERT OR UPDATE OR DELETE ON public.invite_codes
  FOR EACH ROW EXECUTE FUNCTION public.log_invite_code_change();

CREATE OR REPLACE FUNCTION public.log_scan_request_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') THEN
    PERFORM public.write_admin_log('request_' || NEW.status, NEW.user_id, jsonb_build_object('scan', NEW.scan_name));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER scan_requests_log AFTER UPDATE ON public.scan_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_scan_request_change();