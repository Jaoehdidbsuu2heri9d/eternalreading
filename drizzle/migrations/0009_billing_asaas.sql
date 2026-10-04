-- Planos: preço e benefícios configuráveis
ALTER TABLE public.subscription_plans
  ADD COLUMN price_cents integer,
  ADD COLUMN billing_interval text NOT NULL DEFAULT 'monthly',
  ADD COLUMN features jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Assinaturas: campos do provedor
ALTER TABLE public.subscriptions
  ADD COLUMN provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN external_customer_id text,
  ADD COLUMN billing_type text,
  ADD COLUMN current_period_end timestamptz,
  ADD COLUMN next_due_date date,
  ADD COLUMN canceled_at timestamptz,
  ADD COLUMN cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active','trialing','pending','past_due','canceled','expired','paused')) NOT VALID;
CREATE UNIQUE INDEX subscriptions_external_id_key ON public.subscriptions(provider, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX subscriptions_user_idx ON public.subscriptions(user_id, status);
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "subscriptions admin read" ON public.subscriptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

-- Cliente no provedor (não guarda CPF)
CREATE TABLE public.billing_customers (
  user_id uuid NOT NULL,
  provider text NOT NULL,
  external_customer_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);
GRANT ALL ON public.billing_customers TO service_role;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

-- Histórico de pagamentos (nenhum dado de cartão)
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  provider text NOT NULL,
  external_id text NOT NULL,
  amount_cents integer NOT NULL,
  status text NOT NULL,
  billing_type text,
  due_date date,
  paid_at timestamptz,
  invoice_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);
CREATE INDEX payments_user_idx ON public.payments(user_id, created_at DESC);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments own" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Eventos de webhook (idempotência por event_id)
CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_events admin" ON public.payment_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Verificação central: o usuário tem plano >= p_plan ativo?
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user uuid, p_plan plan_tier)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.user_id = p_user
      AND array_position(ARRAY['free','eternal','eternal_sunshine'], s.plan::text) >= array_position(ARRAY['free','eternal','eternal_sunshine'], p_plan::text)
      AND (
        (s.status IN ('active','trialing') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status IN ('canceled','past_due') AND s.current_period_end > now())
      )
  );
$$;

-- Recalcula o plano exibido no perfil a partir das assinaturas
CREATE OR REPLACE FUNCTION public.sync_profile_plan(p_user uuid)
RETURNS plan_tier LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl plan_tier := 'free';
BEGIN
  IF public.has_active_subscription(p_user, 'eternal_sunshine') THEN pl := 'eternal_sunshine';
  ELSIF public.has_active_subscription(p_user, 'eternal') THEN pl := 'eternal';
  END IF;
  UPDATE profiles SET plan = pl,
    gif_banner_equipped = CASE WHEN pl = 'free' THEN false ELSE gif_banner_equipped END
  WHERE id = p_user AND plan IS DISTINCT FROM pl;
  -- tira itens exclusivos de plano que não vale mais
  UPDATE user_cosmetics uc SET equipped = false FROM cosmetics c
   WHERE uc.cosmetic_id = c.id AND uc.user_id = p_user AND uc.equipped
     AND array_position(ARRAY['free','eternal','eternal_sunshine'], c.required_plan::text) > array_position(ARRAY['free','eternal','eternal_sunshine'], pl::text);
  RETURN pl;
END $$;

-- Expira assinaturas vencidas e ressincroniza (chamado periodicamente)
CREATE OR REPLACE FUNCTION public.expire_subscriptions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN UPDATE subscriptions SET status = 'expired'
    WHERE status IN ('canceled','past_due','active') AND provider <> 'manual'
      AND current_period_end IS NOT NULL AND current_period_end < now() - interval '3 days'
    RETURNING user_id
  LOOP n := n + 1; END LOOP;
  FOR r IN SELECT id FROM profiles WHERE plan <> 'free' LOOP PERFORM public.sync_profile_plan(r.id); END LOOP;
  RETURN n;
END $$;

-- Planos concedidos pela equipe viram assinaturas "manual" (registradas)
CREATE OR REPLACE FUNCTION public.admin_set_plan(p_user uuid, p_plan plan_tier)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_plan plan_tier;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT plan INTO old_plan FROM profiles WHERE id = p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found'; END IF;
  UPDATE subscriptions SET status = 'canceled', canceled_at = now(), current_period_end = now()
    WHERE user_id = p_user AND provider = 'manual' AND status = 'active';
  IF p_plan <> 'free' THEN
    INSERT INTO subscriptions(user_id, plan, status, provider, started_at) VALUES (p_user, p_plan, 'active', 'manual', now());
  END IF;
  PERFORM public.sync_profile_plan(p_user);
  PERFORM public.write_admin_log('plan_changed', p_user, jsonb_build_object('from', old_plan, 'to', p_plan, 'source', 'manual'));
END $$;

-- Backfill: planos já concedidos manualmente
INSERT INTO public.subscriptions(user_id, plan, status, provider, started_at)
  SELECT id, plan, 'active', 'manual', now() FROM public.profiles WHERE plan <> 'free';

REVOKE EXECUTE ON FUNCTION public.sync_profile_plan(uuid), public.expire_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_plan(uuid), public.expire_subscriptions() TO service_role;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, plan_tier) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, plan_tier) TO authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('eternal-expire-subscriptions', '0 * * * *', $$SELECT public.expire_subscriptions()$$);