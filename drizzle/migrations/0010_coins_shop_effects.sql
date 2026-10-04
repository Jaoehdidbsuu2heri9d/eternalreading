ALTER TABLE public.cosmetics
  ADD COLUMN IF NOT EXISTS in_shop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock integer,
  ADD COLUMN IF NOT EXISTS sold integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS effect jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS media_path text,
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image';
ALTER TABLE public.cosmetics ADD CONSTRAINT cosmetics_media_type_chk CHECK (media_type IN ('image','video'));
ALTER TABLE public.cosmetics ADD CONSTRAINT cosmetics_stock_chk CHECK (stock IS NULL OR stock >= 0);
ALTER TABLE public.cosmetics ADD CONSTRAINT cosmetics_price_chk CHECK (coin_price IS NULL OR coin_price >= 0);

CREATE TABLE public.coin_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  earned integer NOT NULL DEFAULT 0,
  spent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coin_wallets TO authenticated;
GRANT ALL ON public.coin_wallets TO service_role;
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallet or staff" ON public.coin_wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount <> 0),
  balance_after integer NOT NULL,
  source text NOT NULL CHECK (source IN ('subscription','purchase','admin','refund','event')),
  reason text,
  cosmetic_id uuid REFERENCES public.cosmetics(id) ON DELETE SET NULL,
  actor_id uuid,
  ref text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coin_tx_user_idx ON public.coin_transactions(user_id, created_at DESC);
CREATE INDEX coin_tx_cosmetic_idx ON public.coin_transactions(cosmetic_id) WHERE cosmetic_id IS NOT NULL;
GRANT SELECT ON public.coin_transactions TO authenticated;
GRANT ALL ON public.coin_transactions TO service_role;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx or staff" ON public.coin_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.coins_apply(p_user uuid, p_amount integer, p_source text, p_reason text, p_ref text, p_cosmetic uuid, p_actor uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nb integer;
BEGIN
  IF p_amount = 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF p_ref IS NOT NULL AND EXISTS (SELECT 1 FROM public.coin_transactions WHERE ref = p_ref) THEN RETURN NULL; END IF;
  INSERT INTO public.coin_wallets(user_id) VALUES (p_user) ON CONFLICT DO NOTHING;
  SELECT balance + p_amount INTO nb FROM public.coin_wallets WHERE user_id = p_user FOR UPDATE;
  IF nb < 0 THEN RAISE EXCEPTION 'insufficient coins'; END IF;
  UPDATE public.coin_wallets SET balance = nb,
    earned = earned + GREATEST(p_amount,0), spent = spent + GREATEST(-p_amount,0), updated_at = now()
    WHERE user_id = p_user;
  INSERT INTO public.coin_transactions(user_id, amount, balance_after, source, reason, cosmetic_id, actor_id, ref)
    VALUES (p_user, p_amount, nb, p_source, left(p_reason,200), p_cosmetic, p_actor, p_ref);
  RETURN nb;
