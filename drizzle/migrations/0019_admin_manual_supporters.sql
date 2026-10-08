-- 0019: Admin-granted recognition is explicitly NOT a financial donation.
-- Requires 0018. Leaves Asaas, payment events, donations and subscriptions unchanged.
CREATE TABLE public.supporter_manual_grants (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  level_slug text NOT NULL REFERENCES public.supporter_levels(slug),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 240),
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX supporter_manual_grants_active_idx ON public.supporter_manual_grants(level_slug) WHERE revoked_at IS NULL;
ALTER TABLE public.supporter_manual_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supporter_manual_grants FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.supporter_manual_grants TO service_role;

-- Only a real administrator can grant or revoke honorary supporter status.
CREATE FUNCTION public.admin_set_manual_supporter(
  p_user uuid, p_level_slug text, p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_admin uuid := (select auth.uid());
  v_reason text := btrim(p_reason);
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user) THEN
    RAISE EXCEPTION 'user not found';
  END IF;
  IF v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'reason must contain 3 to 240 characters';
  END IF;
  IF p_level_slug IS NULL THEN
    UPDATE public.supporter_manual_grants
    SET revoked_at = now(), reason = v_reason, granted_by = v_admin
    WHERE user_id = p_user AND revoked_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'active recognition not found'; END IF;
    PERFORM public.write_admin_log(
      'supporter_manual_revoked', p_user,
      jsonb_build_object('reason', v_reason, 'source', 'manual')
    );
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.supporter_levels s WHERE s.slug = p_level_slug AND s.active
    ) THEN RAISE EXCEPTION 'invalid supporter level'; END IF;
    INSERT INTO public.supporter_manual_grants
      (user_id, level_slug, reason, granted_by, granted_at, revoked_at)
    VALUES (p_user, p_level_slug, v_reason, v_admin, now(), NULL)
    ON CONFLICT (user_id) DO UPDATE SET
      level_slug = EXCLUDED.level_slug, reason = EXCLUDED.reason,
      granted_by = EXCLUDED.granted_by, granted_at = now(), revoked_at = NULL;
    PERFORM public.write_admin_log(
      'supporter_manual_granted', p_user,
      jsonb_build_object('level', p_level_slug, 'reason', v_reason, 'source', 'manual')
    );
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_manual_supporter(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_manual_supporter(uuid,text,text) TO authenticated;

CREATE FUNCTION public.admin_list_manual_supporters()
RETURNS TABLE(user_id uuid, username text, display_name text, level_slug text,
              level_name text, reason text, granted_at timestamptz, granted_by uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (select auth.uid()) IS NULL OR
     NOT public.has_role((select auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT g.user_id,p.username,p.display_name,g.level_slug,s.name,
         g.reason,g.granted_at,g.granted_by
  FROM public.supporter_manual_grants g
  JOIN public.profiles p ON p.id = g.user_id
  JOIN public.supporter_levels s ON s.slug = g.level_slug
  WHERE g.revoked_at IS NULL
  ORDER BY g.granted_at DESC LIMIT 200;
END $$;
REVOKE ALL ON FUNCTION public.admin_list_manual_supporters() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_manual_supporters() TO authenticated;

-- Output adds a clear source distinction: manual recognition never pretends to be paid.
-- PostgreSQL cannot change an existing RETURNS TABLE signature using CREATE OR REPLACE.
DROP FUNCTION public.hall_of_fame(integer);
CREATE FUNCTION public.hall_of_fame(p_limit integer DEFAULT 100)
RETURNS TABLE(
  rank_position bigint, user_id uuid, username text, display_name text,
  avatar_url text, avatar_path text, level_slug text, level_name text,
  level_color text, level_icon text, donation_count bigint,
  recognition_source text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH paid AS (
    SELECT d.user_id, count(*)::bigint AS donation_count, sum(d.amount_cents)::bigint AS total
    FROM public.donations d WHERE d.status = 'confirmed'
    GROUP BY d.user_id
  ),
  eligible AS (
    SELECT p.id AS user_id,p.username,p.display_name,p.avatar_url,p.avatar_path,
           COALESCE(d.donation_count,0)::bigint AS donation_count,
           COALESCE(d.total,0)::bigint AS total,
           g.level_slug AS manually_granted_slug
    FROM public.profiles p
    JOIN public.supporter_preferences pref ON pref.user_id = p.id AND pref.show_on_hall = true
    LEFT JOIN paid d ON d.user_id = p.id
    LEFT JOIN public.supporter_manual_grants g
      ON g.user_id = p.id AND g.revoked_at IS NULL
    WHERE d.user_id IS NOT NULL OR g.user_id IS NOT NULL
  ),
  results AS (
    SELECT e.*, lvl.slug AS level_slug,lvl.name AS level_name,
           lvl.color AS level_color,lvl.icon AS level_icon,
           lvl.minimum_cents AS level_min,
           CASE WHEN ml.minimum_cents IS NOT NULL
                       AND ml.minimum_cents >= COALESCE(pl.minimum_cents, 0)
                THEN 'manual'::text ELSE 'payment'::text END AS recognition_source
    FROM eligible e
    LEFT JOIN public.supporter_levels ml
      ON ml.slug = e.manually_granted_slug AND ml.active = true
    LEFT JOIN LATERAL (
      SELECT s.minimum_cents FROM public.supporter_levels s
      WHERE s.active AND s.minimum_cents <= e.total
      ORDER BY s.minimum_cents DESC LIMIT 1
    ) pl ON true
    JOIN LATERAL (
      SELECT s.slug,s.name,s.color,s.icon,s.minimum_cents FROM public.supporter_levels s
      WHERE s.active
        AND (s.minimum_cents <= e.total OR s.slug = e.manually_granted_slug)
      ORDER BY s.minimum_cents DESC LIMIT 1
    ) lvl ON true
  ),
  numbered AS (
    SELECT row_number() OVER (
      ORDER BY r.level_min DESC, r.total DESC, r.donation_count DESC, r.username
    ) AS rank_position, r.* FROM results r
  )
  SELECT n.rank_position,n.user_id,n.username,n.display_name,
         n.avatar_url,n.avatar_path,n.level_slug,n.level_name,
         n.level_color,n.level_icon,n.donation_count,n.recognition_source
  FROM numbered n ORDER BY n.rank_position
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),100);
$$;
REVOKE ALL ON FUNCTION public.hall_of_fame(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hall_of_fame(integer) TO authenticated;
COMMENT ON TABLE public.supporter_manual_grants IS
  'Honorary supporter recognition awarded by admins. NOT payment evidence; opt-in required to appear publicly.';
COMMENT ON FUNCTION public.hall_of_fame(integer) IS
  'Opt-in-only Hall with transparent manual/payment source. Does not expose financial amounts.';
