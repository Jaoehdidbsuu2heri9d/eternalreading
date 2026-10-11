-- Recompensas de temporada para as quatro facções.
-- Cosméticos utilizam o inventário existente; o histórico de premiações é permanente.
CREATE TABLE IF NOT EXISTS public.faction_season_rewards (
  season_id uuid NOT NULL REFERENCES public.faction_seasons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  faction_slug text NOT NULL REFERENCES public.factions(slug) ON DELETE RESTRICT,
  reward_key text NOT NULL CHECK (reward_key IN ('participant_sigil','champion_title','champion_frame','champion_dragon')),
  cosmetic_id uuid REFERENCES public.cosmetics(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, user_id, reward_key),
  CHECK (
    (reward_key = 'champion_dragon' AND cosmetic_id IS NULL)
    OR (reward_key <> 'champion_dragon' AND cosmetic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS faction_season_rewards_user_idx
  ON public.faction_season_rewards (user_id, granted_at DESC);
CREATE INDEX IF NOT EXISTS faction_season_rewards_season_idx
  ON public.faction_season_rewards (season_id, faction_slug, reward_key);

ALTER TABLE public.faction_season_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS faction_season_rewards_read_authenticated ON public.faction_season_rewards;
CREATE POLICY faction_season_rewards_read_authenticated
  ON public.faction_season_rewards FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.faction_season_rewards FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.faction_season_rewards TO authenticated;
GRANT ALL ON public.faction_season_rewards TO service_role;

-- Cosméticos exclusivos, sem preço e fora da loja. A vitória os libera na coleção
-- existente, preservando os demais itens e o cosmético atualmente equipado.
INSERT INTO public.cosmetics (
  slug, name, description, kind, rarity, preview, animation, required_level,
  required_plan, active, coin_price, availability, sort, in_shop, sold, effect,
  frame_category, featured, released_at, after_event, exclusive_tag, keep_after_plan
)
VALUES
  ('faction-ordem-da-chama-sigil', 'Estandarte da Chama', 'Brasão de participação da Ordem da Chama, conquistado ao contribuir em uma temporada oficial.', 'badge', 'epic', '🔥 Chama · Guerra', 'glow', 1, 'free', true, NULL, 'exclusive', 301, false, 0, '{}'::jsonb, NULL, true, now(), 'keep', 'achievement', true),
  ('faction-ordem-lunar-sigil', 'Estandarte Lunar', 'Brasão de participação da Ordem Lunar, conquistado ao contribuir em uma temporada oficial.', 'badge', 'epic', '🌙 Lunar · Guerra', 'glow', 1, 'free', true, NULL, 'exclusive', 302, false, 0, '{}'::jsonb, NULL, true, now(), 'keep', 'achievement', true),
  ('faction-guardioes-do-portal-sigil', 'Estandarte do Portal', 'Brasão de participação dos Guardiões do Portal, conquistado ao contribuir em uma temporada oficial.', 'badge', 'epic', '✦ Portal · Guerra', 'glow', 1, 'free', true, NULL, 'exclusive', 303, false, 0, '{}'::jsonb, NULL, true, now(), 'keep', 'achievement', true),
  ('faction-corvos-eternos-sigil', 'Estandarte dos Corvos', 'Brasão de participação dos Corvos Eternos, conquistado ao contribuir em uma temporada oficial.', 'badge', 'epic', '🪶 Corvos · Guerra', 'glow', 1, 'free', true, NULL, 'exclusive', 304, false, 0, '{}'::jsonb, NULL, true, now(), 'keep', 'achievement', true),

  ('faction-ordem-da-chama-champion-title', 'Campeão da Chama', 'Título permanente concedido a quem contribuiu para uma temporada vencida pela Ordem da Chama.', 'title', 'legendary', 'Campeão da Chama', 'glow', 1, 'free', true, NULL, 'exclusive', 311, false, 0, '{}'::jsonb, NULL, true, now(), 'keep', 'achievement', true),
  ('faction-ordem-lunar-champion-title', 'Campeão Lunar', 'Título permanente concedido a quem contribuiu para uma temporada vencida pela Ordem Lunar.', 'title', 'legendary', 'Campeão Lunar', 'glow', 1, 'free', true, NULL, 'exclusive', 312, false, 0, '{}'::jsonb, NULL, true, now(), 'keep', 'achievement', true),
  ('faction-guardioes-do-portal-champion-title', 'Campeão do Portal', 'Título permanente concedido a quem contribuiu para uma temporada vencida pelos Guardiões do Portal.', 'title', 'legendary', 'Campeão do Portal', 'glow', 1, 'free', true, NULL, 'exclusive', 313, false, 0, '{}'::jsonb, NULL, true, now(), 'keep', 'achievement', true),
  ('faction-corvos-eternos-champion-title', 'Campeão dos Corvos', 'Título permanente concedido a quem contribuiu para uma temporada vencida pelos Corvos Eternos.', 'title', 'legendary', 'Campeão dos Corvos', 'glow', 1, 'free', true, NULL, 'exclusive', 314, false, 0, '{}'::jsonb, NULL, true, now(), 'keep', 'achievement', true),

  ('faction-ordem-da-chama-champion-frame', 'Moldura Campeã da Chama', 'Moldura animada rubra com energia de fogo. Recompensa exclusiva da Ordem da Chama.', 'frame', 'mythic', '#F87171', 'pulse', 1, 'free', true, NULL, 'exclusive', 321, false, 0, '{"style":"fire","intensity":1.3,"speed":1.1,"size":1.15}'::jsonb, 'conquistas', true, now(), 'keep', 'achievement', true),
  ('faction-ordem-lunar-champion-frame', 'Moldura Campeã Lunar', 'Moldura violeta prateada com aura lunar. Recompensa exclusiva da Ordem Lunar.', 'frame', 'mythic', '#C4B5FD', 'drift', 1, 'free', true, NULL, 'exclusive', 322, false, 0, '{"style":"galaxy","intensity":1.25,"speed":0.9,"size":1.15}'::jsonb, 'conquistas', true, now(), 'keep', 'achievement', true),
  ('faction-guardioes-do-portal-champion-frame', 'Moldura Campeã do Portal', 'Moldura verde esmeralda com runas de portal. Recompensa exclusiva dos Guardiões.', 'frame', 'mythic', '#6EE7B7', 'spin', 1, 'free', true, NULL, 'exclusive', 323, false, 0, '{"style":"magic","intensity":1.2,"speed":1.0,"size":1.1}'::jsonb, 'conquistas', true, now(), 'keep', 'achievement', true),
  ('faction-corvos-eternos-champion-frame', 'Moldura Campeã dos Corvos', 'Moldura azul-prateada com uma aura noturna. Recompensa exclusiva dos Corvos Eternos.', 'frame', 'mythic', '#93C5FD', 'shimmer', 1, 'free', true, NULL, 'exclusive', 324, false, 0, '{"style":"ice","intensity":1.2,"speed":0.9,"size":1.1}'::jsonb, 'conquistas', true, now(), 'keep', 'achievement', true)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_faction_season_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Qualquer membro que tenha contribuído com uma leitura verificada recebe
  -- o brasão de participação da sua própria ordem.
  INSERT INTO public.faction_season_rewards
    (season_id, user_id, faction_slug, reward_key, cosmetic_id)
  SELECT NEW.id, sm.user_id, sm.faction_slug, 'participant_sigil', c.id
  FROM public.faction_season_members sm
  JOIN public.cosmetics c ON c.slug = 'faction-' || sm.faction_slug || '-sigil'
  WHERE sm.season_id = NEW.id
    AND (sm.chapters_read > 0 OR sm.contribution_points > 0)
  ON CONFLICT (season_id, user_id, reward_key) DO NOTHING;

  -- Só integrantes ativos da facção campeã recebem título, moldura e aura do Fagulha.
  IF NEW.winner_slug IS NOT NULL THEN
    INSERT INTO public.faction_season_rewards
      (season_id, user_id, faction_slug, reward_key, cosmetic_id)
    SELECT NEW.id, sm.user_id, sm.faction_slug, 'champion_title', c.id
    FROM public.faction_season_members sm
    JOIN public.cosmetics c ON c.slug = 'faction-' || sm.faction_slug || '-champion-title'
    WHERE sm.season_id = NEW.id
      AND sm.faction_slug = NEW.winner_slug
      AND (sm.chapters_read > 0 OR sm.contribution_points > 0)
    ON CONFLICT (season_id, user_id, reward_key) DO NOTHING;

    INSERT INTO public.faction_season_rewards
      (season_id, user_id, faction_slug, reward_key, cosmetic_id)
    SELECT NEW.id, sm.user_id, sm.faction_slug, 'champion_frame', c.id
    FROM public.faction_season_members sm
    JOIN public.cosmetics c ON c.slug = 'faction-' || sm.faction_slug || '-champion-frame'
    WHERE sm.season_id = NEW.id
      AND sm.faction_slug = NEW.winner_slug
      AND (sm.chapters_read > 0 OR sm.contribution_points > 0)
    ON CONFLICT (season_id, user_id, reward_key) DO NOTHING;

    INSERT INTO public.faction_season_rewards
      (season_id, user_id, faction_slug, reward_key, cosmetic_id)
    SELECT NEW.id, sm.user_id, sm.faction_slug, 'champion_dragon', NULL
    FROM public.faction_season_members sm
    WHERE sm.season_id = NEW.id
      AND sm.faction_slug = NEW.winner_slug
      AND (sm.chapters_read > 0 OR sm.contribution_points > 0)
    ON CONFLICT (season_id, user_id, reward_key) DO NOTHING;
  END IF;

  -- Os itens entram no inventário cosmético existente, mas não substituem
  -- automaticamente o que o usuário escolheu equipar.
  INSERT INTO public.user_cosmetics (user_id, cosmetic_id, equipped, source)
  SELECT r.user_id, r.cosmetic_id, false, 'faction-season'
  FROM public.faction_season_rewards r
  WHERE r.season_id = NEW.id
    AND r.cosmetic_id IS NOT NULL
  ON CONFLICT (user_id, cosmetic_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_faction_season_rewards() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS faction_season_reward_on_completion ON public.faction_seasons;
CREATE TRIGGER faction_season_reward_on_completion
AFTER UPDATE OF status ON public.faction_seasons
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.grant_faction_season_rewards();
