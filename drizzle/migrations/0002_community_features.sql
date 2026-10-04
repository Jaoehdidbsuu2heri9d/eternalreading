-- Dono do site: ganha papel de admin automaticamente ao criar o perfil.
CREATE OR REPLACE FUNCTION public.grant_owner_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id AND lower(email) = 'joaomacal100@gmail.com') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.grant_owner_admin() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_grant_owner AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_owner_admin();

-- Conquistas
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'trophy',
  metric text NOT NULL CHECK (metric IN ('chapters_read','favorites','level','works_started')),
  goal int NOT NULL CHECK (goal > 0),
  xp_reward int NOT NULL DEFAULT 20
);
GRANT SELECT ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements read" ON public.achievements FOR SELECT TO authenticated USING (true);
CREATE POLICY "achievements admin" ON public.achievements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.user_achievements (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_achievements read" ON public.user_achievements FOR SELECT TO authenticated USING (true);

-- Itens de personalização
CREATE TABLE public.cosmetics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('banner','frame','badge','title','background','effect','theme')),
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  preview text NOT NULL,
  required_level int NOT NULL DEFAULT 1,
  required_plan public.plan_tier NOT NULL DEFAULT 'free',
  active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.cosmetics TO authenticated;
GRANT ALL ON public.cosmetics TO service_role;
ALTER TABLE public.cosmetics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cosmetics read" ON public.cosmetics FOR SELECT TO authenticated USING (active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "cosmetics admin" ON public.cosmetics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.user_cosmetics (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cosmetic_id uuid NOT NULL REFERENCES public.cosmetics(id) ON DELETE CASCADE,
  equipped boolean NOT NULL DEFAULT false,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cosmetic_id)
);
GRANT SELECT ON public.user_cosmetics TO authenticated;
GRANT ALL ON public.user_cosmetics TO service_role;
ALTER TABLE public.user_cosmetics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_cosmetics read" ON public.user_cosmetics FOR SELECT TO authenticated USING (true);

