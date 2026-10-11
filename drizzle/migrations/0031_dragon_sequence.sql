-- Dragãozinho da Sequência Eternal.
-- Um capítulo concluído e validado no servidor pode conceder 10 pontos por dia.
-- O histórico válido existente é preservado no saldo inicial; a chave única
-- user_id + read_on impede duplicar pontos mesmo lendo vários capítulos no dia.

CREATE TABLE IF NOT EXISTS public.dragon_sequence_days (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_on date NOT NULL,
  points_awarded integer NOT NULL DEFAULT 10 CHECK (points_awarded = 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, read_on)
);

ALTER TABLE public.dragon_sequence_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.dragon_sequence_days FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.dragon_sequence_days TO service_role;
CREATE INDEX IF NOT EXISTS dragon_sequence_days_user_date_idx
  ON public.dragon_sequence_days (user_id, read_on DESC);

-- Garante um registro diário mesmo quando a pessoa revisita um capítulo antigo.
-- O único fluxo autorizado que grava a tabela é o RPC que valida a sessão de leitura.
CREATE OR REPLACE FUNCTION public.award_dragon_sequence_day()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.dragon_sequence_days (user_id, read_on, points_awarded)
  VALUES (NEW.user_id, NEW.read_on, 10)
  ON CONFLICT (user_id, read_on) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.award_dragon_sequence_day() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS dragon_sequence_day_on_valid_read ON public.chapter_reads;
CREATE TRIGGER dragon_sequence_day_on_valid_read
AFTER INSERT ON public.chapter_reads
FOR EACH ROW EXECUTE FUNCTION public.award_dragon_sequence_day();

-- Preserva a evolução que já está comprovada no histórico de leituras.
INSERT INTO public.dragon_sequence_days (user_id, read_on, points_awarded)
SELECT user_id, read_on, 10
FROM public.chapter_reads
GROUP BY user_id, read_on
ON CONFLICT (user_id, read_on) DO NOTHING;

