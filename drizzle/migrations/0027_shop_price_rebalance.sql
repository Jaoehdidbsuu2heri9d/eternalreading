-- Rebalance all active shop cosmetics upward without changing any wallet or purchase history.
-- Idempotent migration: executes once through Drizzle's migration journal.
UPDATE public.cosmetics
SET coin_price = GREATEST(200, CEIL((COALESCE(coin_price, 100) * 2)::numeric / 50) * 50)
WHERE active = true AND in_shop = true AND coin_price IS NOT NULL;
