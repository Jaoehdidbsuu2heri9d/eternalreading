-- Eternal Feed: posts, reactions, comments, reports, and secure image uploads.
-- Non-destructive: adds new feed-specific objects and reuses profiles/manga/chapters/notifications/follows.

CREATE TABLE IF NOT EXISTS public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  category text CHECK (category IS NULL OR category IN ('reading','recommendation','opinion','meme','funny','theory','discussion','achievement','general')),
  manga_id uuid REFERENCES public.manga(id) ON DELETE SET NULL,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  image_path text,
  is_spoiler boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feed_posts_content_required CHECK (char_length(btrim(body)) > 0 OR manga_id IS NOT NULL OR image_path IS NOT NULL),
  CONSTRAINT feed_posts_chapter_requires_manga CHECK (chapter_id IS NULL OR manga_id IS NOT NULL),
  CONSTRAINT feed_posts_image_owned_path CHECK (image_path IS NULL OR split_part(image_path, '/', 1) = user_id::text)
);
CREATE INDEX IF NOT EXISTS feed_posts_recent_idx ON public.feed_posts(created_at DESC, id DESC) WHERE hidden = false;
CREATE INDEX IF NOT EXISTS feed_posts_user_idx ON public.feed_posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS feed_posts_category_idx ON public.feed_posts(category, created_at DESC) WHERE hidden = false;

CREATE TABLE IF NOT EXISTS public.feed_reactions (
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('love','laugh','cry','hype','want_to_read','plot_twist')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS feed_reactions_user_idx ON public.feed_reactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.feed_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.feed_comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  is_spoiler boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feed_comments_post_idx ON public.feed_comments(post_id, created_at DESC) WHERE parent_id IS NULL AND hidden = false;
CREATE INDEX IF NOT EXISTS feed_comments_parent_idx ON public.feed_comments(parent_id, created_at ASC);
CREATE INDEX IF NOT EXISTS feed_comments_user_idx ON public.feed_comments(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.feed_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.feed_comments(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((post_id IS NOT NULL)::integer + (comment_id IS NOT NULL)::integer = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS feed_reports_post_unique ON public.feed_reports(post_id, reporter_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS feed_reports_comment_unique ON public.feed_reports(comment_id, reporter_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS feed_reports_queue_idx ON public.feed_reports(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.feed_reports TO authenticated;
GRANT ALL ON public.feed_posts, public.feed_reactions, public.feed_comments, public.feed_reports TO service_role;

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feed_posts_read ON public.feed_posts;
CREATE POLICY feed_posts_read ON public.feed_posts FOR SELECT TO authenticated
  USING (NOT hidden OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'owner'::public.app_role));
DROP POLICY IF EXISTS feed_posts_insert_own ON public.feed_posts;
CREATE POLICY feed_posts_insert_own ON public.feed_posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT hidden);
DROP POLICY IF EXISTS feed_posts_update_own ON public.feed_posts;
CREATE POLICY feed_posts_update_own ON public.feed_posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND NOT hidden)
  WITH CHECK (user_id = auth.uid() AND NOT hidden);
DROP POLICY IF EXISTS feed_posts_update_moderators ON public.feed_posts;
CREATE POLICY feed_posts_update_moderators ON public.feed_posts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role));
DROP POLICY IF EXISTS feed_posts_delete_own ON public.feed_posts;
CREATE POLICY feed_posts_delete_own ON public.feed_posts FOR DELETE TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS feed_posts_delete_moderators ON public.feed_posts;
CREATE POLICY feed_posts_delete_moderators ON public.feed_posts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role));

