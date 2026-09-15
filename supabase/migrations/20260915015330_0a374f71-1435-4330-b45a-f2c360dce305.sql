
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','moderator','scan','user');
CREATE TYPE public.manga_status AS ENUM ('ongoing','completed','hiatus','cancelled');
CREATE TYPE public.manga_type AS ENUM ('manhwa','manga','manhua','webtoon');
CREATE TYPE public.plan_tier AS ENUM ('free','eternal','eternal_sunshine');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  plan public.plan_tier NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- SCANS
CREATE TABLE public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  community_url TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scans TO authenticated;
GRANT ALL ON public.scans TO service_role;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scans_select_auth" ON public.scans FOR SELECT TO authenticated USING (approved);

-- GENRES
CREATE TABLE public.genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);
GRANT SELECT ON public.genres TO authenticated;
GRANT ALL ON public.genres TO service_role;
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "genres_select_auth" ON public.genres FOR SELECT TO authenticated USING (true);

-- MANGA
CREATE TABLE public.manga (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  alt_title TEXT,
  synopsis TEXT,
  author TEXT,
  artist TEXT,
  cover_url TEXT,
  banner_url TEXT,
  status public.manga_status NOT NULL DEFAULT 'ongoing',
  type public.manga_type NOT NULL DEFAULT 'manhwa',
  scan_id UUID REFERENCES public.scans(id) ON DELETE SET NULL,
  featured BOOLEAN NOT NULL DEFAULT false,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_manga_updated ON public.manga (updated_at DESC);
CREATE INDEX idx_manga_views ON public.manga (views DESC);
CREATE INDEX idx_manga_title ON public.manga (lower(title));
GRANT SELECT ON public.manga TO authenticated;
GRANT ALL ON public.manga TO service_role;
ALTER TABLE public.manga ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manga_select_auth" ON public.manga FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_manga_updated BEFORE UPDATE ON public.manga FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.manga_genres (
  manga_id UUID NOT NULL REFERENCES public.manga(id) ON DELETE CASCADE,
  genre_id UUID NOT NULL REFERENCES public.genres(id) ON DELETE CASCADE,
  PRIMARY KEY (manga_id, genre_id)
);
GRANT SELECT ON public.manga_genres TO authenticated;
GRANT ALL ON public.manga_genres TO service_role;
ALTER TABLE public.manga_genres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manga_genres_select_auth" ON public.manga_genres FOR SELECT TO authenticated USING (true);

-- CHAPTERS
CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manga_id UUID NOT NULL REFERENCES public.manga(id) ON DELETE CASCADE,
  number NUMERIC(8,2) NOT NULL,
  title TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (manga_id, number)
);
CREATE INDEX idx_chapters_manga ON public.chapters (manga_id, number);
CREATE INDEX idx_chapters_published ON public.chapters (published_at DESC);
GRANT SELECT ON public.chapters TO authenticated;
GRANT ALL ON public.chapters TO service_role;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chapters_select_auth" ON public.chapters FOR SELECT TO authenticated USING (published_at <= now());

CREATE TABLE public.chapter_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  UNIQUE (chapter_id, page_number)
);
GRANT SELECT ON public.chapter_pages TO authenticated;
GRANT ALL ON public.chapter_pages TO service_role;
ALTER TABLE public.chapter_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chapter_pages_select_auth" ON public.chapter_pages FOR SELECT TO authenticated USING (true);