-- Equipar item: confere nível e plano no servidor; um item equipado por tipo.
CREATE OR REPLACE FUNCTION public.equip_cosmetic(p_cosmetic uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.cosmetics; pr public.profiles; rank_user int; rank_req int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO c FROM public.cosmetics WHERE id = p_cosmetic AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found'; END IF;
  SELECT * INTO pr FROM public.profiles WHERE id = auth.uid();
  rank_user := array_position(ARRAY['free','eternal','eternal_sunshine'], pr.plan::text);
  rank_req := array_position(ARRAY['free','eternal','eternal_sunshine'], c.required_plan::text);
  IF pr.level < c.required_level OR rank_user < rank_req THEN RAISE EXCEPTION 'locked'; END IF;
  UPDATE public.user_cosmetics uc SET equipped = false FROM public.cosmetics k
    WHERE uc.cosmetic_id = k.id AND uc.user_id = auth.uid() AND k.kind = c.kind;
  INSERT INTO public.user_cosmetics(user_id, cosmetic_id, equipped) VALUES (auth.uid(), c.id, true)
    ON CONFLICT (user_id, cosmetic_id) DO UPDATE SET equipped = true;
END $$;
REVOKE EXECUTE ON FUNCTION public.equip_cosmetic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equip_cosmetic(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unequip_cosmetic(p_cosmetic uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.user_cosmetics SET equipped = false WHERE user_id = auth.uid() AND cosmetic_id = p_cosmetic;
$$;
REVOKE EXECUTE ON FUNCTION public.unequip_cosmetic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unequip_cosmetic(uuid) TO authenticated;

-- Planos (sem cobrança real)
CREATE TABLE public.subscription_plans (
  id public.plan_tier PRIMARY KEY,
  name text NOT NULL,
  tagline text NOT NULL,
  price_label text NOT NULL,
  perks text[] NOT NULL DEFAULT '{}',
  sort int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans read" ON public.subscription_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "plans admin" ON public.subscription_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Notificações
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications own read" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications own update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications own delete" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

-- Verifica conquistas do usuário logado, desbloqueia as atingidas e avisa.
CREATE OR REPLACE FUNCTION public.check_achievements()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; v int; n int := 0; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN 0; END IF;
  FOR a IN SELECT * FROM public.achievements x
    WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements u WHERE u.user_id = uid AND u.achievement_id = x.id)
  LOOP
    v := CASE a.metric
      WHEN 'chapters_read' THEN (SELECT count(*) FROM public.reading_history WHERE user_id = uid)
      WHEN 'works_started' THEN (SELECT count(DISTINCT manga_id) FROM public.reading_history WHERE user_id = uid)
      WHEN 'favorites' THEN (SELECT count(*) FROM public.favorites WHERE user_id = uid)
      WHEN 'level' THEN (SELECT level FROM public.profiles WHERE id = uid)
    END;
    IF COALESCE(v,0) >= a.goal THEN
      INSERT INTO public.user_achievements(user_id, achievement_id) VALUES (uid, a.id) ON CONFLICT DO NOTHING;
      UPDATE public.profiles SET xp = xp + a.xp_reward, level = floor(sqrt((xp + a.xp_reward)/100.0))::int + 1 WHERE id = uid;
      INSERT INTO public.notifications(user_id, title, body, link)
        VALUES (uid, 'Conquista desbloqueada: ' || a.name, a.description || ' (+' || a.xp_reward || ' XP)', '/conquistas');
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.check_achievements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_achievements() TO authenticated;

-- Dados de demonstração
INSERT INTO public.achievements(slug,name,description,icon,metric,goal,xp_reward) VALUES
('primeira-leitura','Primeira página','Leia seu primeiro capítulo.','book-open','chapters_read',1,10),
('leitor-assiduo','Leitor assíduo','Comece 3 obras diferentes.','library','works_started',3,25),
('explorador','Explorador','Comece 6 obras diferentes.','compass','works_started',6,50),
('coracao','Coração aberto','Favorite sua primeira obra.','heart','favorites',1,10),
('colecionador','Colecionador','Tenha 5 obras favoritas.','gem','favorites',5,30),
('nivel-2','Despertar','Alcance o nível 2.','sparkles','level',2,15),
('nivel-3','Ascensão','Alcance o nível 3.','flame','level',3,25),
('nivel-5','Veterano','Alcance o nível 5.','shield','level',5,50),
('nivel-10','Lenda','Alcance o nível 10.','crown','level',10,100),
('maratona','Maratonista','Tenha 6 obras no histórico.','zap','chapters_read',6,40);

INSERT INTO public.cosmetics(slug,name,description,kind,rarity,preview,required_level,required_plan) VALUES
('banner-nebula','Nebulosa','Banner em tons de roxo e azul.','banner','common','linear-gradient(135deg,#3b1d6e,#1e3a8a)',1,'free'),
('banner-aurora','Aurora','Banner com brilho de aurora.','banner','rare','linear-gradient(135deg,#7c3aed,#06b6d4)',3,'free'),
('banner-sunshine','Sol Eterno','Banner dourado exclusivo.','banner','legendary','linear-gradient(135deg,#f59e0b,#ec4899,#8b5cf6)',1,'eternal_sunshine'),
('frame-violeta','Moldura Violeta','Moldura roxa simples.','frame','common','#8b5cf6',1,'free'),
('frame-cristal','Moldura de Cristal','Moldura azul luminosa.','frame','epic','#38bdf8',5,'free'),
('frame-eternal','Moldura Eternal','Moldura dos apoiadores.','frame','legendary','#f0abfc',1,'eternal'),
('title-leitor','Leitor da Noite','Título exibido no perfil.','title','common','Leitor da Noite',2,'free'),
('title-guardiao','Guardião Eterno','Título para apoiadores.','title','epic','Guardião Eterno',1,'eternal'),
('badge-fundador','Fundador','Selo dos primeiros membros.','badge','rare','Fundador',1,'free'),
('theme-meianoite','Meia-noite','Fundo escuro com estrelas.','background','rare','radial-gradient(circle at 30% 20%,#312e81,#0a0a0f)',4,'free');

INSERT INTO public.subscription_plans(id,name,tagline,price_label,perks,sort) VALUES
('free','Membro','Acesso completo à leitura.','Grátis',ARRAY['Leitura sem anúncios','Favoritos e histórico','Conquistas e XP'],0),
('eternal','Eternal','Apoie a comunidade.','Em breve',ARRAY['Tudo do Membro','Moldura e título exclusivos','Selo Eternal no perfil'],1),
('eternal_sunshine','Eternal Sunshine','A experiência máxima.','Em breve',ARRAY['Tudo do Eternal','Banner Sol Eterno lendário','Destaque nos comentários futuros'],2);