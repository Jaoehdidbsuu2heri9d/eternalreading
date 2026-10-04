ALTER TABLE public.cosmetics DROP CONSTRAINT cosmetics_kind_check;
ALTER TABLE public.cosmetics ADD CONSTRAINT cosmetics_kind_check CHECK (kind = ANY (ARRAY['banner','frame','border','badge','title','background','effect','theme']));
ALTER TABLE public.cosmetics DROP CONSTRAINT cosmetics_rarity_check;
ALTER TABLE public.cosmetics ADD CONSTRAINT cosmetics_rarity_check CHECK (rarity = ANY (ARRAY['common','uncommon','rare','epic','legendary','mythic']));

ALTER TABLE public.cosmetics
  ADD COLUMN animation text NOT NULL DEFAULT 'none' CHECK (animation IN ('none','pulse','spin','shimmer','glow','drift')),
  ADD COLUMN media_url text,
  ADD COLUMN coin_price integer CHECK (coin_price IS NULL OR coin_price >= 0),
  ADD COLUMN availability text NOT NULL DEFAULT 'unlockable' CHECK (availability IN ('unlockable','shop','event','subscription','exclusive','limited')),
  ADD COLUMN event_slug text,
  ADD COLUMN starts_at timestamptz,
  ADD COLUMN ends_at timestamptz,
  ADD COLUMN sort integer NOT NULL DEFAULT 0,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.user_cosmetics ADD COLUMN source text NOT NULL DEFAULT 'unlock';

CREATE TRIGGER cosmetics_updated_at BEFORE UPDATE ON public.cosmetics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Equipar: confere ativo, janela de datas, nível/plano e — para itens não "desbloqueáveis" — posse.
CREATE OR REPLACE FUNCTION public.equip_cosmetic(p_cosmetic uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.cosmetics; pr public.profiles; owned boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO c FROM public.cosmetics WHERE id = p_cosmetic AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found'; END IF;
  SELECT * INTO pr FROM public.profiles WHERE id = auth.uid();
  SELECT EXISTS (SELECT 1 FROM public.user_cosmetics WHERE user_id = auth.uid() AND cosmetic_id = c.id) INTO owned;
  IF NOT owned THEN
    IF c.availability NOT IN ('unlockable','subscription') THEN RAISE EXCEPTION 'not owned'; END IF;
    IF (c.starts_at IS NOT NULL AND now() < c.starts_at) OR (c.ends_at IS NOT NULL AND now() > c.ends_at) THEN RAISE EXCEPTION 'unavailable'; END IF;
  END IF;
  IF pr.level < c.required_level
     OR array_position(ARRAY['free','eternal','eternal_sunshine'], pr.plan::text) < array_position(ARRAY['free','eternal','eternal_sunshine'], c.required_plan::text)
  THEN RAISE EXCEPTION 'locked'; END IF;
  UPDATE public.user_cosmetics uc SET equipped = false FROM public.cosmetics k
    WHERE uc.cosmetic_id = k.id AND uc.user_id = auth.uid() AND k.kind = c.kind;
  INSERT INTO public.user_cosmetics(user_id, cosmetic_id, equipped) VALUES (auth.uid(), c.id, true)
    ON CONFLICT (user_id, cosmetic_id) DO UPDATE SET equipped = true;
END $$;

-- Admin: conceder/retirar item de um usuário.
CREATE OR REPLACE FUNCTION public.admin_grant_cosmetic(p_user uuid, p_cosmetic uuid, p_grant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_grant THEN
    INSERT INTO public.user_cosmetics(user_id, cosmetic_id, equipped, source) VALUES (p_user, p_cosmetic, false, 'admin')
      ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_cosmetics WHERE user_id = p_user AND cosmetic_id = p_cosmetic;
  END IF;
  PERFORM public.write_admin_log(CASE WHEN p_grant THEN 'cosmetic_granted' ELSE 'cosmetic_revoked' END, p_user,
    jsonb_build_object('cosmetic', (SELECT name FROM public.cosmetics WHERE id = p_cosmetic)));
END $$;

-- Admin: contagem de donos/equipados por item.
CREATE OR REPLACE FUNCTION public.admin_cosmetic_stats()
RETURNS TABLE(cosmetic_id uuid, owners bigint, equipped bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT uc.cosmetic_id, count(*), count(*) FILTER (WHERE uc.equipped) FROM public.user_cosmetics uc GROUP BY uc.cosmetic_id;
END $$;

CREATE OR REPLACE FUNCTION public.log_cosmetic_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN PERFORM public.write_admin_log('cosmetic_created', NULL, jsonb_build_object('cosmetic', NEW.name));
  ELSIF TG_OP = 'UPDATE' THEN PERFORM public.write_admin_log(
    CASE WHEN OLD.active <> NEW.active THEN (CASE WHEN NEW.active THEN 'cosmetic_activated' ELSE 'cosmetic_deactivated' END) ELSE 'cosmetic_updated' END,
    NULL, jsonb_build_object('cosmetic', NEW.name));
  ELSE PERFORM public.write_admin_log('cosmetic_deleted', NULL, jsonb_build_object('cosmetic', OLD.name));
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER cosmetics_log AFTER INSERT OR UPDATE OR DELETE ON public.cosmetics FOR EACH ROW EXECUTE FUNCTION public.log_cosmetic_change();

REVOKE EXECUTE ON FUNCTION public.admin_grant_cosmetic(uuid,uuid,boolean), public.admin_cosmetic_stats(), public.log_cosmetic_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_cosmetic(uuid,uuid,boolean), public.admin_cosmetic_stats() TO authenticated;