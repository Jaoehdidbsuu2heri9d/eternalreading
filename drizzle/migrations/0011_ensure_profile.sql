CREATE OR REPLACE FUNCTION public.ensure_profile(p_username text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_base text; v_name text; v_i int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_uid) THEN RETURN; END IF;
  v_base := lower(regexp_replace(coalesce(nullif(p_username,''), (SELECT split_part(email,'@',1) FROM auth.users WHERE id = v_uid), 'membro'), '[^a-zA-Z0-9_]', '', 'g'));
  IF length(v_base) < 3 THEN v_base := v_base || 'membro'; END IF;
  v_base := left(v_base, 16);
  v_name := v_base;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE lower(username) = lower(v_name)) LOOP
    v_i := v_i + 1; v_name := v_base || v_i::text;
  END LOOP;
  INSERT INTO profiles (id, username, display_name) VALUES (v_uid, v_name, coalesce(nullif(p_username,''), v_name));
END $$;
REVOKE EXECUTE ON FUNCTION public.ensure_profile(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_profile(text) TO authenticated;

-- Backfill contas sem perfil
DO $$ DECLARE r record; v_base text; v_name text; v_i int; BEGIN
  FOR r IN SELECT u.id, u.email FROM auth.users u LEFT JOIN profiles p ON p.id=u.id WHERE p.id IS NULL LOOP
    v_base := left(lower(regexp_replace(split_part(r.email,'@',1), '[^a-zA-Z0-9_]', '', 'g')),16);
    IF length(v_base) < 3 THEN v_base := v_base || 'membro'; END IF;
    v_name := v_base; v_i := 0;
    WHILE EXISTS (SELECT 1 FROM profiles WHERE lower(username)=lower(v_name)) LOOP v_i := v_i+1; v_name := v_base||v_i::text; END LOOP;
    INSERT INTO profiles (id, username, display_name) VALUES (r.id, v_name, v_name);
  END LOOP;
END $$;