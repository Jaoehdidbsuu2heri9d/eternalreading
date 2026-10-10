-- Global event themes for Eternal Reading. Non-destructive migration.
CREATE TABLE IF NOT EXISTS public.site_event_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  description text NOT NULL DEFAULT '',
  event_type text NOT NULL DEFAULT 'custom' CHECK (event_type IN ('halloween','christmas','easter','new_year','valentines','eternal_birthday','custom')),
  primary_color text NOT NULL DEFAULT '#8b5cf6' CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text NOT NULL DEFAULT '#312e81' CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text NOT NULL DEFAULT '#f59e0b' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_color text NOT NULL DEFAULT '#09070e' CHECK (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  banner_url text,
  decoration text NOT NULL DEFAULT 'none' CHECK (decoration IN ('none','bats','snow','flowers','sparkles','hearts','confetti')),
  effects_intensity integer NOT NULL DEFAULT 1 CHECK (effects_intensity BETWEEN 0 AND 3),
  animations_enabled boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','active','archived')),
  priority integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS site_event_themes_schedule_idx
  ON public.site_event_themes (status, starts_at, ends_at, priority DESC);
ALTER TABLE public.site_event_themes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_event_themes_public_read ON public.site_event_themes;
CREATE POLICY site_event_themes_public_read ON public.site_event_themes
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS site_event_themes_owner_insert ON public.site_event_themes;
CREATE POLICY site_event_themes_owner_insert ON public.site_event_themes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'::public.app_role));
DROP POLICY IF EXISTS site_event_themes_owner_update ON public.site_event_themes;
CREATE POLICY site_event_themes_owner_update ON public.site_event_themes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::public.app_role));
DROP POLICY IF EXISTS site_event_themes_owner_delete ON public.site_event_themes;
CREATE POLICY site_event_themes_owner_delete ON public.site_event_themes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'::public.app_role));
GRANT SELECT ON public.site_event_themes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_event_themes TO authenticated;
