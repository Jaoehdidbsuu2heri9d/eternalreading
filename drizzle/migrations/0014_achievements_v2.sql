-- Conquistas v2: estrutura, leitura por capítulo, eventos, segredos, recompensas idempotentes
ALTER TABLE public.achievements DROP CONSTRAINT IF EXISTS achievements_metric_check;
ALTER TABLE public.achievements
  ADD COLUMN IF NOT EXISTS unlock_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'leitura',
  ADD COLUMN IF NOT EXISTS rarity text NOT NULL DEFAULT 'comum',
  ADD COLUMN IF NOT EXISTS coin_reward integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cosmetic_reward_id uuid REFERENCES public.cosmetics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title_reward text,
  ADD COLUMN IF NOT EXISTS extra_reward text,
  ADD COLUMN IF NOT EXISTS is_secret boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hint text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS metric_param text,
  ADD COLUMN IF NOT EXISTS sort integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.achievements ADD CONSTRAINT achievements_category_check CHECK (category IN
  ('leitura','sequencia','favoritos','exploracao','comunidade','eventos','cosmeticos','coins','assinatura','secreta','progressao'));
ALTER TABLE public.achievements ADD CONSTRAINT achievements_rarity_check CHECK (rarity IN
  ('comum','incomum','raro','epico','lendario','mitico','secreto'));
ALTER TABLE public.achievements ADD CONSTRAINT achievements_rewards_check CHECK (xp_reward >= 0 AND xp_reward <= 100000 AND coin_reward >= 0 AND coin_reward <= 100000);
ALTER TABLE public.achievements ADD CONSTRAINT achievements_metric_check CHECK (metric IN
  ('chapters_read','works_started','works_read','max_chapters_day','streak','favorites','genres_read','genres_all','tags_read',
   'comments','replies_made','replies_received','likes_received','followers','following',
   'events_joined','events_won','event_rewards',
   'cosmetic_equipped','cosmetics_owned','own_rarity','cosmetic_kinds_all',
   'coins_received','shop_purchases','coins_spent','coins_earned',
   'sub_plan','sub_cosmetic_equipped','level','secret','secrets_found','manual'));
UPDATE public.achievements SET category = 'progressao' WHERE metric = 'level';
UPDATE public.achievements SET category = 'favoritos' WHERE metric = 'favorites';

ALTER TABLE public.user_achievements
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS granted_by uuid,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS achievement_animations boolean NOT NULL DEFAULT true;

ALTER TABLE public.coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_source_check;
ALTER TABLE public.coin_transactions ADD CONSTRAINT coin_transactions_source_check
  CHECK (source IN ('subscription','purchase','admin','refund','event','achievement'));

-- Leituras por capítulo (base de contagem, sequência e gêneros)
CREATE TABLE IF NOT EXISTS public.chapter_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  manga_id uuid NOT NULL REFERENCES public.manga(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  read_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
  PRIMARY KEY (user_id, chapter_id)
);
GRANT SELECT ON public.chapter_reads TO authenticated;
GRANT ALL ON public.chapter_reads TO service_role;
ALTER TABLE public.chapter_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chapter reads" ON public.chapter_reads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS chapter_reads_user_day_idx ON public.chapter_reads(user_id, read_on);
CREATE INDEX IF NOT EXISTS chapter_reads_user_manga_idx ON public.chapter_reads(user_id, manga_id);
INSERT INTO public.chapter_reads(user_id, chapter_id, manga_id, read_at, read_on)
  SELECT user_id, chapter_id, manga_id, read_at, (read_at AT TIME ZONE 'America/Sao_Paulo')::date FROM public.reading_history
  ON CONFLICT DO NOTHING;

