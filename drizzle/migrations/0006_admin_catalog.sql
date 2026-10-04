ALTER TABLE public.manga
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS year integer,
  ADD COLUMN IF NOT EXISTS age_rating text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS volume text,
  ADD COLUMN IF NOT EXISTS scan_id uuid REFERENCES public.scans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.chapters ADD CONSTRAINT chapters_status_chk CHECK (status IN ('draft','published'));

-- Número único só entre capítulos não excluídos
ALTER TABLE public.chapters DROP CONSTRAINT IF EXISTS chapters_manga_id_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS chapters_manga_number_live ON public.chapters(manga_id, number) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manga, public.chapters, public.chapter_pages, public.manga_genres, public.genres TO authenticated;
GRANT ALL ON public.manga, public.chapters, public.chapter_pages, public.manga_genres, public.genres TO service_role;

DROP POLICY IF EXISTS manga_select_auth ON public.manga;
CREATE POLICY manga_select_auth ON public.manga FOR SELECT TO authenticated
  USING ((published AND deleted_at IS NULL) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY manga_admin_write ON public.manga FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS chapters_select_auth ON public.chapters;
CREATE POLICY chapters_select_auth ON public.chapters FOR SELECT TO authenticated
  USING ((status = 'published' AND published_at <= now() AND deleted_at IS NULL) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY chapters_admin_write ON public.chapters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS chapter_pages_select_auth ON public.chapter_pages;
CREATE POLICY chapter_pages_select_auth ON public.chapter_pages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chapters c WHERE c.id = chapter_id));
CREATE POLICY chapter_pages_admin_write ON public.chapter_pages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY manga_genres_admin_write ON public.manga_genres FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY genres_admin_write ON public.genres FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Substitui as páginas de um capítulo na ordem exata recebida
CREATE OR REPLACE FUNCTION public.admin_set_chapter_pages(p_chapter uuid, p_urls text[])
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM chapter_pages WHERE chapter_id = p_chapter;
  INSERT INTO chapter_pages(chapter_id, page_number, image_url)
    SELECT p_chapter, i, p_urls[i] FROM generate_subscripts(p_urls, 1) i;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_chapter_pages(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_chapter_pages(uuid, text[]) TO authenticated;

-- Registro no histórico administrativo
CREATE OR REPLACE FUNCTION public.log_catalog_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE act text; info jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_TABLE_NAME = 'manga' THEN
    info := jsonb_build_object('work', COALESCE(NEW.title, OLD.title));
    act := CASE WHEN TG_OP = 'INSERT' THEN 'work_created'
      WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'work_deleted'
      ELSE 'work_updated' END;
  ELSE
    info := jsonb_build_object('chapter', COALESCE(NEW.number, OLD.number),
      'work', (SELECT title FROM manga WHERE id = COALESCE(NEW.manga_id, OLD.manga_id)));
    act := CASE WHEN TG_OP = 'INSERT' THEN 'chapter_created'
      WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'chapter_deleted'
      WHEN NEW.status = 'published' AND OLD.status = 'draft' THEN 'chapter_published'
      ELSE 'chapter_updated' END;
  END IF;
  PERFORM public.write_admin_log(act, NULL, info);
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER manga_log AFTER INSERT OR UPDATE ON public.manga FOR EACH ROW EXECUTE FUNCTION public.log_catalog_change();
CREATE TRIGGER chapters_log AFTER INSERT OR UPDATE ON public.chapters FOR EACH ROW EXECUTE FUNCTION public.log_catalog_change();

-- Arquivos de obras: só a equipe envia/altera
CREATE POLICY "manga media admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'manga-media' AND public.has_role(auth.uid(), 'admin')
    AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp'));
CREATE POLICY "manga media admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'manga-media' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "manga media admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'manga-media' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "manga media admin read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'manga-media' AND public.has_role(auth.uid(), 'admin'));