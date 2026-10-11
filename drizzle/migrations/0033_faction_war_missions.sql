-- Primeira guerra e quadro de missões da Eternal Reading.
-- Pontuação validada no servidor, com completions idempotentes por temporada/missão/período.

CREATE TABLE IF NOT EXISTS public.faction_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','completed')),
  winner_slug text REFERENCES public.factions(slug) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS faction_seasons_one_active_idx
  ON public.faction_seasons (status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS faction_seasons_start_idx
  ON public.faction_seasons (start_at DESC);

CREATE TABLE IF NOT EXISTS public.faction_season_scores (
  season_id uuid NOT NULL REFERENCES public.faction_seasons(id) ON DELETE CASCADE,
  faction_slug text NOT NULL REFERENCES public.factions(slug) ON DELETE RESTRICT,
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  chapters_read integer NOT NULL DEFAULT 0 CHECK (chapters_read >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, faction_slug)
);

CREATE TABLE IF NOT EXISTS public.faction_season_members (
  season_id uuid NOT NULL REFERENCES public.faction_seasons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  faction_slug text NOT NULL REFERENCES public.factions(slug) ON DELETE RESTRICT,
  contribution_points integer NOT NULL DEFAULT 0 CHECK (contribution_points >= 0),
  chapters_read integer NOT NULL DEFAULT 0 CHECK (chapters_read >= 0),
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz,
  PRIMARY KEY (season_id, user_id)
);
CREATE INDEX IF NOT EXISTS faction_season_members_rank_idx
  ON public.faction_season_members (season_id, faction_slug, contribution_points DESC);

CREATE TABLE IF NOT EXISTS public.faction_missions (
  mission_key text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  cadence text NOT NULL CHECK (cadence IN ('daily','weekly')),
  target_count integer NOT NULL CHECK (target_count > 0),
  reward_points integer NOT NULL CHECK (reward_points > 0),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO public.faction_missions (mission_key, title, description, cadence, target_count, reward_points, sort_order)
VALUES
  ('daily-reading', 'Manter a chama acesa', 'Conclua uma leitura válida hoje para fortalecer sua ordem.', 'daily', 1, 5, 1),
  ('weekly-three-chapters', 'Arquivos da semana', 'Conclua 3 capítulos distintos nesta semana para sua facção.', 'weekly', 3, 25, 2)
ON CONFLICT (mission_key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  cadence = EXCLUDED.cadence,
  target_count = EXCLUDED.target_count,
  reward_points = EXCLUDED.reward_points,
  active = true,
  sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS public.faction_mission_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.faction_seasons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  faction_slug text NOT NULL REFERENCES public.factions(slug) ON DELETE RESTRICT,
  mission_key text NOT NULL REFERENCES public.faction_missions(mission_key) ON DELETE RESTRICT,
  period_start date NOT NULL,
  points_awarded integer NOT NULL CHECK (points_awarded > 0),
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, user_id, mission_key, period_start)
);
CREATE INDEX IF NOT EXISTS faction_mission_completions_user_idx
  ON public.faction_mission_completions (user_id, season_id, completed_at DESC);

ALTER TABLE public.faction_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faction_season_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faction_season_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faction_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faction_mission_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS faction_seasons_read_authenticated ON public.faction_seasons;
CREATE POLICY faction_seasons_read_authenticated ON public.faction_seasons
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS faction_season_scores_read_authenticated ON public.faction_season_scores;
CREATE POLICY faction_season_scores_read_authenticated ON public.faction_season_scores
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS faction_season_members_read_authenticated ON public.faction_season_members;
CREATE POLICY faction_season_members_read_authenticated ON public.faction_season_members
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS faction_missions_read_authenticated ON public.faction_missions;
CREATE POLICY faction_missions_read_authenticated ON public.faction_missions
  FOR SELECT TO authenticated USING (active);
DROP POLICY IF EXISTS faction_mission_completions_own_read ON public.faction_mission_completions;
CREATE POLICY faction_mission_completions_own_read ON public.faction_mission_completions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

GRANT SELECT ON public.faction_seasons, public.faction_season_scores, public.faction_season_members, public.faction_missions, public.faction_mission_completions TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.faction_seasons, public.faction_season_scores, public.faction_season_members, public.faction_missions, public.faction_mission_completions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.faction_seasons, public.faction_season_scores, public.faction_season_members, public.faction_missions, public.faction_mission_completions TO service_role;

-- Primeira temporada de 28 dias. A migration é idempotente caso o bloco seja reaplicado.
INSERT INTO public.faction_seasons (name, description, start_at, end_at, status)
SELECT
  'O Despertar das Quatro Ordens',
  'A primeira guerra oficial da Eternal: quatro ideais, um universo e uma história que será lembrada.',
  now(),
  now() + interval '28 days',
  'active'
WHERE NOT EXISTS (SELECT 1 FROM public.faction_seasons WHERE status = 'active');

INSERT INTO public.faction_season_scores (season_id, faction_slug)
SELECT s.id, f.slug
FROM public.faction_seasons s
CROSS JOIN public.factions f
WHERE s.status = 'active' AND f.active
ON CONFLICT (season_id, faction_slug) DO NOTHING;

INSERT INTO public.faction_season_members (season_id, user_id, faction_slug)
SELECT s.id, uf.user_id, uf.faction_slug
FROM public.faction_seasons s
JOIN public.user_factions uf ON true
WHERE s.status = 'active'
ON CONFLICT (season_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.award_faction_mission(
  p_user uuid,
  p_season uuid,
  p_faction_slug text,
  p_mission_key text,
  p_period_start date
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  reward integer;
  inserted_count integer := 0;
BEGIN
  IF p_user IS NULL OR p_season IS NULL OR p_faction_slug IS NULL THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_factions
    WHERE user_id = p_user AND faction_slug = p_faction_slug
  ) THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.faction_seasons
    WHERE id = p_season AND status = 'active'
      AND start_at <= now() AND end_at > now()
  ) THEN
    RETURN false;
  END IF;

  SELECT reward_points INTO reward
  FROM public.faction_missions
  WHERE mission_key = p_mission_key AND active;
  IF reward IS NULL THEN RETURN false; END IF;

  INSERT INTO public.faction_mission_completions
    (season_id, user_id, faction_slug, mission_key, period_start, points_awarded)
  VALUES (p_season, p_user, p_faction_slug, p_mission_key, p_period_start, reward)
  ON CONFLICT (season_id, user_id, mission_key, period_start) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 0 THEN RETURN false; END IF;

  INSERT INTO public.faction_season_members (season_id, user_id, faction_slug)
  VALUES (p_season, p_user, p_faction_slug)
  ON CONFLICT (season_id, user_id) DO NOTHING;

  INSERT INTO public.faction_season_scores (season_id, faction_slug)
  VALUES (p_season, p_faction_slug)
  ON CONFLICT (season_id, faction_slug) DO NOTHING;

  UPDATE public.faction_season_members
  SET contribution_points = contribution_points + reward,
      last_activity_at = now()
  WHERE season_id = p_season AND user_id = p_user AND faction_slug = p_faction_slug;

  UPDATE public.faction_season_scores
  SET points = points + reward, updated_at = now()
  WHERE season_id = p_season AND faction_slug = p_faction_slug;

  UPDATE public.user_factions
  SET contribution_points = contribution_points + reward
  WHERE user_id = p_user AND faction_slug = p_faction_slug;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.award_faction_mission(uuid, uuid, text, text, date) FROM PUBLIC, anon, authenticated;

-- Uma nova leitura distinta contribui com 10 pontos na temporada e pode fechar a missão semanal.
CREATE OR REPLACE FUNCTION public.record_faction_season_chapter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  season_row public.faction_seasons%ROWTYPE;
  slug text;
  weekly_count integer := 0;
  week_start date;
BEGIN
  SELECT * INTO season_row
  FROM public.faction_seasons
  WHERE status = 'active' AND start_at <= now() AND end_at > now()
  ORDER BY start_at DESC
  LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT faction_slug INTO slug
  FROM public.user_factions
  WHERE user_id = NEW.user_id;
  IF slug IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.faction_season_members (season_id, user_id, faction_slug)
  VALUES (season_row.id, NEW.user_id, slug)
  ON CONFLICT (season_id, user_id) DO NOTHING;
  INSERT INTO public.faction_season_scores (season_id, faction_slug)
  VALUES (season_row.id, slug)
  ON CONFLICT (season_id, faction_slug) DO NOTHING;

  UPDATE public.faction_season_members
  SET contribution_points = contribution_points + 10,
      chapters_read = chapters_read + 1,
      last_activity_at = now()
  WHERE season_id = season_row.id AND user_id = NEW.user_id AND faction_slug = slug;

  UPDATE public.faction_season_scores
  SET points = points + 10,
      chapters_read = chapters_read + 1,
      updated_at = now()
  WHERE season_id = season_row.id AND faction_slug = slug;

  week_start := date_trunc('week', NEW.read_on::timestamp)::date;
  SELECT count(*)::integer INTO weekly_count
  FROM public.chapter_reads cr
  WHERE cr.user_id = NEW.user_id
    AND cr.read_on >= week_start
    AND cr.read_on <= NEW.read_on
    AND cr.read_at >= season_row.start_at;

  IF weekly_count >= 3 THEN
    PERFORM public.award_faction_mission(NEW.user_id, season_row.id, slug, 'weekly-three-chapters', week_start);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_faction_season_chapter() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS faction_season_chapter_on_valid_read ON public.chapter_reads;
CREATE TRIGGER faction_season_chapter_on_valid_read
AFTER INSERT ON public.chapter_reads
FOR EACH ROW EXECUTE FUNCTION public.record_faction_season_chapter();

-- A sequência diária é a prova idempotente da missão diária.
CREATE OR REPLACE FUNCTION public.record_faction_daily_mission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  season_row public.faction_seasons%ROWTYPE;
  slug text;
BEGIN
  SELECT * INTO season_row
  FROM public.faction_seasons
  WHERE status = 'active' AND start_at <= now() AND end_at > now()
  ORDER BY start_at DESC
  LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT faction_slug INTO slug
  FROM public.user_factions
  WHERE user_id = NEW.user_id;
  IF slug IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.faction_season_members (season_id, user_id, faction_slug)
  VALUES (season_row.id, NEW.user_id, slug)
  ON CONFLICT (season_id, user_id) DO NOTHING;
  INSERT INTO public.faction_season_scores (season_id, faction_slug)
  VALUES (season_row.id, slug)
  ON CONFLICT (season_id, faction_slug) DO NOTHING;

  PERFORM public.award_faction_mission(
    NEW.user_id, season_row.id, slug, 'daily-reading', NEW.read_on
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_faction_daily_mission() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS faction_daily_mission_on_sequence_day ON public.dragon_sequence_days;
CREATE TRIGGER faction_daily_mission_on_sequence_day
AFTER INSERT ON public.dragon_sequence_days
FOR EACH ROW EXECUTE FUNCTION public.record_faction_daily_mission();

-- Escolher ordem durante a temporada também cria o membro sazonal e reconhece
-- atividades já verificadas nesta temporada/semana sem permitir trocar de facção.
CREATE OR REPLACE FUNCTION public.choose_faction(p_faction_slug text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  inserted_count integer := 0;
  season_row public.faction_seasons%ROWTYPE;
  today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  week_start date := date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  weekly_count integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.factions WHERE slug = p_faction_slug AND active) THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_factions (user_id, faction_slug)
  VALUES (uid, p_faction_slug)
  ON CONFLICT (user_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 0 THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_factions
      WHERE user_id = uid AND faction_slug = p_faction_slug
    );
  END IF;

  SELECT * INTO season_row
  FROM public.faction_seasons
  WHERE status = 'active' AND start_at <= now() AND end_at > now()
  ORDER BY start_at DESC
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.faction_season_members (season_id, user_id, faction_slug)
    VALUES (season_row.id, uid, p_faction_slug)
    ON CONFLICT (season_id, user_id) DO NOTHING;
    INSERT INTO public.faction_season_scores (season_id, faction_slug)
    VALUES (season_row.id, p_faction_slug)
    ON CONFLICT (season_id, faction_slug) DO NOTHING;

    IF EXISTS (SELECT 1 FROM public.dragon_sequence_days WHERE user_id = uid AND read_on = today) THEN
      PERFORM public.award_faction_mission(uid, season_row.id, p_faction_slug, 'daily-reading', today);
    END IF;

    SELECT count(*)::integer INTO weekly_count
    FROM public.chapter_reads cr
    WHERE cr.user_id = uid
      AND cr.read_on >= week_start
      AND cr.read_on <= today
      AND cr.read_at >= season_row.start_at;
    IF weekly_count >= 3 THEN
      PERFORM public.award_faction_mission(uid, season_row.id, p_faction_slug, 'weekly-three-chapters', week_start);
    END IF;
  END IF;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.choose_faction(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.choose_faction(text) TO authenticated;

-- RPC para painel de missões; nunca aceita ID de usuário vindo do navegador.
CREATE OR REPLACE FUNCTION public.faction_mission_dashboard()
RETURNS TABLE (
  season_id uuid,
  season_name text,
  season_description text,
  season_start_at timestamptz,
  season_end_at timestamptz,
  my_faction_slug text,
  my_faction_name text,
  my_season_points integer,
  mission_key text,
  mission_title text,
  mission_description text,
  cadence text,
  target_count integer,
  reward_points integer,
  current_progress integer,
  completed boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  week_start date := date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.description,
    s.start_at,
    s.end_at,
    uf.faction_slug,
    f.name,
    COALESCE(sm.contribution_points, 0),
    m.mission_key,
    m.title,
    m.description,
    m.cadence,
    m.target_count,
    m.reward_points,
    CASE
      WHEN m.cadence = 'daily' THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM public.dragon_sequence_days d
          WHERE d.user_id = uid AND d.read_on = today
        ) THEN 1 ELSE 0 END
      ELSE LEAST(
        m.target_count,
        (SELECT count(*)::integer FROM public.chapter_reads cr
         WHERE cr.user_id = uid
           AND cr.read_on >= week_start
           AND cr.read_on <= today
           AND cr.read_at >= s.start_at)
      )
    END,
    EXISTS (
      SELECT 1
      FROM public.faction_mission_completions mc
      WHERE mc.season_id = s.id
        AND mc.user_id = uid
        AND mc.mission_key = m.mission_key
        AND mc.period_start = CASE WHEN m.cadence = 'daily' THEN today ELSE week_start END
    )
  FROM public.faction_seasons s
  CROSS JOIN public.faction_missions m
  LEFT JOIN public.user_factions uf ON uf.user_id = uid
  LEFT JOIN public.factions f ON f.slug = uf.faction_slug
  LEFT JOIN public.faction_season_members sm ON sm.season_id = s.id AND sm.user_id = uid
  WHERE s.status = 'active'
    AND s.start_at <= now()
    AND s.end_at > now()
    AND m.active
  ORDER BY m.sort_order;
END;
$$;
REVOKE ALL ON FUNCTION public.faction_mission_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.faction_mission_dashboard() TO authenticated;

-- Inicia a próxima temporada apenas por RPC administrativa, preservando o histórico.
CREATE OR REPLACE FUNCTION public.start_faction_season(
  p_name text,
  p_description text DEFAULT '',
  p_duration_days integer DEFAULT 28
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL OR NOT (
    public.has_role(uid, 'admin'::public.app_role)
    OR public.has_role(uid, 'owner'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem iniciar temporadas';
  END IF;
  IF length(trim(COALESCE(p_name, ''))) < 3 OR length(trim(p_name)) > 100 THEN
    RAISE EXCEPTION 'O nome da temporada deve ter entre 3 e 100 caracteres';
  END IF;
  IF p_duration_days < 7 OR p_duration_days > 60 THEN
    RAISE EXCEPTION 'A duração deve ficar entre 7 e 60 dias';
  END IF;

  UPDATE public.faction_seasons s
  SET status = 'completed',
      winner_slug = (
        SELECT score.faction_slug
        FROM public.faction_season_scores score
        WHERE score.season_id = s.id
        ORDER BY score.points DESC, score.chapters_read DESC, score.faction_slug ASC
        LIMIT 1
      )
  WHERE s.status = 'active';

  INSERT INTO public.faction_seasons (name, description, start_at, end_at, status, created_by)
  VALUES (trim(p_name), COALESCE(p_description, ''), now(), now() + make_interval(days => p_duration_days), 'active', uid)
  RETURNING id INTO new_id;

  INSERT INTO public.faction_season_scores (season_id, faction_slug)
  SELECT new_id, slug FROM public.factions WHERE active
  ON CONFLICT (season_id, faction_slug) DO NOTHING;

  INSERT INTO public.faction_season_members (season_id, user_id, faction_slug)
  SELECT new_id, user_id, faction_slug FROM public.user_factions
  ON CONFLICT (season_id, user_id) DO NOTHING;

  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.start_faction_season(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_faction_season(text, text, integer) TO authenticated;
