-- Hall da Fama Eternal: donations are independent from subscriptions and are sandbox-only.
-- No existing donation, profile, plan, wallet or achievements data is modified.

CREATE TABLE public.supporter_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,40}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 60),
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#C9A614',
  icon text NOT NULL DEFAULT 'heart',
  minimum_cents integer NOT NULL UNIQUE CHECK (minimum_cents >= 500),
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.supporter_levels TO authenticated;
GRANT ALL ON public.supporter_levels TO service_role;
ALTER TABLE public.supporter_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supporter levels visible to members"
  ON public.supporter_levels FOR SELECT TO authenticated USING (active);

INSERT INTO public.supporter_levels(slug,name,description,color,icon,minimum_cents,sort)
VALUES
 ('apoiador','Apoiador','O primeiro passo para fortalecer a comunidade Eternal.','#BFA382','heart',500,1),
 ('guardiao','Guardião','Quem ajuda nossas histórias a continuarem.','#72B6D2','shield',5000,2),
 ('lendario','Lendário','Um nome marcado entre os apoiadores Eternal.','#A997F5','star',20000,3),
 ('eterno','Eterno','Reconhecimento máximo do Hall da Fama.','#E4B84C','crown',50000,4)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE public.supporter_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  show_on_hall boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.supporter_preferences TO authenticated;
GRANT ALL ON public.supporter_preferences TO service_role;
ALTER TABLE public.supporter_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members see own donor privacy"
 ON public.supporter_preferences FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "members set own donor privacy"
 ON public.supporter_preferences FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "members update own donor privacy"
 ON public.supporter_preferences FOR UPDATE TO authenticated USING (user_id = (select auth.uid()))
 WITH CHECK (user_id = (select auth.uid()));

CREATE TABLE public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents BETWEEN 500 AND 1000000),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  provider text NOT NULL DEFAULT 'asaas' CHECK (provider = 'asaas'),
  external_id text,
  billing_type text NOT NULL DEFAULT 'PIX' CHECK (billing_type = 'PIX'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','refunded','overdue','failed','canceled')),
  invoice_url text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);
CREATE INDEX donations_user_created_idx ON public.donations (user_id,created_at DESC);
CREATE INDEX donations_confirmed_user_idx ON public.donations (user_id) WHERE status = 'confirmed';
GRANT SELECT ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own donation history" ON public.donations FOR SELECT TO authenticated
 USING (user_id = (select auth.uid()) OR public.has_role((select auth.uid()),'admin'::public.app_role));

-- Only an explicitly opted-in member with a server-confirmed (non-refunded) payment is listed.
-- Totals and identifiers from the payment provider are never returned.
CREATE OR REPLACE FUNCTION public.hall_of_fame(p_limit integer DEFAULT 100)
RETURNS TABLE(
  position bigint, user_id uuid, username text, display_name text,
  avatar_url text, avatar_path text, level_slug text, level_name text,
  level_color text, level_icon text, donation_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH donors AS (
    SELECT d.user_id, count(*)::bigint AS donation_count, sum(d.amount_cents)::bigint AS total
    FROM public.donations d
    JOIN public.supporter_preferences pref ON pref.user_id = d.user_id AND pref.show_on_hall = true
    WHERE d.status = 'confirmed'
    GROUP BY d.user_id
  ),
  leaderboard AS (
    SELECT row_number() OVER (ORDER BY d.total DESC, d.donation_count DESC, p.username) AS position,
      p.id AS user_id, p.username, p.display_name, p.avatar_url, p.avatar_path,
      l.slug AS level_slug, l.name AS level_name, l.color AS level_color,
      l.icon AS level_icon, d.donation_count
    FROM donors d
    JOIN public.profiles p ON p.id = d.user_id
    JOIN LATERAL (
      SELECT s.slug,s.name,s.color,s.icon FROM public.supporter_levels s
      WHERE s.active AND s.minimum_cents <= d.total
      ORDER BY s.minimum_cents DESC LIMIT 1
    ) l ON true
  )
  SELECT position,user_id,username,display_name,avatar_url,avatar_path,
         level_slug,level_name,level_color,level_icon,donation_count
  FROM leaderboard ORDER BY position LIMIT LEAST(GREATEST(p_limit,1),100);
$$;
REVOKE ALL ON FUNCTION public.hall_of_fame(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hall_of_fame(integer) TO authenticated;

COMMENT ON TABLE public.donations IS 'One-time Asaas Sandbox contribution records; only trusted server writes status.';
COMMENT ON FUNCTION public.hall_of_fame(integer) IS 'Private-by-default supporter leaderboard exposing no financial amounts or provider references.';
