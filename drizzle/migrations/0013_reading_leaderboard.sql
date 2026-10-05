
CREATE OR REPLACE FUNCTION public.reading_leaderboard(p_limit integer DEFAULT 50)
RETURNS TABLE(user_id uuid, username text, display_name text, avatar_path text, avatar_url text, level integer, xp integer, chapters_read bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_path, p.avatar_url, p.level, p.xp,
         COUNT(DISTINCT rh.chapter_id) AS chapters_read
    FROM public.reading_history rh
    JOIN public.profiles p ON p.id = rh.user_id
   GROUP BY p.id
   ORDER BY chapters_read DESC, p.xp DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
$$;
GRANT EXECUTE ON FUNCTION public.reading_leaderboard(integer) TO authenticated;