-- Eventos (registrados só pela equipe)
CREATE TABLE IF NOT EXISTS public.event_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_slug text NOT NULL,
  event_name text NOT NULL,
  won boolean NOT NULL DEFAULT false,
  rewards integer NOT NULL DEFAULT 0 CHECK (rewards >= 0 AND rewards <= 100),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_slug)
);
GRANT SELECT ON public.event_participations TO authenticated;
GRANT ALL ON public.event_participations TO service_role;
ALTER TABLE public.event_participations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or staff events" ON public.event_participations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Descobertas secretas
CREATE TABLE IF NOT EXISTS public.secret_discoveries (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
GRANT ALL ON public.secret_discoveries TO service_role;
ALTER TABLE public.secret_discoveries ENABLE ROW LEVEL SECURITY;

-- Recompensas já entregues (uma vez por usuário/conquista, mesmo se removida e concedida de novo)
CREATE TABLE IF NOT EXISTS public.achievement_rewards (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);
GRANT ALL ON public.achievement_rewards TO service_role;
ALTER TABLE public.achievement_rewards ENABLE ROW LEVEL SECURITY;
INSERT INTO public.achievement_rewards(user_id, achievement_id, granted_at)
  SELECT user_id, achievement_id, unlocked_at FROM public.user_achievements ON CONFLICT DO NOTHING;

-- Conquistas secretas não aparecem para quem não desbloqueou
DROP POLICY IF EXISTS "achievements read" ON public.achievements;
CREATE POLICY "achievements read" ON public.achievements FOR SELECT TO authenticated USING (
  NOT is_secret OR public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.user_achievements u WHERE u.achievement_id = achievements.id AND u.user_id = auth.uid()));