END $$;
REVOKE ALL ON FUNCTION public.coins_apply(uuid,integer,text,text,text,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coins_apply(uuid,integer,text,text,text,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_adjust_coins(p_user uuid, p_amount integer, p_reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nb integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_amount = 0 OR abs(p_amount) > 1000000 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF coalesce(length(trim(p_reason)),0) < 3 THEN RAISE EXCEPTION 'reason required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user) THEN RAISE EXCEPTION 'user not found'; END IF;
  nb := public.coins_apply(p_user, p_amount, 'admin', trim(p_reason), NULL, NULL, auth.uid());
  PERFORM public.write_admin_log(CASE WHEN p_amount > 0 THEN 'coins_added' ELSE 'coins_removed' END, p_user,
    jsonb_build_object('amount', abs(p_amount), 'reason', trim(p_reason), 'balance', nb));
  RETURN nb;
END $$;
REVOKE ALL ON FUNCTION public.admin_adjust_coins(uuid,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_coins(uuid,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.buy_cosmetic(p_cosmetic uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.cosmetics; pr public.profiles; nb integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO c FROM public.cosmetics WHERE id = p_cosmetic FOR UPDATE;
  IF NOT FOUND OR NOT c.active OR NOT c.in_shop OR c.coin_price IS NULL THEN RAISE EXCEPTION 'not for sale'; END IF;
  IF (c.starts_at IS NOT NULL AND now() < c.starts_at) OR (c.ends_at IS NOT NULL AND now() > c.ends_at) THEN RAISE EXCEPTION 'unavailable'; END IF;
  IF c.stock IS NOT NULL AND c.stock <= 0 THEN RAISE EXCEPTION 'sold out'; END IF;
  SELECT * INTO pr FROM public.profiles WHERE id = auth.uid();
  IF array_position(ARRAY['free','eternal','eternal_sunshine'], pr.plan::text) < array_position(ARRAY['free','eternal','eternal_sunshine'], c.required_plan::text)
    THEN RAISE EXCEPTION 'plan required'; END IF;
  IF pr.level < c.required_level THEN RAISE EXCEPTION 'level required'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_cosmetics WHERE user_id = auth.uid() AND cosmetic_id = c.id) THEN RAISE EXCEPTION 'already owned'; END IF;
  IF c.coin_price > 0 THEN
    nb := public.coins_apply(auth.uid(), -c.coin_price, 'purchase', c.name, NULL, c.id, auth.uid());
  ELSE
    SELECT balance INTO nb FROM public.coin_wallets WHERE user_id = auth.uid();
  END IF;
  INSERT INTO public.user_cosmetics(user_id, cosmetic_id, equipped, source) VALUES (auth.uid(), c.id, false, 'shop');
  UPDATE public.cosmetics SET sold = sold + 1, stock = CASE WHEN stock IS NULL THEN NULL ELSE stock - 1 END WHERE id = c.id;
  RETURN coalesce(nb,0);
END $$;
REVOKE ALL ON FUNCTION public.buy_cosmetic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_cosmetic(uuid) TO authenticated;

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
    IF (c.starts_at IS NOT NULL AND now() < c.starts_at) OR (c.ends_at IS NOT NULL AND now() > c.ends_at) THEN RAISE EXCEPTION 'unavailable'; END IF;
  END IF;
  IF pr.level < c.required_level
     OR array_position(ARRAY['free','eternal','eternal_sunshine'], pr.plan::text) < array_position(ARRAY['free','eternal','eternal_sunshine'], c.required_plan::text)
  THEN RAISE EXCEPTION 'locked'; END IF;
  UPDATE public.user_cosmetics uc SET equipped = false FROM public.cosmetics k
    WHERE uc.cosmetic_id = k.id AND uc.user_id = auth.uid() AND k.kind = c.kind;
  INSERT INTO public.user_cosmetics(user_id, cosmetic_id, equipped) VALUES (auth.uid(), c.id, true)
    ON CONFLICT (user_id, cosmetic_id) DO UPDATE SET equipped = true;
END $function$;

CREATE OR REPLACE FUNCTION public.subscription_coin_reward()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE amt integer;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN RETURN NEW; END IF;
  amt := CASE NEW.plan WHEN 'eternal' THEN 500 WHEN 'eternal_sunshine' THEN 1000 ELSE 0 END;
  IF amt > 0 AND public.coins_apply(NEW.user_id, amt, 'subscription',
      'Bônus de assinatura ' || CASE NEW.plan WHEN 'eternal' THEN 'Eternal' ELSE 'Eternal Sunshine' END,
      'sub:' || NEW.id::text, NULL, NULL) IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body, link)
      VALUES (NEW.user_id, 'Você recebeu ' || amt || ' Eternal Coins', 'Bônus da sua assinatura. Use na Loja.', '/loja');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.subscription_coin_reward() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER subscriptions_coin_reward AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.subscription_coin_reward();

CREATE OR REPLACE FUNCTION public.admin_shop_stats()
RETURNS TABLE(cosmetic_id uuid, purchases bigint, coins bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT t.cosmetic_id, count(*)::bigint, sum(-t.amount)::bigint
    FROM public.coin_transactions t WHERE t.source = 'purchase' AND t.cosmetic_id IS NOT NULL GROUP BY t.cosmetic_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_shop_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_shop_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_gif_banner(p_path text, p_equipped boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE pl public.plan_tier;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT plan INTO pl FROM public.profiles WHERE id = auth.uid();
  IF pl IS NULL OR pl = 'free' THEN RAISE EXCEPTION 'plan required'; END IF;
  IF p_path IS NOT NULL AND (p_path NOT LIKE auth.uid()::text || '/%' OR lower(p_path) !~ '\.(gif|mp4|webm)$') THEN
    RAISE EXCEPTION 'invalid path';
  END IF;
  UPDATE public.profiles
    SET gif_banner_path = p_path, gif_banner_equipped = (p_path IS NOT NULL AND p_equipped)
    WHERE id = auth.uid();
END $function$;

DROP POLICY IF EXISTS "banners insert subscriber" ON storage.objects;
CREATE POLICY "banners insert subscriber" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'profile-banners' AND (storage.foldername(name))[1] = auth.uid()::text
  AND lower(storage.extension(name)) IN ('gif','mp4','webm')
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.plan <> 'free'));

CREATE POLICY "cosmetic media read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'cosmetic-media');
CREATE POLICY "cosmetic media admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'cosmetic-media' AND public.has_role(auth.uid(),'admin')
  AND lower(storage.extension(name)) IN ('png','jpg','jpeg','webp','gif','mp4','webm'));
CREATE POLICY "cosmetic media admin delete" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'cosmetic-media' AND public.has_role(auth.uid(),'admin'));

DO $$ DECLARE s record; BEGIN
  FOR s IN SELECT id, user_id, plan FROM public.subscriptions WHERE status = 'active' AND plan <> 'free' LOOP
    PERFORM public.coins_apply(s.user_id, CASE s.plan WHEN 'eternal' THEN 500 ELSE 1000 END, 'subscription',
      'Bônus de assinatura', 'sub:' || s.id::text, NULL, NULL);
  END LOOP;
END $$;