-- A sequência diária acompanha leituras concluídas, mesmo ao revisitar uma obra.
CREATE OR REPLACE FUNCTION public.reading_streak(p_user uuid)
RETURNS TABLE(current_streak integer, best_streak integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH d AS (
    SELECT DISTINCT read_on
    FROM public.dragon_sequence_days
    WHERE user_id = p_user
  ),
  g AS (
    SELECT read_on, read_on - (row_number() OVER (ORDER BY read_on))::int AS grp
    FROM d
  ),
  s AS (
    SELECT grp, count(*)::int AS n, max(read_on) AS last
    FROM g
    GROUP BY grp
  )
  SELECT
    COALESCE((SELECT n FROM s WHERE last >= (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1 ORDER BY last DESC LIMIT 1), 0),
    COALESCE((SELECT max(n) FROM s), 0);
$$;
REVOKE ALL ON FUNCTION public.reading_streak(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reading_streak(uuid) TO authenticated;

-- Reabrir capítulo reinicia o temporizador do servidor; uma sessão só pode ser
-- consumida uma vez no RPC de conclusão, sem alterar XP de capítulos já premiados.
CREATE OR REPLACE FUNCTION public.record_chapter_open(p_chapter uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.chapters c
    JOIN public.manga m ON m.id = c.manga_id
    WHERE c.id = p_chapter
      AND c.status = 'published'
      AND c.deleted_at IS NULL
      AND m.published
      AND m.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM public.chapter_pages pg WHERE pg.chapter_id = c.id)
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.chapter_read_sessions (user_id, chapter_id, started_at)
  VALUES (uid, p_chapter, now())
  ON CONFLICT (user_id, chapter_id) DO UPDATE SET started_at = EXCLUDED.started_at;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.record_chapter_open(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_chapter_open(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_chapter_read(p_chapter uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  m uuid;
  chapter_added integer := 0;
  day_added integer := 0;
  session_consumed integer := 0;
  v_xp integer;
  h integer;
  today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT c.manga_id INTO m
  FROM public.chapters c
  JOIN public.manga g ON g.id = c.manga_id
  WHERE c.id = p_chapter
    AND c.deleted_at IS NULL
    AND c.status = 'published'
    AND g.published
    AND g.deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.chapter_pages pg WHERE pg.chapter_id = c.id);
  IF m IS NULL THEN RETURN false; END IF;

  -- Consumir atomicamente uma sessão iniciada há pelo menos 8 segundos.
  DELETE FROM public.chapter_read_sessions s
  WHERE s.user_id = uid
    AND s.chapter_id = p_chapter
    AND s.started_at <= now() - interval '8 seconds';
  GET DIAGNOSTICS session_consumed = ROW_COUNT;
  IF session_consumed = 0 THEN RETURN false; END IF;

  -- Cada data brasileira rende 10 pontos, inclusive quando o capítulo já foi lido.
  INSERT INTO public.dragon_sequence_days (user_id, read_on, points_awarded)
  VALUES (uid, today, 10)
  ON CONFLICT (user_id, read_on) DO NOTHING;
  GET DIAGNOSTICS day_added = ROW_COUNT;

  -- XP e contagem vitalícia de capítulos permanecem uma única vez por capítulo.
  INSERT INTO public.chapter_reads (user_id, chapter_id, manga_id)
  VALUES (uid, p_chapter, m)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS chapter_added = ROW_COUNT;

  IF chapter_added > 0 THEN
    UPDATE public.profiles
    SET xp = xp + 10,
        level = GREATEST(1, floor(sqrt((xp + 10) / 100.0))::int + 1)
    WHERE id = uid
    RETURNING xp INTO v_xp;

    IF v_xp IS NOT NULL THEN
      INSERT INTO public.xp_history (user_id, amount, balance_after, source, reason)
      VALUES (uid, 10, v_xp, 'reading', 'Capítulo lido');
    END IF;
  END IF;

  IF day_added > 0 THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      uid,
      'Fagulha ganhou 10 pontos!',
      'Você concluiu uma leitura hoje e ajudou seu Dragãozinho a evoluir.',
      '/sequencia'
    );
  END IF;

  h := extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo')::int;
  IF chapter_added > 0 AND h = 3 THEN
    INSERT INTO public.secret_discoveries (user_id, key)
    VALUES (uid, 'madrugada')
    ON CONFLICT DO NOTHING;
  END IF;

  IF chapter_added > 0 OR day_added > 0 THEN
    PERFORM public.evaluate_achievements(uid, ARRAY['leitura','sequencia','exploracao','secreta']);
  END IF;

  -- true significa que a leitura foi validada; XP continua protegido pelo chapter_added.
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.record_chapter_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_chapter_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.dragon_sequence_stats()
RETURNS TABLE (
  current_streak integer,
  best_streak integer,
  active_days integer,
  sequence_points integer,
  last_read_on date,
  read_today boolean,
  week_read_days date[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  RETURN QUERY
  SELECT
    COALESCE(st.current_streak, 0),
    COALESCE(st.best_streak, 0),
    COALESCE(days.active_days, 0),
    COALESCE(days.sequence_points, 0),
    days.last_read_on,
    COALESCE(days.read_today, false),
    COALESCE(days.week_read_days, ARRAY[]::date[])
  FROM public.reading_streak(uid) AS st
  CROSS JOIN LATERAL (
    SELECT
      count(*)::integer AS active_days,
      COALESCE(sum(d.points_awarded), 0)::integer AS sequence_points,
      max(d.read_on) AS last_read_on,
      bool_or(d.read_on = today) AS read_today,
      ARRAY(
        SELECT recent.read_on
        FROM public.dragon_sequence_days AS recent
        WHERE recent.user_id = uid
          AND recent.read_on BETWEEN today - 6 AND today
        ORDER BY recent.read_on
      ) AS week_read_days
    FROM public.dragon_sequence_days AS d
    WHERE d.user_id = uid
  ) AS days;
END;
$$;

REVOKE ALL ON FUNCTION public.dragon_sequence_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dragon_sequence_stats() TO authenticated;
