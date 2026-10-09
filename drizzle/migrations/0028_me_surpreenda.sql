-- Me Surpreenda: preferências e feedback privados, sem duplicar histórico/favoritos.
CREATE TABLE IF NOT EXISTS public.recommendation_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  genre_slugs text[] NOT NULL DEFAULT '{}',
  reference_manga_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recommendation_preferences_genre_limit CHECK (cardinality(genre_slugs) <= 20),
  CONSTRAINT recommendation_preferences_reference_limit CHECK (cardinality(reference_manga_ids) <= 10)
);
ALTER TABLE public.recommendation_preferences ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendation_preferences TO authenticated;
CREATE POLICY "recommendation_preferences_own_select" ON public.recommendation_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "recommendation_preferences_own_insert" ON public.recommendation_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recommendation_preferences_own_update" ON public.recommendation_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recommendation_preferences_own_delete" ON public.recommendation_preferences
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.recommendation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manga_id uuid NOT NULL REFERENCES public.manga(id) ON DELETE CASCADE,
  feedback text NOT NULL CHECK (feedback IN ('liked', 'dismissed')),
  reason text CHECK (reason IS NULL OR reason IN ('genre', 'story', 'known', 'presentation', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, manga_id)
);
CREATE INDEX IF NOT EXISTS recommendation_feedback_user_recent_idx
  ON public.recommendation_feedback (user_id, created_at DESC);
ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendation_feedback TO authenticated;
CREATE POLICY "recommendation_feedback_own_select" ON public.recommendation_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "recommendation_feedback_own_insert" ON public.recommendation_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recommendation_feedback_own_update" ON public.recommendation_feedback
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recommendation_feedback_own_delete" ON public.recommendation_feedback
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
