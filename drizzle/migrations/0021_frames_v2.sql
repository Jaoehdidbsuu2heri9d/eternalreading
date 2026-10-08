CREATE TABLE public.frame_categories (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  name text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.frame_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.frame_categories TO authenticated;
GRANT ALL ON public.frame_categories TO service_role;
ALTER TABLE public.frame_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "frame_categories read" ON public.frame_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "frame_categories admin insert" ON public.frame_categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "frame_categories admin update" ON public.frame_categories FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "frame_categories admin delete" ON public.frame_categories FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

INSERT INTO public.frame_categories(slug,name,sort) VALUES
 ('classica','Clássica',1),('neon','Neon',2),('elemental','Elemental',3),('fantasia','Fantasia',4),('dark','Dark',5),
 ('cute','Cute',6),('anime','Anime',7),('premium','Premium',8),('eventos','Eventos',9),('conquistas','Conquistas',10),('especial','Especial',11)
ON CONFLICT DO NOTHING;

ALTER TABLE public.cosmetics
  ADD COLUMN frame_category text REFERENCES public.frame_categories(slug) ON UPDATE CASCADE ON DELETE SET NULL,
  ADD COLUMN required_achievement_id uuid REFERENCES public.achievements(id) ON DELETE SET NULL,
  ADD COLUMN featured boolean NOT NULL DEFAULT false,
  ADD COLUMN released_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN after_event text NOT NULL DEFAULT 'unavailable' CHECK (after_event IN ('keep','unavailable','rare','archive')),
  ADD COLUMN exclusive_tag text CHECK (exclusive_tag IN ('eternal','sunshine','event','achievement','founder')),
  ADD COLUMN keep_after_plan boolean NOT NULL DEFAULT false;

-- Molduras existentes entram como Clássica (sem perder dados).
UPDATE public.cosmetics SET released_at = created_at;
UPDATE public.cosmetics SET frame_category = 'classica' WHERE kind = 'frame' AND frame_category IS NULL;

CREATE TABLE public.cosmetic_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cosmetic_id uuid NOT NULL REFERENCES public.cosmetics(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('purchase','equip','unequip')),
  price integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cosmetic_events_user_idx ON public.cosmetic_events(user_id, created_at DESC);
GRANT SELECT ON public.cosmetic_events TO authenticated;
GRANT ALL ON public.cosmetic_events TO service_role;
ALTER TABLE public.cosmetic_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cosmetic_events own or admin" ON public.cosmetic_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.cosmetic_available(c public.cosmetics) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (c.starts_at IS NULL OR now() >= c.starts_at)
     AND (c.ends_at IS NULL OR now() <= c.ends_at OR c.after_event IN ('keep','rare'));
$$;

CREATE OR REPLACE FUNCTION public.buy_cosmetic(p_cosmetic uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE c public.cosmetics; pr public.profiles; nb integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO c FROM public.cosmetics WHERE id = p_cosmetic FOR UPDATE;
  IF NOT FOUND OR NOT c.active OR NOT c.in_shop OR c.coin_price IS NULL OR c.coin_price < 0 THEN RAISE EXCEPTION 'not for sale'; END IF;
  IF NOT public.cosmetic_available(c) THEN RAISE EXCEPTION 'unavailable'; END IF;
  IF c.stock IS NOT NULL AND c.stock <= 0 THEN RAISE EXCEPTION 'sold out'; END IF;
  SELECT * INTO pr FROM public.profiles WHERE id = auth.uid();
  IF array_position(ARRAY['free','eternal','eternal_sunshine'], pr.plan::text) < array_position(ARRAY['free','eternal','eternal_sunshine'], c.required_plan::text)
    THEN RAISE EXCEPTION 'plan required'; END IF;
  IF pr.level < c.required_level THEN RAISE EXCEPTION 'level required'; END IF;
  IF c.required_achievement_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = auth.uid() AND achievement_id = c.required_achievement_id)
    THEN RAISE EXCEPTION 'achievement required'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_cosmetics WHERE user_id = auth.uid() AND cosmetic_id = c.id) THEN RAISE EXCEPTION 'already owned'; END IF;
  IF c.coin_price > 0 THEN
    nb := public.coins_apply(auth.uid(), -c.coin_price, 'purchase', c.name, NULL, c.id, auth.uid());
  ELSE
    SELECT balance INTO nb FROM public.coin_wallets WHERE user_id = auth.uid();
  END IF;
  INSERT INTO public.user_cosmetics(user_id, cosmetic_id, equipped, source) VALUES (auth.uid(), c.id, false, 'shop');
  UPDATE public.cosmetics SET sold = sold + 1, stock = CASE WHEN stock IS NULL THEN NULL ELSE stock - 1 END WHERE id = c.id;
  INSERT INTO public.cosmetic_events(user_id, cosmetic_id, action, price) VALUES (auth.uid(), c.id, 'purchase', c.coin_price);
  RETURN coalesce(nb,0);
END $function$;

CREATE OR REPLACE FUNCTION public.equip_cosmetic(p_cosmetic uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE c public.cosmetics; pr public.profiles; owned boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO c FROM public.cosmetics WHERE id = p_cosmetic AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found'; END IF;
  SELECT * INTO pr FROM public.profiles WHERE id = auth.uid();
  SELECT EXISTS (SELECT 1 FROM public.user_cosmetics WHERE user_id = auth.uid() AND cosmetic_id = c.id) INTO owned;
  IF NOT owned THEN
    IF c.in_shop OR c.availability NOT IN ('unlockable','subscription') THEN RAISE EXCEPTION 'not owned'; END IF;
    IF NOT public.cosmetic_available(c) THEN RAISE EXCEPTION 'unavailable'; END IF;
    IF c.required_achievement_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = auth.uid() AND achievement_id = c.required_achievement_id)
      THEN RAISE EXCEPTION 'locked'; END IF;
  END IF;
  IF pr.level < c.required_level THEN RAISE EXCEPTION 'locked'; END IF;
  -- Plano: item comprado e marcado como permanente continua equipável após a assinatura expirar.
  IF array_position(ARRAY['free','eternal','eternal_sunshine'], pr.plan::text) < array_position(ARRAY['free','eternal','eternal_sunshine'], c.required_plan::text)
     AND NOT (owned AND c.keep_after_plan)
  THEN RAISE EXCEPTION 'locked'; END IF;
  UPDATE public.user_cosmetics uc SET equipped = false FROM public.cosmetics k
    WHERE uc.cosmetic_id = k.id AND uc.user_id = auth.uid() AND k.kind = c.kind;
  INSERT INTO public.user_cosmetics(user_id, cosmetic_id, equipped) VALUES (auth.uid(), c.id, true)
    ON CONFLICT (user_id, cosmetic_id) DO UPDATE SET equipped = true;
  INSERT INTO public.cosmetic_events(user_id, cosmetic_id, action) VALUES (auth.uid(), c.id, 'equip');
END $function$;

CREATE OR REPLACE FUNCTION public.frame_popularity()
RETURNS TABLE(cosmetic_id uuid, owners bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT uc.cosmetic_id, count(*)::bigint FROM public.user_cosmetics uc
  JOIN public.cosmetics k ON k.id = uc.cosmetic_id AND k.kind = 'frame' GROUP BY uc.cosmetic_id;
$$;
REVOKE ALL ON FUNCTION public.frame_popularity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.frame_popularity() TO authenticated;