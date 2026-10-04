-- ===== SEGUIR =====
CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_not_self CHECK (follower_id <> following_id)
);
CREATE INDEX follows_following_idx ON public.follows(following_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY follows_read ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY follows_insert_own ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY follows_delete_own ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

CREATE OR REPLACE FUNCTION public.on_follow_insert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uname text;
BEGIN
  IF (SELECT count(*) FROM follows WHERE follower_id = NEW.follower_id AND created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  SELECT username INTO uname FROM profiles WHERE id = NEW.follower_id;
  INSERT INTO notifications(user_id, title, body, link)
    VALUES (NEW.following_id, 'Novo seguidor', '@' || COALESCE(uname,'alguém') || ' começou a seguir você.', '/perfil/' || COALESCE(uname,''));
  RETURN NEW;
END $$;
CREATE TRIGGER follows_after_insert BEFORE INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.on_follow_insert();

-- ===== ATIVIDADES (criadas só pelo banco) =====
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  manga_id uuid REFERENCES public.manga(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activities_user_idx ON public.activities(user_id, created_at DESC);
GRANT SELECT ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY activities_read ON public.activities FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = user_id));

CREATE OR REPLACE FUNCTION public.act_reading()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activities(user_id, kind, manga_id) VALUES (NEW.user_id, 'work_started', NEW.manga_id);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.chapter_id IS DISTINCT FROM OLD.chapter_id THEN
    INSERT INTO activities(user_id, kind, manga_id, chapter_id, data)
      VALUES (NEW.user_id, 'chapter_read', NEW.manga_id, NEW.chapter_id,
        jsonb_build_object('number', (SELECT number FROM chapters WHERE id = NEW.chapter_id)));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reading_activity AFTER INSERT OR UPDATE ON public.reading_history FOR EACH ROW EXECUTE FUNCTION public.act_reading();

CREATE OR REPLACE FUNCTION public.act_favorite()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
  INSERT INTO activities(user_id, kind, manga_id) VALUES (NEW.user_id, 'favorited', NEW.manga_id);
  RETURN NEW; END $$;
CREATE TRIGGER favorite_activity AFTER INSERT ON public.favorites FOR EACH ROW EXECUTE FUNCTION public.act_favorite();

CREATE OR REPLACE FUNCTION public.act_achievement()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
  INSERT INTO activities(user_id, kind, data) VALUES (NEW.user_id, 'achievement',
    jsonb_build_object('name', (SELECT name FROM achievements WHERE id = NEW.achievement_id)));
  RETURN NEW; END $$;
CREATE TRIGGER achievement_activity AFTER INSERT ON public.user_achievements FOR EACH ROW EXECUTE FUNCTION public.act_achievement();

CREATE OR REPLACE FUNCTION public.act_cosmetic()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
  INSERT INTO activities(user_id, kind, data) VALUES (NEW.user_id, 'cosmetic',
    jsonb_build_object('name', (SELECT name FROM cosmetics WHERE id = NEW.cosmetic_id)));
  RETURN NEW; END $$;
CREATE TRIGGER cosmetic_activity AFTER INSERT ON public.user_cosmetics FOR EACH ROW EXECUTE FUNCTION public.act_cosmetic();

CREATE OR REPLACE FUNCTION public.act_level()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
  IF NEW.level > OLD.level THEN
    INSERT INTO activities(user_id, kind, data) VALUES (NEW.id, 'level_up', jsonb_build_object('level', NEW.level));
  END IF;
  RETURN NEW; END $$;
CREATE TRIGGER level_activity AFTER UPDATE OF level ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.act_level();

-- ===== COMENTÁRIOS =====
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manga_id uuid NOT NULL REFERENCES public.manga(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  is_spoiler boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_manga_idx ON public.comments(manga_id, chapter_id, created_at DESC) WHERE parent_id IS NULL;
CREATE INDEX comments_parent_idx ON public.comments(parent_id, created_at);
CREATE INDEX comments_user_idx ON public.comments(user_id, created_at DESC);

CREATE TABLE public.comment_likes (
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
CREATE TABLE public.comment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, reporter_id)
);
CREATE INDEX comment_reports_status_idx ON public.comment_reports(status, created_at DESC);
CREATE TABLE public.comment_bans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.comment_likes TO authenticated;
GRANT SELECT, INSERT ON public.comment_reports TO authenticated;
GRANT SELECT ON public.comment_bans TO authenticated;
GRANT ALL ON public.comments, public.comment_likes, public.comment_reports, public.comment_bans TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY comments_read ON public.comments FOR SELECT TO authenticated
  USING (NOT hidden OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY comments_insert_own ON public.comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT hidden);
CREATE POLICY comments_update_own ON public.comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY comments_delete_own ON public.comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY likes_read ON public.comment_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY likes_insert_own ON public.comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY likes_delete_own ON public.comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY reports_read ON public.comment_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY reports_insert_own ON public.comment_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND status = 'pending');

