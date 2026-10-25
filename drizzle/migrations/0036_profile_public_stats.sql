-- Public profile summary: expose only aggregate counters and the last seven days,
-- not individual chapter history. SECURITY DEFINER intentionally bypasses the
-- private chapter_reads/reading_history policies only for these aggregates.
CREATE OR REPLACE FUNCTION public.profile_public_stats(p_user uuid)
RETURNS TABLE (
  works_read integer,
  chapters_read integer,
  achievements_count integer,
  current_streak integer,
  best_streak integer,
  week_chapters integer,
  weekly_activity jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_start date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user) THEN
    RETURN;
  END IF;

  v_start := v_today - 6;

  RETURN QUERY
  SELECT
    COALESCE((
      SELECT count(DISTINCT rh.manga_id)::integer
      FROM public.reading_history rh
      WHERE rh.user_id = p_user
    ), 0),
    COALESCE((
      SELECT count(DISTINCT cr.chapter_id)::integer
      FROM public.chapter_reads cr
      WHERE cr.user_id = p_user
    ), 0),
    COALESCE((
      SELECT count(*)::integer
      FROM public.user_achievements ua
      WHERE ua.user_id = p_user
    ), 0),
    COALESCE((
      SELECT rs.current_streak FROM public.reading_streak(p_user) rs LIMIT 1
    ), 0),
    COALESCE((
      SELECT rs.best_streak FROM public.reading_streak(p_user) rs LIMIT 1
    ), 0),
    COALESCE((
      SELECT count(DISTINCT cr.chapter_id)::integer
      FROM public.chapter_reads cr
      WHERE cr.user_id = p_user
        AND cr.read_on BETWEEN v_start AND v_today
    ), 0),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', day_value::date,
          'count', COALESCE(day_count.count_value, 0),
          'label', to_char(day_value::date, 'Dy')
        ) ORDER BY day_value
      )
      FROM generate_series(v_start::timestamp, v_today::timestamp, interval '1 day') AS day_value
      LEFT JOIN (
        SELECT cr.read_on, count(DISTINCT cr.chapter_id)::integer AS count_value
        FROM public.chapter_reads cr
        WHERE cr.user_id = p_user AND cr.read_on BETWEEN v_start AND v_today
        GROUP BY cr.read_on
      ) day_count ON day_count.read_on = days.day_value::date
    ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.profile_public_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_public_stats(uuid) TO authenticated;