DROP POLICY IF EXISTS feed_reactions_read ON public.feed_reactions;
CREATE POLICY feed_reactions_read ON public.feed_reactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS feed_reactions_insert_own ON public.feed_reactions;
CREATE POLICY feed_reactions_insert_own ON public.feed_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = post_id AND NOT p.hidden));
DROP POLICY IF EXISTS feed_reactions_update_own ON public.feed_reactions;
CREATE POLICY feed_reactions_update_own ON public.feed_reactions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS feed_reactions_delete_own ON public.feed_reactions;
CREATE POLICY feed_reactions_delete_own ON public.feed_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS feed_comments_read ON public.feed_comments;
CREATE POLICY feed_comments_read ON public.feed_comments FOR SELECT TO authenticated
  USING ((NOT hidden AND EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = post_id AND NOT p.hidden))
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'owner'::public.app_role));
DROP POLICY IF EXISTS feed_comments_insert_own ON public.feed_comments;
CREATE POLICY feed_comments_insert_own ON public.feed_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT hidden AND EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = post_id AND NOT p.hidden));
DROP POLICY IF EXISTS feed_comments_update_own ON public.feed_comments;
CREATE POLICY feed_comments_update_own ON public.feed_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND NOT hidden)
  WITH CHECK (user_id = auth.uid() AND NOT hidden);
DROP POLICY IF EXISTS feed_comments_update_moderators ON public.feed_comments;
CREATE POLICY feed_comments_update_moderators ON public.feed_comments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role));
DROP POLICY IF EXISTS feed_comments_delete_own ON public.feed_comments;
CREATE POLICY feed_comments_delete_own ON public.feed_comments FOR DELETE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS feed_comments_delete_moderators ON public.feed_comments;
CREATE POLICY feed_comments_delete_moderators ON public.feed_comments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role));

DROP POLICY IF EXISTS feed_reports_insert_own ON public.feed_reports;
CREATE POLICY feed_reports_insert_own ON public.feed_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS feed_reports_read_own ON public.feed_reports;
CREATE POLICY feed_reports_read_own ON public.feed_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'owner'::public.app_role));
DROP POLICY IF EXISTS feed_reports_update_moderators ON public.feed_reports;
CREATE POLICY feed_reports_update_moderators ON public.feed_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role));

-- PostgreSQL-side spam controls and thread integrity. Replies are one level deep, as in the UI.
CREATE OR REPLACE FUNCTION public.guard_feed_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM public.feed_posts WHERE user_id = NEW.user_id AND created_at > now() - interval '1 hour') >= 10 THEN
      RAISE EXCEPTION 'rate_limited';
    END IF;
    IF char_length(btrim(NEW.body)) > 0 AND EXISTS (
      SELECT 1 FROM public.feed_posts
      WHERE user_id = NEW.user_id AND body = NEW.body AND created_at > now() - interval '1 minute'
    ) THEN
      RAISE EXCEPTION 'duplicate';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.user_id := OLD.user_id;
    NEW.created_at := OLD.created_at;
  ELSE
    NEW.created_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS feed_posts_guard ON public.feed_posts;
CREATE TRIGGER feed_posts_guard BEFORE INSERT OR UPDATE ON public.feed_posts FOR EACH ROW EXECUTE FUNCTION public.guard_feed_post();

CREATE OR REPLACE FUNCTION public.guard_feed_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE parent_post uuid;
DECLARE parent_parent uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM public.feed_comments WHERE user_id = NEW.user_id AND created_at > now() - interval '1 hour') >= 30 THEN
      RAISE EXCEPTION 'rate_limited';
    END IF;
    IF EXISTS (SELECT 1 FROM public.feed_comments WHERE user_id = NEW.user_id AND post_id = NEW.post_id AND body = NEW.body AND created_at > now() - interval '1 minute') THEN
      RAISE EXCEPTION 'duplicate';
    END IF;
  END IF;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT post_id, parent_id INTO parent_post, parent_parent FROM public.feed_comments WHERE id = NEW.parent_id;
    IF parent_post IS DISTINCT FROM NEW.post_id OR parent_parent IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_comment_parent';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.user_id := OLD.user_id;
    NEW.post_id := OLD.post_id;
    NEW.parent_id := OLD.parent_id;
    NEW.created_at := OLD.created_at;
    NEW.edited_at := now();
  ELSE
    NEW.created_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS feed_comments_guard ON public.feed_comments;
CREATE TRIGGER feed_comments_guard BEFORE INSERT OR UPDATE ON public.feed_comments FOR EACH ROW EXECUTE FUNCTION public.guard_feed_comment();

