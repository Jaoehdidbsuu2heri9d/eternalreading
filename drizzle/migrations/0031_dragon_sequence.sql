-- Dragãozinho da Sequência Eternal.
-- Pontos são concedidos uma única vez por dia, somente quando a leitura válida
-- de um capítulo é registrada em chapter_reads pelo fluxo server-side existente.

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

-- Reconhece o histórico verificado existente para que usuários atuais não percam
-- a evolução já conquistada. A chave única impede pontos duplicados no mesmo dia.
INSERT INTO public.dragon_sequence_days (user_id, read_on, points_awarded)
SELECT user_id, read_on, 10
FROM public.chapter_reads
GROUP BY user_id, read_on
ON CONFLICT (user_id, read_on) DO NOTHING;

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
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

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