-- FAVORITES
CREATE TABLE public.favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manga_id UUID NOT NULL REFERENCES public.manga(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, manga_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites_own" ON public.favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- READING HISTORY
CREATE TABLE public.reading_history (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manga_id UUID NOT NULL REFERENCES public.manga(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, manga_id)
);
CREATE INDEX idx_history_read_at ON public.reading_history (user_id, read_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reading_history TO authenticated;
GRANT ALL ON public.reading_history TO service_role;
ALTER TABLE public.reading_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history_own" ON public.reading_history FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- INVITE CODES (nunca legíveis pelo frontend)
CREATE TABLE public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.invite_codes TO service_role;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invite_codes_admin" ON public.invite_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invite_codes TO authenticated;

CREATE TABLE public.invite_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_id UUID NOT NULL REFERENCES public.invite_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT ON public.invite_code_uses TO authenticated;
GRANT ALL ON public.invite_code_uses TO service_role;
ALTER TABLE public.invite_code_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invite_uses_select_own" ON public.invite_code_uses FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- SUBSCRIPTIONS (estrutura, sem cobrança)
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.plan_tier NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'inactive',
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- FUNÇÕES DE CONVITE
CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invite_codes
    WHERE upper(code) = upper(trim(p_code))
      AND active
      AND uses < max_uses
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;
GRANT EXECUTE ON FUNCTION public.validate_invite_code(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_invite_code(p_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.invite_code_uses WHERE user_id = auth.uid()) THEN RETURN true; END IF;
  SELECT id INTO v_id FROM public.invite_codes
   WHERE upper(code) = upper(trim(p_code)) AND active AND uses < max_uses
     AND (expires_at IS NULL OR expires_at > now())
   FOR UPDATE;
  IF v_id IS NULL THEN RETURN false; END IF;
  UPDATE public.invite_codes SET uses = uses + 1 WHERE id = v_id;
  INSERT INTO public.invite_code_uses (invite_code_id, user_id) VALUES (v_id, auth.uid());
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(TEXT) TO authenticated;

-- XP
CREATE OR REPLACE FUNCTION public.add_xp(p_amount INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR p_amount IS NULL OR p_amount <= 0 OR p_amount > 50 THEN RETURN; END IF;
  UPDATE public.profiles
     SET xp = xp + p_amount,
         level = GREATEST(1, floor(sqrt((xp + p_amount) / 100.0))::int + 1)
   WHERE id = auth.uid();
END; $$;
GRANT EXECUTE ON FUNCTION public.add_xp(INTEGER) TO authenticated;

-- DADOS DE DEMONSTRAÇÃO
INSERT INTO public.scans (slug, name, description, logo_url, banner_url, community_url, approved) VALUES
 ('lumen-scan','Lumen Scan','Scan fictícia focada em fantasia sombria.','/demo/cover-1.jpg','/demo/hero.jpg','https://discord.gg/exemplo',true),
 ('nova-scan','Nova Scan','Scan fictícia de obras urbanas e cyberpunk.','/demo/cover-4.jpg','/demo/hero.jpg','https://discord.gg/exemplo',true),
 ('aurora-scan','Aurora Scan','Scan fictícia de romance e slice of life.','/demo/cover-5.jpg','/demo/hero.jpg','https://discord.gg/exemplo',true);

INSERT INTO public.genres (slug, name) VALUES
 ('acao','Ação'),('fantasia','Fantasia'),('romance','Romance'),('aventura','Aventura'),
 ('sobrenatural','Sobrenatural'),('cyberpunk','Cyberpunk'),('drama','Drama'),('escolar','Escolar');

INSERT INTO public.manga (slug, title, alt_title, synopsis, author, artist, cover_url, banner_url, status, type, scan_id, featured, views, updated_at) VALUES
 ('monarca-das-sombras','Monarca das Sombras','Shadow Monarch Chronicle','Um caçador de rank mais baixo desperta um poder proibido e passa a comandar um exército de sombras.','Kim Haneul','Park Jiwon','/demo/cover-1.jpg','/demo/hero.jpg','ongoing','manhwa',(SELECT id FROM public.scans WHERE slug='lumen-scan'),true,15230, now()),
 ('lamina-de-neon','Lâmina de Neon','Neon Blade','Numa metrópole futurista, um jovem espadachim caça criaturas que surgem nas madrugadas.','Ryu Sena','Ryu Sena','/demo/cover-2.jpg','/demo/hero.jpg','ongoing','manhwa',(SELECT id FROM public.scans WHERE slug='nova-scan'),true,9800, now() - interval '1 day'),
 ('a-maga-do-vazio','A Maga do Vazio','Void Sorceress','Herdeira de uma magia esquecida, ela precisa reescrever o destino do próprio império.','Ana Lira','Ana Lira','/demo/cover-3.jpg','/demo/hero.jpg','ongoing','manhwa',(SELECT id FROM public.scans WHERE slug='lumen-scan'),false,7400, now() - interval '2 days'),
 ('cacador-de-circuitos','Caçador de Circuitos','Circuit Hunter','Meio humano, meio máquina, ele vende serviços perigosos nos becos da cidade.','Leo Vasque','Mirai Sato','/demo/cover-4.jpg','/demo/hero.jpg','hiatus','manhua',(SELECT id FROM public.scans WHERE slug='nova-scan'),false,5120, now() - interval '3 days'),
 ('sob-as-cerejeiras','Sob as Cerejeiras','Under the Blossoms','Dois estudantes se reencontram anos depois e descobrem uma promessa esquecida.','Yuna Kim','Yuna Kim','/demo/cover-5.jpg','/demo/hero.jpg','completed','webtoon',(SELECT id FROM public.scans WHERE slug='aurora-scan'),false,4300, now() - interval '5 days'),
 ('academia-do-crepusculo','Academia do Crepúsculo','Twilight Academy','Uma academia de magia guarda segredos que nenhum aluno deveria descobrir.','Clara Mendes','Clara Mendes','/demo/cover-6.jpg','/demo/hero.jpg','ongoing','manhwa',(SELECT id FROM public.scans WHERE slug='aurora-scan'),true,6600, now() - interval '6 days');

INSERT INTO public.manga_genres (manga_id, genre_id)
SELECT m.id, g.id FROM public.manga m JOIN public.genres g ON g.slug IN ('acao','fantasia','aventura') WHERE m.slug='monarca-das-sombras';
INSERT INTO public.manga_genres (manga_id, genre_id)
SELECT m.id, g.id FROM public.manga m JOIN public.genres g ON g.slug IN ('acao','cyberpunk','sobrenatural') WHERE m.slug='lamina-de-neon';
INSERT INTO public.manga_genres (manga_id, genre_id)
SELECT m.id, g.id FROM public.manga m JOIN public.genres g ON g.slug IN ('fantasia','drama') WHERE m.slug='a-maga-do-vazio';
INSERT INTO public.manga_genres (manga_id, genre_id)
SELECT m.id, g.id FROM public.manga m JOIN public.genres g ON g.slug IN ('cyberpunk','acao') WHERE m.slug='cacador-de-circuitos';
INSERT INTO public.manga_genres (manga_id, genre_id)
SELECT m.id, g.id FROM public.manga m JOIN public.genres g ON g.slug IN ('romance','escolar','drama') WHERE m.slug='sob-as-cerejeiras';
INSERT INTO public.manga_genres (manga_id, genre_id)
SELECT m.id, g.id FROM public.manga m JOIN public.genres g ON g.slug IN ('fantasia','escolar','sobrenatural') WHERE m.slug='academia-do-crepusculo';

INSERT INTO public.chapters (manga_id, number, title, published_at)
SELECT m.id, n, 'Capítulo ' || n, now() - (n || ' days')::interval
FROM public.manga m CROSS JOIN generate_series(1,5) AS n;

INSERT INTO public.chapter_pages (chapter_id, page_number, image_url)
SELECT c.id, p, '/demo/cover-' || (((p + 1) % 6) + 1) || '.jpg'
FROM public.chapters c CROSS JOIN generate_series(1,6) AS p;

INSERT INTO public.invite_codes (code, max_uses, active) VALUES
 ('ETERNAL2026', 100, true),
 ('SUNSHINE', 50, true);