CREATE POLICY bans_read ON public.comment_bans FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Validação: bloqueio, limite de frequência, duplicados e campos protegidos
CREATE OR REPLACE FUNCTION public.comments_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE is_admin boolean := public.has_role(auth.uid(), 'admin');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN RETURN NEW; END IF;
    IF EXISTS (SELECT 1 FROM comment_bans WHERE user_id = NEW.user_id) THEN RAISE EXCEPTION 'comment_banned'; END IF;
    IF (SELECT count(*) FROM comments WHERE user_id = NEW.user_id AND created_at > now() - interval '1 minute') >= 5 THEN
      RAISE EXCEPTION 'rate_limited';
    END IF;
    IF EXISTS (SELECT 1 FROM comments WHERE user_id = NEW.user_id AND body = NEW.body AND created_at > now() - interval '10 minutes') THEN
      RAISE EXCEPTION 'duplicate';
    END IF;
    IF NEW.parent_id IS NOT NULL THEN
      SELECT manga_id, chapter_id INTO NEW.manga_id, NEW.chapter_id FROM comments WHERE id = NEW.parent_id AND parent_id IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'invalid parent'; END IF;
    END IF;
    NEW.hidden := false; NEW.edited_at := NULL; NEW.created_at := now();
  ELSE
    NEW.user_id := OLD.user_id; NEW.manga_id := OLD.manga_id; NEW.chapter_id := OLD.chapter_id;
    NEW.parent_id := OLD.parent_id; NEW.created_at := OLD.created_at;
    IF auth.uid() IS DISTINCT FROM OLD.user_id THEN
      -- equipe só modera (ocultar), não reescreve o texto de outros
      NEW.body := OLD.body; NEW.is_spoiler := OLD.is_spoiler; NEW.edited_at := OLD.edited_at;
    ELSE
      IF NOT is_admin THEN NEW.hidden := OLD.hidden; END IF;
      IF NEW.body IS DISTINCT FROM OLD.body OR NEW.is_spoiler IS DISTINCT FROM OLD.is_spoiler THEN NEW.edited_at := now(); END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER comments_guard BEFORE INSERT OR UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.comments_guard();

-- Notifica o autor do comentário original quando alguém responde
CREATE OR REPLACE FUNCTION public.comments_notify_reply()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE owner uuid; uname text; slug text;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO owner FROM comments WHERE id = NEW.parent_id;
  IF owner IS NULL OR owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT username INTO uname FROM profiles WHERE id = NEW.user_id;
  SELECT m.slug INTO slug FROM manga m WHERE m.id = NEW.manga_id;
  INSERT INTO notifications(user_id, title, body, link)
    VALUES (owner, 'Nova resposta', '@' || COALESCE(uname,'alguém') || ' respondeu ao seu comentário.', '/obra/' || COALESCE(slug,''));
  RETURN NEW;
END $$;
CREATE TRIGGER comments_reply_notify AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.comments_notify_reply();

CREATE OR REPLACE FUNCTION public.reports_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
  IF (SELECT count(*) FROM comment_reports WHERE reporter_id = NEW.reporter_id AND created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  RETURN NEW; END $$;
CREATE TRIGGER reports_guard BEFORE INSERT ON public.comment_reports FOR EACH ROW EXECUTE FUNCTION public.reports_guard();

CREATE OR REPLACE FUNCTION public.likes_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
  IF (SELECT count(*) FROM comment_likes WHERE user_id = NEW.user_id AND created_at > now() - interval '1 minute') >= 30 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  RETURN NEW; END $$;
CREATE TRIGGER likes_guard BEFORE INSERT ON public.comment_likes FOR EACH ROW EXECUTE FUNCTION public.likes_guard();

-- ===== MODERAÇÃO (só equipe) =====
CREATE OR REPLACE FUNCTION public.admin_moderate_comment(p_comment uuid, p_action text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE c comments;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO c FROM comments WHERE id = p_comment;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF p_action = 'hide' THEN UPDATE comments SET hidden = true WHERE id = p_comment;
  ELSIF p_action = 'unhide' THEN UPDATE comments SET hidden = false WHERE id = p_comment;
  ELSIF p_action = 'delete' THEN DELETE FROM comments WHERE id = p_comment;
  ELSIF p_action = 'dismiss' THEN NULL;
  ELSE RAISE EXCEPTION 'invalid action'; END IF;
  IF p_action <> 'delete' THEN
    UPDATE comment_reports SET status = CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'resolved' END
      WHERE comment_id = p_comment AND status = 'pending';
  END IF;
  PERFORM public.write_admin_log('comment_' || p_action, c.user_id, jsonb_build_object('excerpt', left(c.body, 80)));
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_comment_ban(p_user uuid, p_banned boolean, p_reason text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_banned AND public.has_role(p_user, 'owner') THEN RAISE EXCEPTION 'cannot ban owner'; END IF;
  IF p_banned THEN
    INSERT INTO comment_bans(user_id, reason, created_by) VALUES (p_user, left(p_reason, 300), auth.uid())
      ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason;
  ELSE
    DELETE FROM comment_bans WHERE user_id = p_user;
  END IF;
  PERFORM public.write_admin_log(CASE WHEN p_banned THEN 'comment_ban' ELSE 'comment_unban' END, p_user, '{}'::jsonb);
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_moderate_comment(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_comment_ban(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_comment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_comment_ban(uuid, boolean, text) TO authenticated;