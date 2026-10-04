ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS gif_banner_path text,
  ADD COLUMN IF NOT EXISTS gif_banner_equipped boolean NOT NULL DEFAULT false;

-- Campos protegidos: só o servidor (funções SECURITY DEFINER / admin) altera plano, XP, nível e banner GIF.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.plan := 'free'; NEW.xp := 0; NEW.level := 1;
      NEW.gif_banner_path := NULL; NEW.gif_banner_equipped := false;
    ELSE
      NEW.plan := OLD.plan; NEW.xp := OLD.xp; NEW.level := OLD.level;
      NEW.gif_banner_path := OLD.gif_banner_path; NEW.gif_banner_equipped := OLD.gif_banner_equipped;
      NEW.id := OLD.id; NEW.username := OLD.username;
    END IF;
    IF NEW.avatar_path IS NOT NULL AND NEW.avatar_path NOT LIKE NEW.id::text || '/%' THEN
      RAISE EXCEPTION 'invalid avatar path';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_protect BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- Banner GIF: exige plano Eternal ou superior, verificado no banco.
CREATE OR REPLACE FUNCTION public.set_gif_banner(p_path text, p_equipped boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl public.plan_tier;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT plan INTO pl FROM public.profiles WHERE id = auth.uid();
  IF pl IS NULL OR pl = 'free' THEN RAISE EXCEPTION 'plan required'; END IF;
  IF p_path IS NOT NULL AND (p_path NOT LIKE auth.uid()::text || '/%' OR lower(p_path) NOT LIKE '%.gif') THEN
    RAISE EXCEPTION 'invalid path';
  END IF;
  UPDATE public.profiles
    SET gif_banner_path = p_path, gif_banner_equipped = (p_path IS NOT NULL AND p_equipped)
    WHERE id = auth.uid();
END $$;
REVOKE EXECUTE ON FUNCTION public.set_gif_banner(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_gif_banner(text, boolean) TO authenticated;

-- Fotos de perfil: cada usuário só mexe na própria pasta; membros logados podem ver.
CREATE POLICY "avatars read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "avatars insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp'));
CREATE POLICY "avatars update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Banners GIF: envio só para assinantes Eternal / Eternal Sunshine.
CREATE POLICY "banners read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'profile-banners');
CREATE POLICY "banners insert subscriber" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-banners' AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) = 'gif'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.plan <> 'free'));
CREATE POLICY "banners delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-banners' AND (storage.foldername(name))[1] = auth.uid()::text);