CREATE OR REPLACE FUNCTION public.notify_feed_reaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE post_author uuid;
DECLARE reactor_name text;
BEGIN
  SELECT user_id INTO post_author FROM public.feed_posts WHERE id = NEW.post_id;
  IF post_author IS NOT NULL AND post_author <> NEW.user_id THEN
    SELECT COALESCE(display_name, username) INTO reactor_name FROM public.profiles WHERE id = NEW.user_id;
    INSERT INTO public.notifications(user_id, title, body, link)
    VALUES (post_author, 'Nova reação no Eternal Feed', COALESCE(reactor_name, 'Alguém') || ' reagiu à sua publicação.', '/feed');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS feed_reaction_notification ON public.feed_reactions;
CREATE TRIGGER feed_reaction_notification AFTER INSERT ON public.feed_reactions FOR EACH ROW EXECUTE FUNCTION public.notify_feed_reaction();

CREATE OR REPLACE FUNCTION public.notify_feed_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE post_author uuid;
DECLARE parent_author uuid;
DECLARE commenter_name text;
BEGIN
  SELECT user_id INTO post_author FROM public.feed_posts WHERE id = NEW.post_id;
  SELECT COALESCE(display_name, username) INTO commenter_name FROM public.profiles WHERE id = NEW.user_id;
  IF post_author IS NOT NULL AND post_author <> NEW.user_id THEN
    INSERT INTO public.notifications(user_id, title, body, link)
    VALUES (post_author, 'Novo comentário no Eternal Feed', COALESCE(commenter_name, 'Alguém') || ' comentou na sua publicação.', '/feed');
  END IF;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_author FROM public.feed_comments WHERE id = NEW.parent_id;
    IF parent_author IS NOT NULL AND parent_author <> NEW.user_id AND parent_author IS DISTINCT FROM post_author THEN
      INSERT INTO public.notifications(user_id, title, body, link)
      VALUES (parent_author, 'Responderam seu comentário no Feed', COALESCE(commenter_name, 'Alguém') || ' respondeu ao seu comentário.', '/feed');
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS feed_comment_notification ON public.feed_comments;
CREATE TRIGGER feed_comment_notification AFTER INSERT ON public.feed_comments FOR EACH ROW EXECUTE FUNCTION public.notify_feed_comment();

CREATE OR REPLACE FUNCTION public.guard_feed_reaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id <> OLD.user_id OR NEW.post_id <> OLD.post_id THEN
      RAISE EXCEPTION 'immutable_feed_reaction';
    END IF;
    NEW.created_at := OLD.created_at;
  ELSE
    NEW.created_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS feed_reactions_guard ON public.feed_reactions;
CREATE TRIGGER feed_reactions_guard BEFORE INSERT OR UPDATE ON public.feed_reactions FOR EACH ROW EXECUTE FUNCTION public.guard_feed_reaction();

-- Popular means engagement in the last seven days, not lifetime popularity.
CREATE OR REPLACE VIEW public.feed_post_stats WITH (security_invoker = true) AS
SELECT p.id AS post_id,
       COUNT(DISTINCT r.user_id)::integer AS reaction_count,
       COUNT(DISTINCT c.id)::integer AS comment_count,
       p.category,
       p.manga_id,
       p.created_at
FROM public.feed_posts p
LEFT JOIN public.feed_reactions r ON r.post_id = p.id
LEFT JOIN public.feed_comments c ON c.post_id = p.id AND NOT c.hidden
WHERE NOT p.hidden AND p.created_at >= now() - interval '7 days'
GROUP BY p.id, p.category, p.manga_id, p.created_at;
GRANT SELECT ON public.feed_post_stats TO authenticated;

-- Private bucket, strict image MIME allow-list, 5 MB per upload.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feed-media', 'feed-media', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS feed_media_read ON storage.objects;
CREATE POLICY feed_media_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feed-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.image_path = name AND (NOT p.hidden OR p.user_id = auth.uid()))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'owner'::public.app_role)
  ));
DROP POLICY IF EXISTS feed_media_insert_own ON storage.objects;
CREATE POLICY feed_media_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feed-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS feed_media_delete_own ON storage.objects;
CREATE POLICY feed_media_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feed-media' AND ((storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'owner'::public.app_role)));

NOTIFY pgrst, 'reload schema';
