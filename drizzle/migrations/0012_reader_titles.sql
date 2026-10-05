
CREATE TABLE public.reader_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_min integer NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  rarity text NOT NULL CHECK (rarity IN ('comum','incomum','raro','epico','lendario','mitico')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reader_titles TO authenticated, anon;
GRANT ALL ON public.reader_titles TO service_role;
ALTER TABLE public.reader_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "titles_public_read" ON public.reader_titles FOR SELECT TO authenticated, anon USING (true);

CREATE TABLE public.xp_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  source text NOT NULL,
  reason text,
  actor_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX xp_history_user_idx ON public.xp_history (user_id, created_at DESC);
GRANT SELECT ON public.xp_history TO authenticated;
GRANT ALL ON public.xp_history TO service_role;
ALTER TABLE public.xp_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_history_own_read" ON public.xp_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.reader_title(p_level integer)
RETURNS public.reader_titles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT t.* FROM public.reader_titles t
   WHERE t.level_min <= GREATEST(1, p_level)
   ORDER BY t.level_min DESC LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.reader_title(integer) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.add_xp(p_amount integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_xp integer;
BEGIN
  IF auth.uid() IS NULL OR p_amount IS NULL OR p_amount <= 0 OR p_amount > 50 THEN RETURN; END IF;
  UPDATE public.profiles
     SET xp = xp + p_amount,
         level = GREATEST(1, floor(sqrt((xp + p_amount) / 100.0))::int + 1)
   WHERE id = auth.uid()
   RETURNING xp INTO v_xp;
  IF v_xp IS NOT NULL THEN
    INSERT INTO public.xp_history (user_id, amount, balance_after, source)
    VALUES (auth.uid(), p_amount, v_xp, 'activity');
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_grant_xp(p_user uuid, p_amount integer, p_reason text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_xp integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_amount IS NULL OR p_amount = 0 OR abs(p_amount) > 100000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  UPDATE public.profiles
     SET xp = GREATEST(0, xp + p_amount),
         level = GREATEST(1, floor(sqrt(GREATEST(0, xp + p_amount) / 100.0))::int + 1)
   WHERE id = p_user
   RETURNING xp INTO v_xp;
  IF v_xp IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;
  INSERT INTO public.xp_history (user_id, amount, balance_after, source, reason, actor_id)
  VALUES (p_user, p_amount, v_xp, 'admin', trim(p_reason), auth.uid());
  PERFORM public.write_admin_log('xp_grant', p_user,
    jsonb_build_object('amount', p_amount, 'reason', trim(p_reason), 'balance_after', v_xp));
  RETURN v_xp;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.admin_grant_xp(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_xp(uuid, integer, text) TO authenticated;