-- Sequência de leitura
CREATE OR REPLACE FUNCTION public.reading_streak(p_user uuid)
RETURNS TABLE(current_streak integer, best_streak integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (SELECT DISTINCT read_on FROM public.chapter_reads WHERE user_id = p_user),
  g AS (SELECT read_on, read_on - (row_number() OVER (ORDER BY read_on))::int AS grp FROM d),
  s AS (SELECT grp, count(*)::int AS n, max(read_on) AS last FROM g GROUP BY grp)
  SELECT
    COALESCE((SELECT n FROM s WHERE last >= (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1 ORDER BY last DESC LIMIT 1), 0),
    COALESCE((SELECT max(n) FROM s), 0);
$$;
REVOKE ALL ON FUNCTION public.reading_streak(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reading_streak(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.achievement_goal(p_metric text, p_goal integer)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE p_metric
    WHEN 'genres_all' THEN GREATEST(1, (SELECT count(*)::int FROM public.genres))
    WHEN 'cosmetic_kinds_all' THEN GREATEST(1, (SELECT count(DISTINCT kind)::int FROM public.cosmetics WHERE active AND kind IN ('border','frame','background','banner')))
    ELSE p_goal END;
$$;
REVOKE ALL ON FUNCTION public.achievement_goal(text,integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.achievement_metric(p_user uuid, p_metric text, p_param text)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v bigint;
BEGIN
  v := CASE p_metric
    WHEN 'chapters_read' THEN (SELECT count(*) FROM chapter_reads WHERE user_id = p_user)
    WHEN 'works_started' THEN (SELECT count(DISTINCT manga_id) FROM chapter_reads WHERE user_id = p_user)
    WHEN 'works_read' THEN (SELECT count(DISTINCT manga_id) FROM chapter_reads WHERE user_id = p_user)
    WHEN 'max_chapters_day' THEN (SELECT COALESCE(max(c),0) FROM (SELECT count(*) c FROM chapter_reads WHERE user_id = p_user GROUP BY read_on) x)
    WHEN 'streak' THEN (SELECT best_streak FROM reading_streak(p_user))
    WHEN 'favorites' THEN (SELECT count(*) FROM favorites WHERE user_id = p_user)
    WHEN 'genres_read' THEN (SELECT count(DISTINCT mg.genre_id) FROM (SELECT DISTINCT manga_id FROM chapter_reads WHERE user_id = p_user) r JOIN manga_genres mg ON mg.manga_id = r.manga_id)
    WHEN 'genres_all' THEN (SELECT count(DISTINCT mg.genre_id) FROM (SELECT DISTINCT manga_id FROM chapter_reads WHERE user_id = p_user) r JOIN manga_genres mg ON mg.manga_id = r.manga_id)
    WHEN 'tags_read' THEN (SELECT count(DISTINCT lower(t)) FROM (SELECT DISTINCT manga_id FROM chapter_reads WHERE user_id = p_user) r JOIN manga m ON m.id = r.manga_id, unnest(m.tags) t)
    WHEN 'comments' THEN (SELECT count(*) FROM comments WHERE user_id = p_user)
    WHEN 'replies_made' THEN (SELECT count(*) FROM comments WHERE user_id = p_user AND parent_id IS NOT NULL)
    WHEN 'replies_received' THEN (SELECT count(*) FROM comments c JOIN comments p ON p.id = c.parent_id WHERE p.user_id = p_user AND c.user_id <> p_user)
    WHEN 'likes_received' THEN (SELECT count(*) FROM comment_likes l JOIN comments c ON c.id = l.comment_id WHERE c.user_id = p_user AND l.user_id <> p_user)
    WHEN 'followers' THEN (SELECT count(*) FROM follows WHERE following_id = p_user)
    WHEN 'following' THEN (SELECT count(*) FROM follows WHERE follower_id = p_user)
    WHEN 'events_joined' THEN (SELECT count(*) FROM event_participations WHERE user_id = p_user)
    WHEN 'events_won' THEN (SELECT count(*) FROM event_participations WHERE user_id = p_user AND won)
    WHEN 'event_rewards' THEN (SELECT COALESCE(sum(rewards),0) FROM event_participations WHERE user_id = p_user)
    WHEN 'cosmetic_equipped' THEN (SELECT count(*) FROM user_cosmetics WHERE user_id = p_user AND equipped)
    WHEN 'cosmetics_owned' THEN (SELECT count(*) FROM user_cosmetics WHERE user_id = p_user)
    WHEN 'own_rarity' THEN (SELECT count(*) FROM user_cosmetics uc JOIN cosmetics c ON c.id = uc.cosmetic_id WHERE uc.user_id = p_user AND c.rarity = p_param)
    WHEN 'cosmetic_kinds_all' THEN (SELECT count(DISTINCT c.kind) FROM user_cosmetics uc JOIN cosmetics c ON c.id = uc.cosmetic_id WHERE uc.user_id = p_user AND c.kind IN ('border','frame','background','banner'))
    WHEN 'coins_received' THEN (SELECT count(*) FROM coin_transactions WHERE user_id = p_user AND amount > 0)
    WHEN 'shop_purchases' THEN (SELECT count(*) FROM coin_transactions WHERE user_id = p_user AND source = 'purchase')
    WHEN 'coins_spent' THEN (SELECT COALESCE(spent,0) FROM coin_wallets WHERE user_id = p_user)
    WHEN 'coins_earned' THEN (SELECT COALESCE(earned,0) FROM coin_wallets WHERE user_id = p_user)
    -- Só conta assinatura confirmada: o bônus 'sub:<id>' é lançado apenas quando a assinatura fica ativa.
    WHEN 'sub_plan' THEN (SELECT count(*) FROM coin_transactions t JOIN subscriptions s ON t.ref = 'sub:' || s.id::text
                           WHERE t.user_id = p_user AND s.user_id = p_user AND s.plan::text = p_param)
    WHEN 'sub_cosmetic_equipped' THEN (SELECT count(*) FROM user_cosmetics uc JOIN cosmetics c ON c.id = uc.cosmetic_id
                           WHERE uc.user_id = p_user AND uc.equipped AND (c.required_plan <> 'free' OR c.availability = 'subscription'))
    WHEN 'level' THEN (SELECT level FROM profiles WHERE id = p_user)
    WHEN 'secret' THEN (SELECT count(*) FROM secret_discoveries WHERE user_id = p_user AND key = p_param)
    WHEN 'secrets_found' THEN (SELECT count(*) FROM user_achievements u JOIN achievements a ON a.id = u.achievement_id
                           WHERE u.user_id = p_user AND a.is_secret AND a.metric <> 'secrets_found')
    ELSE 0 END;
  RETURN COALESCE(v, 0)::int;
END $$;
REVOKE ALL ON FUNCTION public.achievement_metric(uuid,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.award_achievement(p_user uuid, p_ach uuid, p_source text, p_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.achievements; n integer; v_xp integer; parts text := '';
BEGIN
  SELECT * INTO a FROM achievements WHERE id = p_ach;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO user_achievements(user_id, achievement_id, source, granted_by)
    VALUES (p_user, p_ach, p_source, p_actor) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RETURN false; END IF;
  INSERT INTO achievement_rewards(user_id, achievement_id) VALUES (p_user, p_ach) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    IF a.xp_reward > 0 THEN
      UPDATE profiles SET xp = xp + a.xp_reward, level = GREATEST(1, floor(sqrt((xp + a.xp_reward) / 100.0))::int + 1)
        WHERE id = p_user RETURNING xp INTO v_xp;
      IF v_xp IS NOT NULL THEN
        INSERT INTO xp_history(user_id, amount, balance_after, source, reason, actor_id)
          VALUES (p_user, a.xp_reward, v_xp, 'achievement', a.name, p_actor);
      END IF;
      parts := parts || ' +' || a.xp_reward || ' XP';
    END IF;
    IF a.coin_reward > 0 THEN
      PERFORM coins_apply(p_user, a.coin_reward, 'achievement', 'Conquista: ' || a.name, 'ach:' || p_user::text || ':' || a.id::text, NULL, p_actor);
      parts := parts || ' +' || a.coin_reward || ' Coins';
    END IF;
    IF a.cosmetic_reward_id IS NOT NULL THEN
      INSERT INTO user_cosmetics(user_id, cosmetic_id, equipped, source) VALUES (p_user, a.cosmetic_reward_id, false, 'achievement')
        ON CONFLICT DO NOTHING;
      parts := parts || ' + novo item';
    END IF;
  END IF;
  INSERT INTO notifications(user_id, title, body, link)
    VALUES (p_user, 'Conquista desbloqueada: ' || a.name, COALESCE(NULLIF(a.unlock_text,''), a.description) || parts, '/conquistas');
  IF a.is_secret AND a.metric <> 'secrets_found' THEN
    PERFORM evaluate_achievements(p_user, ARRAY['secreta']);
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.award_achievement(uuid,uuid,text,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.evaluate_achievements(p_user uuid, p_categories text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; n integer := 0;
BEGIN
  IF p_user IS NULL THEN RETURN 0; END IF;
  FOR a IN SELECT x.* FROM achievements x
     WHERE x.active AND x.metric <> 'manual'
       AND (p_categories IS NULL OR x.category = ANY(p_categories))
       AND NOT EXISTS (SELECT 1 FROM user_achievements u WHERE u.user_id = p_user AND u.achievement_id = x.id)
     ORDER BY x.sort, x.goal
  LOOP
    IF achievement_metric(p_user, a.metric, a.metric_param) >= achievement_goal(a.metric, a.goal) THEN
      IF award_achievement(p_user, a.id, 'auto', NULL) THEN n := n + 1; END IF;
    END IF;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.evaluate_achievements(uuid,text[]) FROM PUBLIC, anon, authenticated;

-- Compatibilidade: a RPC antiga avalia tudo para o próprio usuário
CREATE OR REPLACE FUNCTION public.check_achievements()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.evaluate_achievements(auth.uid(), NULL);
END $$;

-- Leitura confirmada pelo servidor (substitui XP enviado pelo navegador)
CREATE OR REPLACE FUNCTION public.record_chapter_read(p_chapter uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m uuid; n integer; v_xp integer; h integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT c.manga_id INTO m FROM chapters c JOIN manga g ON g.id = c.manga_id
   WHERE c.id = p_chapter AND c.deleted_at IS NULL AND c.status = 'published' AND g.published AND g.deleted_at IS NULL;
  IF m IS NULL THEN RETURN false; END IF;
  INSERT INTO chapter_reads(user_id, chapter_id, manga_id) VALUES (uid, p_chapter, m) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RETURN false; END IF;
  UPDATE profiles SET xp = xp + 10, level = GREATEST(1, floor(sqrt((xp + 10) / 100.0))::int + 1)
    WHERE id = uid RETURNING xp INTO v_xp;
  IF v_xp IS NOT NULL THEN
    INSERT INTO xp_history(user_id, amount, balance_after, source, reason) VALUES (uid, 10, v_xp, 'reading', 'Capítulo lido');
  END IF;
  h := extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo')::int;
  IF h = 3 THEN
    INSERT INTO secret_discoveries(user_id, key) VALUES (uid, 'madrugada') ON CONFLICT DO NOTHING;
  END IF;
  PERFORM evaluate_achievements(uid, ARRAY['leitura','sequencia','exploracao','secreta']);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.record_chapter_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_chapter_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.discover_secret(p_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); n integer;
BEGIN
  IF uid IS NULL OR p_key NOT IN ('hidden_area','hidden_element','easter_egg') THEN RETURN false; END IF;
  INSERT INTO secret_discoveries(user_id, key) VALUES (uid, p_key) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RETURN false; END IF;
  IF p_key = 'hidden_area' AND (SELECT count(*) FROM secret_discoveries WHERE key = 'hidden_area') <= 10 THEN
    INSERT INTO secret_discoveries(user_id, key) VALUES (uid, 'first_discoverer') ON CONFLICT DO NOTHING;
  END IF;
  PERFORM evaluate_achievements(uid, ARRAY['secreta']);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.discover_secret(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_secret(text) TO authenticated;

-- Gatilhos que avaliam só as categorias afetadas
CREATE OR REPLACE FUNCTION public.ach_on_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE other uuid;
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'favorites' THEN
      PERFORM evaluate_achievements(NEW.user_id, ARRAY['favoritos']);
    ELSIF TG_TABLE_NAME = 'comments' THEN
      PERFORM evaluate_achievements(NEW.user_id, ARRAY['comunidade']);
      IF NEW.parent_id IS NOT NULL THEN
        SELECT user_id INTO other FROM comments WHERE id = NEW.parent_id;
        IF other IS NOT NULL AND other <> NEW.user_id THEN PERFORM evaluate_achievements(other, ARRAY['comunidade']); END IF;
      END IF;
    ELSIF TG_TABLE_NAME = 'comment_likes' THEN
      SELECT user_id INTO other FROM comments WHERE id = NEW.comment_id;
      PERFORM evaluate_achievements(other, ARRAY['comunidade']);
    ELSIF TG_TABLE_NAME = 'follows' THEN
      PERFORM evaluate_achievements(NEW.follower_id, ARRAY['comunidade']);
      PERFORM evaluate_achievements(NEW.following_id, ARRAY['comunidade']);
    ELSIF TG_TABLE_NAME = 'user_cosmetics' THEN
      PERFORM evaluate_achievements(NEW.user_id, ARRAY['cosmeticos','assinatura']);
    ELSIF TG_TABLE_NAME = 'coin_transactions' THEN
      PERFORM evaluate_achievements(NEW.user_id, ARRAY['coins','assinatura']);
    ELSIF TG_TABLE_NAME = 'event_participations' THEN
      PERFORM evaluate_achievements(NEW.user_id, ARRAY['eventos']);
    ELSIF TG_TABLE_NAME = 'profiles' THEN
      IF NEW.level > OLD.level THEN PERFORM evaluate_achievements(NEW.id, ARRAY['progressao']); END IF;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'achievement evaluation failed: %', SQLERRM;
  END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ach_on_event() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER ach_favorites AFTER INSERT ON public.favorites FOR EACH ROW EXECUTE FUNCTION public.ach_on_event();
CREATE TRIGGER ach_comments AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.ach_on_event();
CREATE TRIGGER ach_comment_likes AFTER INSERT ON public.comment_likes FOR EACH ROW EXECUTE FUNCTION public.ach_on_event();
CREATE TRIGGER ach_follows AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.ach_on_event();
CREATE TRIGGER ach_user_cosmetics AFTER INSERT OR UPDATE OF equipped ON public.user_cosmetics FOR EACH ROW EXECUTE FUNCTION public.ach_on_event();
CREATE TRIGGER ach_coin_tx AFTER INSERT ON public.coin_transactions FOR EACH ROW EXECUTE FUNCTION public.ach_on_event();
CREATE TRIGGER ach_events AFTER INSERT OR UPDATE ON public.event_participations FOR EACH ROW EXECUTE FUNCTION public.ach_on_event();
CREATE TRIGGER ach_profiles_level AFTER UPDATE OF level ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.ach_on_event();

-- Lista com progresso (segredos mascarados enquanto bloqueados)
CREATE OR REPLACE FUNCTION public.my_achievements()
RETURNS TABLE(id uuid, slug text, name text, description text, unlock_text text, icon text, category text, rarity text,
  xp_reward integer, coin_reward integer, title_reward text, extra_reward text, cosmetic_name text, is_secret boolean, hint text,
  goal integer, progress integer, unlocked_at timestamptz, featured boolean, owners bigint, owners_pct numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); total bigint;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  SELECT GREATEST(1, count(*)) INTO total FROM profiles;
  RETURN QUERY
  WITH mine AS (SELECT u.achievement_id, u.unlocked_at, u.featured FROM user_achievements u WHERE u.user_id = uid),
  cnt AS (SELECT u.achievement_id, count(*) AS c FROM user_achievements u GROUP BY u.achievement_id),
  metrics AS (SELECT DISTINCT x.metric, x.metric_param FROM achievements x WHERE x.active AND NOT x.is_secret),
  mv AS (SELECT mt.metric, mt.metric_param, achievement_metric(uid, mt.metric, mt.metric_param) AS v FROM metrics mt)
  SELECT a.id,
    CASE WHEN a.is_secret AND mi.unlocked_at IS NULL THEN NULL ELSE a.slug END,
    CASE WHEN a.is_secret AND mi.unlocked_at IS NULL THEN 'Conquista Secreta' ELSE a.name END,
    CASE WHEN a.is_secret AND mi.unlocked_at IS NULL THEN 'Algumas histórias só aparecem para quem procura.' ELSE a.description END,
    CASE WHEN a.is_secret AND mi.unlocked_at IS NULL THEN NULL ELSE a.unlock_text END,
    CASE WHEN a.is_secret AND mi.unlocked_at IS NULL THEN 'lock' ELSE a.icon END,
    a.category,
    CASE WHEN a.is_secret AND mi.unlocked_at IS NULL THEN 'secreto' ELSE a.rarity END,
    CASE WHEN a.is_secret AND mi.unlocked_at IS NULL THEN 0 ELSE a.xp_reward END,
    CASE WHEN a.is_secret AND mi.unlocked_at IS NULL THEN 0 ELSE a.coin_reward END,
    CASE WHEN a.is_secret AND mi.unlocked_at IS NULL THEN NULL ELSE a.title_reward END,
    CASE WHEN a.is_secret AND mi.unlocked_at IS NULL THEN NULL ELSE a.extra_reward END,
    CASE WHEN a.is_secret AND mi.unlocked_at IS NULL THEN NULL ELSE (SELECT c.name FROM cosmetics c WHERE c.id = a.cosmetic_reward_id) END,
    a.is_secret, a.hint,
    CASE WHEN a.is_secret AND mi.unlocked_at IS NULL THEN 0 ELSE achievement_goal(a.metric, a.goal) END,
    CASE WHEN a.is_secret AND mi.unlocked_at IS NULL THEN 0 ELSE COALESCE(mv.v, 0) END,
    mi.unlocked_at, COALESCE(mi.featured, false),
    COALESCE(cn.c, 0), round(COALESCE(cn.c, 0) * 100.0 / total, 1)
  FROM achievements a
  LEFT JOIN mine mi ON mi.achievement_id = a.id
  LEFT JOIN cnt cn ON cn.achievement_id = a.id
  LEFT JOIN mv ON mv.metric = a.metric AND mv.metric_param IS NOT DISTINCT FROM a.metric_param
  WHERE a.active OR mi.unlocked_at IS NOT NULL
  ORDER BY a.sort, a.goal;
END $$;
REVOKE ALL ON FUNCTION public.my_achievements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_achievements() TO authenticated;

CREATE OR REPLACE FUNCTION public.profile_achievements(p_user uuid)
RETURNS TABLE(id uuid, name text, icon text, rarity text, unlocked_at timestamptz, featured boolean, owners_pct numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); total bigint;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  SELECT GREATEST(1, count(*)) INTO total FROM profiles;
  RETURN QUERY
  SELECT a.id,
    CASE WHEN a.is_secret AND p_user <> uid AND NOT EXISTS (SELECT 1 FROM user_achievements v WHERE v.user_id = uid AND v.achievement_id = a.id)
      THEN 'Conquista Secreta' ELSE a.name END,
    CASE WHEN a.is_secret AND p_user <> uid AND NOT EXISTS (SELECT 1 FROM user_achievements v WHERE v.user_id = uid AND v.achievement_id = a.id)
      THEN 'lock' ELSE a.icon END,
    CASE WHEN a.is_secret AND p_user <> uid AND NOT EXISTS (SELECT 1 FROM user_achievements v WHERE v.user_id = uid AND v.achievement_id = a.id)
      THEN 'secreto' ELSE a.rarity END,
    u.unlocked_at, u.featured,
    round((SELECT count(*) FROM user_achievements w WHERE w.achievement_id = a.id) * 100.0 / total, 1)
  FROM user_achievements u JOIN achievements a ON a.id = u.achievement_id
  WHERE u.user_id = p_user
  ORDER BY u.unlocked_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.profile_achievements(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_achievements(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_featured_achievements(p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF COALESCE(array_length(p_ids, 1), 0) > 5 THEN RAISE EXCEPTION 'max 5'; END IF;
  UPDATE user_achievements SET featured = (achievement_id = ANY(COALESCE(p_ids, '{}'))) WHERE user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.set_featured_achievements(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_featured_achievements(uuid[]) TO authenticated;

-- Administração
CREATE OR REPLACE FUNCTION public.admin_grant_achievement(p_user uuid, p_ach uuid, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean; nm text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF COALESCE(length(trim(p_reason)), 0) < 3 THEN RAISE EXCEPTION 'reason required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user) THEN RAISE EXCEPTION 'user not found'; END IF;
  SELECT name INTO nm FROM achievements WHERE id = p_ach;
  IF nm IS NULL THEN RAISE EXCEPTION 'achievement not found'; END IF;
  ok := award_achievement(p_user, p_ach, 'admin', auth.uid());
  IF NOT ok THEN RAISE EXCEPTION 'already unlocked'; END IF;
  PERFORM write_admin_log('achievement_granted', p_user, jsonb_build_object('achievement', nm, 'reason', trim(p_reason)));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.admin_grant_achievement(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_achievement(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_achievement(p_user uuid, p_ach uuid, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text; n integer;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF COALESCE(length(trim(p_reason)), 0) < 3 THEN RAISE EXCEPTION 'reason required'; END IF;
  SELECT name INTO nm FROM achievements WHERE id = p_ach;
  DELETE FROM user_achievements WHERE user_id = p_user AND achievement_id = p_ach;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'not unlocked'; END IF;
  PERFORM write_admin_log('achievement_revoked', p_user, jsonb_build_object('achievement', nm, 'reason', trim(p_reason)));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.admin_revoke_achievement(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_achievement(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_record_event(p_user uuid, p_slug text, p_name text, p_won boolean, p_rewards integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF COALESCE(length(trim(p_slug)), 0) < 2 OR COALESCE(length(trim(p_name)), 0) < 2 THEN RAISE EXCEPTION 'invalid event'; END IF;
  IF p_rewards < 0 OR p_rewards > 100 THEN RAISE EXCEPTION 'invalid rewards'; END IF;
  INSERT INTO event_participations(user_id, event_slug, event_name, won, rewards, created_by)
    VALUES (p_user, lower(trim(p_slug)), trim(p_name), COALESCE(p_won,false), COALESCE(p_rewards,0), auth.uid())
    ON CONFLICT (user_id, event_slug) DO UPDATE SET won = EXCLUDED.won, rewards = EXCLUDED.rewards, event_name = EXCLUDED.event_name;
  PERFORM write_admin_log('event_recorded', p_user, jsonb_build_object('event', trim(p_name), 'won', p_won, 'rewards', p_rewards));
END $$;
REVOKE ALL ON FUNCTION public.admin_record_event(uuid,text,text,boolean,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_record_event(uuid,text,text,boolean,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_achievement_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM write_admin_log(CASE TG_OP WHEN 'INSERT' THEN 'achievement_created' WHEN 'DELETE' THEN 'achievement_deleted' ELSE 'achievement_updated' END,
      NULL, jsonb_build_object('achievement', COALESCE(NEW.name, OLD.name)));
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER achievements_log BEFORE INSERT OR UPDATE OR DELETE ON public.achievements FOR EACH ROW EXECUTE FUNCTION public.log_achievement_change();

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_achievements;