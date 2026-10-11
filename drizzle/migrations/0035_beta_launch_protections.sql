-- Beta launch: keep historical sandbox subscription records separate from live Asaas
-- and expire test entitlements before production billing is enabled.
DO $$
DECLARE affected record;
BEGIN
  FOR affected IN SELECT DISTINCT user_id FROM public.subscriptions WHERE provider = 'asaas'
  LOOP
    UPDATE public.subscriptions
    SET provider = 'asaas_sandbox',
        status = 'expired',
        current_period_end = now(),
        ends_at = LEAST(COALESCE(ends_at, now()), now()),
        canceled_at = COALESCE(canceled_at, now()),
        cancel_at_period_end = true
    WHERE user_id = affected.user_id AND provider = 'asaas';

    PERFORM public.sync_profile_plan(affected.user_id);
  END LOOP;
END $$;

-- Move historical subscription payments away from the live provider namespace.
UPDATE public.payments SET provider = 'asaas_sandbox' WHERE provider = 'asaas';
-- Migrate sandbox customer references without violating the (user_id, provider) primary key.
INSERT INTO public.billing_customers (user_id, provider, external_customer_id, created_at)
SELECT user_id, 'asaas_sandbox', external_customer_id, created_at
FROM public.billing_customers WHERE provider = 'asaas'
ON CONFLICT (user_id, provider) DO NOTHING;
DELETE FROM public.billing_customers WHERE provider = 'asaas';

-- Preserve idempotency for previously recorded sandbox subscription webhooks.
UPDATE public.payment_events e
SET provider = 'asaas_sandbox'
WHERE e.provider = 'asaas'
  AND (
    e.payload #>> '{payment,subscription}' IN (
      SELECT external_id FROM public.subscriptions WHERE provider = 'asaas_sandbox' AND external_id IS NOT NULL
    )
    OR e.payload #>> '{subscription,id}' IN (
      SELECT external_id FROM public.subscriptions WHERE provider = 'asaas_sandbox' AND external_id IS NOT NULL
    )
  );

-- Permanent profile badge granted only by a successful production subscription payment
-- received before the official launch cutoff (midnight in Brazil, UTC-03).
INSERT INTO public.cosmetics (
  slug, name, description, kind, rarity, preview, animation, required_level,
  required_plan, active, coin_price, availability, sort, in_shop, sold, effect,
  frame_category, featured, released_at, after_event, exclusive_tag, keep_after_plan
)
VALUES (
  'eternal-beta-tester',
  'Testador Beta',
  'Distintivo permanente para membros que apoiaram a Eternal com uma assinatura paga confirmada durante a beta, antes do lançamento oficial em 27/11/2026.',
  'badge',
  'legendary',
  '🧪 TESTADOR BETA',
  'glow',
  1,
  'free',
  true,
  NULL,
  'exclusive',
  900,
  false,
  0,
  '{"style":"beta","intensity":1.2,"speed":0.8}'::jsonb,
  NULL,
  true,
  now(),
  'keep',
  'event',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  kind = EXCLUDED.kind,
  rarity = EXCLUDED.rarity,
  preview = EXCLUDED.preview,
  animation = EXCLUDED.animation,
  required_plan = 'free',
  active = true,
  coin_price = NULL,
  availability = 'exclusive',
  in_shop = false,
  effect = EXCLUDED.effect,
  after_event = 'keep',
  exclusive_tag = 'event',
  keep_after_plan = true;

REVOKE INSERT, UPDATE, DELETE ON public.cosmetics FROM anon;
