-- Conquistas v3: adições compatíveis, idempotentes e restritas ao backend.
-- Não limpa/converte user_achievements, achievement_rewards, XP nem Coins existentes.

-- Retira o endpoint que aceitava quantidade de XP enviada pelo navegador.
REVOKE ALL ON FUNCTION public.add_xp(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_xp(integer) TO service_role;

-- Abrir um capítulo gera uma sessão no servidor: o navegador não controla horário nem XP.
CREATE TABLE IF NOT EXISTS public.chapter_read_sessions (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
 started_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,chapter_id)
);
ALTER TABLE public.chapter_read_sessions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.chapter_read_sessions TO service_role;
CREATE OR REPLACE FUNCTION public.record_chapter_open(p_chapter uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
 IF NOT EXISTS (SELECT 1 FROM chapters c JOIN manga m ON m.id = c.manga_id
 WHERE c.id = p_chapter AND c.status = 'published' AND c.deleted_at IS NULL
 AND m.published AND m.deleted_at IS NULL
 AND EXISTS (SELECT 1 FROM chapter_pages pg WHERE pg.chapter_id = c.id)) THEN RETURN false; END IF;
 INSERT INTO chapter_read_sessions(user_id, chapter_id) VALUES (uid,p_chapter) ON CONFLICT DO NOTHING;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.record_chapter_open(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_chapter_open(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_chapter_read(p_chapter uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m uuid; n integer; v_xp integer; h integer;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
 SELECT c.manga_id INTO m FROM chapters c JOIN manga g ON g.id = c.manga_id
 WHERE c.id = p_chapter AND c.deleted_at IS NULL AND c.status = 'published' AND g.published AND g.deleted_at IS NULL
 AND EXISTS (SELECT 1 FROM chapter_pages pg WHERE pg.chapter_id = c.id);
 IF m IS NULL THEN RETURN false; END IF;
 -- Tempo mínimo comprovado pelo banco. Impede executar a RPC imediatamente para farmar XP.
 IF NOT EXISTS (SELECT 1 FROM chapter_read_sessions s WHERE s.user_id = uid AND s.chapter_id = p_chapter AND s.started_at <= now() - interval '8 seconds') THEN RETURN false; END IF;
 INSERT INTO chapter_reads(user_id,chapter_id,manga_id) VALUES (uid,p_chapter,m) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n = 0 THEN RETURN false; END IF;
 UPDATE profiles SET xp = xp + 10, level = GREATEST(1,floor(sqrt((xp + 10) / 100.0))::int + 1)
 WHERE id = uid RETURNING xp INTO v_xp;
 IF v_xp IS NOT NULL THEN
 INSERT INTO xp_history(user_id,amount,balance_after,source,reason) VALUES (uid,10,v_xp,'reading','Capítulo lido');
 END IF;
 h := extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo')::int;
 IF h = 3 THEN INSERT INTO secret_discoveries(user_id,key) VALUES (uid,'madrugada') ON CONFLICT DO NOTHING; END IF;
 PERFORM evaluate_achievements(uid, ARRAY['leitura','sequencia','exploracao','secreta']);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.record_chapter_read(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_chapter_read(uuid) TO authenticated;


-- Segredos só são descobertos quando atividades verificadas no banco satisfazem os requisitos.
CREATE OR REPLACE FUNCTION public.discover_secret(p_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $
DECLARE uid uuid := auth.uid(); n integer; opened integer; favorites integer; posted integer; best integer; distinct_genres integer;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
 IF p_key NOT IN ('hidden_area','hidden_element','easter_egg') THEN RETURN false; END IF;
 SELECT count(*) INTO opened FROM chapter_reads WHERE user_id = uid;
 SELECT count(*) INTO favorites FROM favorites f WHERE f.user_id = uid;
 SELECT count(*) INTO posted FROM comments c WHERE c.user_id = uid AND NOT c.hidden;
 SELECT s.best_streak INTO best FROM reading_streak(uid) s;
 SELECT count(DISTINCT mg.genre_id) INTO distinct_genres
 FROM chapter_reads cr JOIN manga_genres mg ON mg.manga_id = cr.manga_id WHERE cr.user_id = uid;
 IF (p_key = 'hidden_area' AND opened < 5)
    OR (p_key = 'hidden_element' AND (favorites < 3 OR posted < 3))
    OR (p_key = 'easter_egg' AND (best < 7 OR distinct_genres < 5))
 THEN RETURN false; END IF;
 INSERT INTO secret_discoveries(user_id,key) VALUES (uid,p_key) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n = 0 THEN RETURN false; END IF;
 IF p_key = 'hidden_area' AND (SELECT count(*) FROM secret_discoveries WHERE key = 'hidden_area') <= 10 THEN
   INSERT INTO secret_discoveries(user_id,key) VALUES (uid,'first_discoverer') ON CONFLICT DO NOTHING;
 END IF;
 PERFORM evaluate_achievements(uid, ARRAY['secreta']);
 RETURN true;
END $;
REVOKE ALL ON FUNCTION public.discover_secret(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.discover_secret(text) TO authenticated;

-- Catálogo adicional sem duplicação e sem apagar/conceder novamente conquistas antigas.
INSERT INTO public.achievements(slug,name,description,unlock_text,icon,category,rarity,xp_reward,coin_reward,metric,goal,sort)
SELECT v.slug,v.name,v.description,v.unlock_text,v.icon,v.category,v.rarity,v.xp,v.coins,v.metric,v.goal,v.sort
FROM (VALUES
('explorador-25','Explorador','Leia 25 obras diferentes.','Sua exploração começou de verdade.','compass','leitura','raro',500,250,'works_started',25,65),
('biblioteca-viva','Biblioteca Viva','Leia obras de 10 gêneros diferentes.','Sua biblioteca já tem muitos mundos.','library','leitura','raro',500,250,'genres_read',10,75),
('colecionador-mundos','Colecionador de Mundos','Leia obras de 25 categorias de gênero diferentes.','Todos os mundos merecem uma leitura.','globe','exploracao','mitico',2500,1000,'genres_read',25,330),
('primeiras-respostas','Primeiras Respostas','Responda 10 comentários na comunidade.','Você ajuda a manter a conversa.','message-circle','comunidade','incomum',150,70,'replies_made',10,460),
('respostas-recebidas','Discussão Viva','Receba 20 respostas a seus comentários.','Sua contribuição gerou debate.','message-circle','comunidade','raro',300,125,'replies_received',20,470),
('seguidores-10','Reconhecido','Ganhe 10 seguidores.','Outros leitores acompanham suas leituras.','users','comunidade','incomum',150,75,'followers',10,480),
('seguindo-25','Conectado','Siga 25 leitores.','Uma grande rede de amizades.','users','comunidade','incomum',150,75,'following',25,490)
) AS v(slug,name,description,unlock_text,icon,category,rarity,xp,coins,metric,goal,sort)
WHERE NOT EXISTS (SELECT 1 FROM achievements a WHERE a.slug = v.slug);

-- Obras completas exigem todos os capítulos publicados. Conquistas já obtidas são preservadas.
CREATE OR REPLACE FUNCTION public.achievement_metric(p_user uuid, p_metric text, p_param text)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v bigint;
BEGIN
  v := CASE p_metric
    WHEN 'chapters_read' THEN (SELECT count(*) FROM chapter_reads WHERE user_id = p_user)
    WHEN 'works_started' THEN (SELECT count(DISTINCT manga_id) FROM chapter_reads WHERE user_id = p_user)
    WHEN 'works_read' THEN (SELECT count(*) FROM (
      SELECT DISTINCT r.manga_id FROM chapter_reads r WHERE r.user_id = p_user
      AND EXISTS (SELECT 1 FROM chapters c WHERE c.manga_id = r.manga_id AND c.status = 'published' AND c.deleted_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM chapters c WHERE c.manga_id = r.manga_id AND c.status = 'published' AND c.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM chapter_reads cr WHERE cr.user_id = p_user AND cr.chapter_id = c.id))
    ) completed)
    WHEN 'max_chapters_day' THEN (SELECT COALESCE(max(c),0) FROM (SELECT count(*) c FROM chapter_reads WHERE user_id = p_user GROUP BY read_on) x)
    WHEN 'streak' THEN (SELECT best_streak FROM reading_streak(p_user))
    WHEN 'favorites' THEN (SELECT count(*) FROM favorites WHERE user_id = p_user)
    WHEN 'genres_read' THEN (SELECT count(DISTINCT mg.genre_id) FROM (SELECT DISTINCT manga_id FROM chapter_reads WHERE user_id = p_user) r JOIN manga_genres mg ON mg.manga_id = r.manga_id)
    WHEN 'genres_all' THEN (SELECT count(DISTINCT mg.genre_id) FROM (SELECT DISTINCT manga_id FROM chapter_reads WHERE user_id = p_user) r JOIN manga_genres mg ON mg.manga_id = r.manga_id)
    WHEN 'comments' THEN (SELECT count(*) FROM comments WHERE user_id = p_user)
    WHEN 'replies_made' THEN (SELECT count(*) FROM comments WHERE user_id = p_user AND parent_id IS NOT NULL)
    WHEN 'replies_received' THEN (SELECT count(*) FROM comments c JOIN comments p ON p.id = c.parent_id WHERE p.user_id = p_user AND c.user_id <> p_user)
    WHEN 'likes_received' THEN (SELECT count(*) FROM comment_likes l JOIN comments c ON c.id = l.comment_id WHERE c.user_id = p_user AND l.user_id <> p_user)
    WHEN 'followers' THEN (SELECT count(*) FROM follows WHERE following_id = p_user)
    WHEN 'following' THEN (SELECT count(*) FROM follows WHERE follower_id = p_user)
    WHEN 'events_joined' THEN (SELECT count(*) FROM event_participations WHERE user_id = p_user)
    WHEN 'events_won' THEN (SELECT count(*) FROM event_participations WHERE user_id = p_user AND won)
    WHEN 'event_rewards' THEN (SELECT COALESCE(sum(rewards),0) FROM event_participations WHERE user_id = p_user)
    WHEN 'cosmetic_equipped' THEN (SELECT count(*) FROM user_cosmetics WHERE user_id = p_user AND equipped)
    WHEN 'cosmetics_owned' THEN (SELECT count(*) FROM user_cosmetics WHERE user_id = p_user)
    WHEN 'own_rarity' THEN (SELECT count(*) FROM user_cosmetics uc JOIN cosmetics c ON c.id = uc.cosmetic_id WHERE uc.user_id = p_user AND c.rarity = p_param)
    WHEN 'cosmetic_kinds_all' THEN (SELECT count(DISTINCT c.kind) FROM user_cosmetics uc JOIN cosmetics c ON c.id = uc.cosmetic_id WHERE uc.user_id = p_user AND c.kind IN ('border','frame','background','banner'))
    WHEN 'coins_received' THEN (SELECT COALESCE(sum(amount),0) FROM coin_transactions WHERE user_id = p_user AND amount > 0)
    WHEN 'shop_purchases' THEN (SELECT count(*) FROM coin_transactions WHERE user_id = p_user AND source = 'purchase' AND amount < 0)
    WHEN 'coins_spent' THEN (SELECT COALESCE(spent,0) FROM coin_wallets WHERE user_id = p_user)
    WHEN 'coins_earned' THEN (SELECT COALESCE(earned,0) FROM coin_wallets WHERE user_id = p_user)
    WHEN 'sub_plan' THEN (SELECT count(*) FROM coin_transactions t JOIN subscriptions s ON t.ref = 'sub:' || s.id::text WHERE t.user_id = p_user AND s.user_id = p_user AND s.plan::text = p_param)
    WHEN 'sub_cosmetic_equipped' THEN (SELECT count(*) FROM user_cosmetics uc JOIN cosmetics c ON c.id = uc.cosmetic_id WHERE uc.user_id = p_user AND uc.equipped AND (c.required_plan <> 'free' OR c.availability = 'subscription'))
    WHEN 'level' THEN (SELECT level FROM profiles WHERE id = p_user)
    WHEN 'secret' THEN (SELECT count(*) FROM secret_discoveries WHERE user_id = p_user AND key = p_param)
    WHEN 'secrets_found' THEN (SELECT count(*) FROM user_achievements u JOIN achievements a ON a.id = u.achievement_id WHERE u.user_id = p_user AND a.is_secret AND a.metric <> 'secrets_found')
    ELSE 0
  END;
  RETURN COALESCE(v, 0)::int;
END $$;


REVOKE ALL ON FUNCTION public.achievement_metric(uuid,text,text) FROM PUBLIC,anon,authenticated;
UPDATE public.achievements SET metric='works_read' WHERE slug='primeira-obra' AND metric='works_started';

-- Títulos ganhos ficam registrados, mesmo depois de uma concessão manual revogada.
CREATE TABLE IF NOT EXISTS public.user_achievement_titles (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
 title text NOT NULL,
 earned_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,achievement_id)
);
GRANT SELECT ON public.user_achievement_titles TO authenticated;
GRANT ALL ON public.user_achievement_titles TO service_role;
ALTER TABLE public.user_achievement_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievement titles read" ON public.user_achievement_titles FOR SELECT TO authenticated USING (
 user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
 OR EXISTS (SELECT 1 FROM public.achievements a WHERE a.id = achievement_id AND NOT a.is_secret)
);
INSERT INTO public.user_achievement_titles(user_id,achievement_id,title,earned_at)
 SELECT ua.user_id,a.id,a.title_reward,ua.unlocked_at FROM user_achievements ua JOIN achievements a ON a.id=ua.achievement_id
 WHERE a.title_reward IS NOT NULL ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.award_achievement(p_user uuid, p_ach uuid, p_source text, p_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.achievements; n integer; v_xp integer; parts text := '';
BEGIN
  SELECT * INTO a FROM achievements WHERE id = p_ach;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO user_achievements(user_id, achievement_id, source, granted_by)
    VALUES (p_user, p_ach, p_source, p_actor) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RETURN false; END IF;
  INSERT INTO achievement_rewards(user_id, achievement_id) VALUES (p_user, p_ach) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    IF a.xp_reward > 0 THEN
      UPDATE profiles SET xp = xp + a.xp_reward, level = GREATEST(1, floor(sqrt((xp + a.xp_reward) / 100.0))::int + 1)
        WHERE id = p_user RETURNING xp INTO v_xp;
      IF v_xp IS NOT NULL THEN
        INSERT INTO xp_history(user_id, amount, balance_after, source, reason, actor_id)
          VALUES (p_user, a.xp_reward, v_xp, 'achievement', a.name, p_actor);
      END IF;
      parts := parts || ' +' || a.xp_reward || ' XP';
    END IF;
    IF a.coin_reward > 0 THEN
      PERFORM coins_apply(p_user, a.coin_reward, 'achievement', 'Conquista: ' || a.name, 'ach:' || p_user::text || ':' || a.id::text, NULL, p_actor);
      parts := parts || ' +' || a.coin_reward || ' Coins';
    END IF;
    IF a.title_reward IS NOT NULL AND length(trim(a.title_reward)) > 0 THEN
      INSERT INTO public.user_achievement_titles (user_id, achievement_id, title) VALUES (p_user, p_ach, a.title_reward) ON CONFLICT DO NOTHING;
      parts := parts || ' + título exclusivo';
    END IF;
    IF a.cosmetic_reward_id IS NOT NULL THEN
      INSERT INTO user_cosmetics(user_id, cosmetic_id, equipped, source) VALUES (p_user, a.cosmetic_reward_id, false, 'achievement')
        ON CONFLICT DO NOTHING;
      parts := parts || ' + novo item';
    END IF;
  END IF;
  INSERT INTO notifications(user_id, title, body, link)
    VALUES (p_user, 'Conquista desbloqueada: ' || a.name, COALESCE(NULLIF(a.unlock_text,''), a.description) || parts, '/conquistas');
  IF a.is_secret AND a.metric <> 'secrets_found' THEN
    PERFORM evaluate_achievements(p_user, ARRAY['secreta']);
  END IF;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.award_achievement(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;

-- Recompensas exclusivas, realmente associadas aos itens no inventário.
INSERT INTO public.cosmetics(slug,name,description,kind,rarity,preview,animation,availability,required_level,required_plan,active)
VALUES
 ('entidade-eterna-moldura','Moldura Entidade Eterna','Exclusiva da conquista Entidade Eterna.','frame','mythic','linear-gradient(135deg,#6f58bc,#e1b967,#432381)','shimmer','exclusive',1,'free',true),
 ('campeao-badge','Badge Campeão','Exclusivo dos vencedores de eventos Eternal.','badge','legendary','#f4b83e','glow','exclusive',1,'free',true),
 ('explorador-secreto-badge','Explorador Secreto','Prêmio de descoberta da comunidade.','badge','legendary','#8068c9','glow','exclusive',1,'free',true)
ON CONFLICT (slug) DO NOTHING;
UPDATE public.achievements SET cosmetic_reward_id = (SELECT id FROM cosmetics WHERE slug = 'campeao-badge') WHERE slug = 'campeao' AND cosmetic_reward_id IS NULL;
UPDATE public.achievements SET cosmetic_reward_id = (SELECT id FROM cosmetics WHERE slug = 'explorador-secreto-badge') WHERE slug = 'voce-encontrou' AND cosmetic_reward_id IS NULL;
INSERT INTO public.achievements(slug,name,description,unlock_text,icon,category,rarity,xp_reward,coin_reward,extra_reward,title_reward,cosmetic_reward_id,is_secret,hint,active,metric,goal,sort)
SELECT 'entidade-eterna','Entidade Eterna','Conquista especial concedida pela equipe Eternal.','A história reconhece sua presença.','crown','eventos','mitico',1000,500,'Moldura exclusiva','Entidade Eterna',c.id,false,NULL,true,'manual',1,995
FROM cosmetics c WHERE c.slug='entidade-eterna-moldura'
ON CONFLICT(slug) DO NOTHING;

-- Somas baseadas em lançamentos reais, não no valor editável do catálogo.
CREATE OR REPLACE FUNCTION public.my_achievement_reward_totals()
RETURNS TABLE(total_xp bigint, total_coins bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $
 SELECT
 COALESCE((SELECT sum(x.amount) FROM xp_history x WHERE x.user_id = auth.uid() AND x.source = 'achievement'), 0),
 COALESCE((SELECT sum(c.amount) FROM coin_transactions c WHERE c.user_id = auth.uid() AND c.source = 'achievement'), 0);
$;
REVOKE ALL ON FUNCTION public.my_achievement_reward_totals() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_achievement_reward_totals() TO authenticated;

-- Estatísticas do painel, com validação do papel no servidor.
CREATE OR REPLACE FUNCTION public.admin_achievement_stats()
RETURNS TABLE(achievement_id uuid, owners bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
 RETURN QUERY SELECT ua.achievement_id,count(*) FROM user_achievements ua GROUP BY ua.achievement_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_achievement_stats() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_achievement_stats() TO authenticated;

-- Criar/editar exigem admin e validação de todos os campos. Trigger existente audita mudanças.
CREATE OR REPLACE FUNCTION public.admin_save_achievement(
 p_id uuid, p_slug text, p_name text, p_description text, p_unlock_text text, p_icon text,
 p_category text, p_rarity text, p_metric text, p_metric_param text, p_goal integer,
 p_xp_reward integer, p_coin_reward integer, p_is_secret boolean, p_hint text,
 p_active boolean, p_cosmetic_reward_id uuid, p_title_reward text, p_extra_reward text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE saved_id uuid;
BEGIN
 IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF p_slug !~ '^[a-z0-9][a-z0-9-]{2,79}$'
   OR length(trim(coalesce(p_name,''))) NOT BETWEEN 3 AND 100
   OR length(trim(coalesce(p_description,''))) NOT BETWEEN 5 AND 500
   OR p_goal IS NULL OR p_goal < 1 OR p_goal > 1000000
   OR p_xp_reward IS NULL OR p_xp_reward NOT BETWEEN 0 AND 100000
   OR p_coin_reward IS NULL OR p_coin_reward NOT BETWEEN 0 AND 100000
   OR length(coalesce(p_unlock_text,'')) > 400 OR length(coalesce(p_hint,'')) > 400
 THEN RAISE EXCEPTION 'invalid achievement fields'; END IF;
 IF p_category NOT IN ('leitura','sequencia','favoritos','exploracao','comunidade','eventos','cosmeticos','coins','assinatura','progressao','secreta')
   OR p_rarity NOT IN ('comum','incomum','raro','epico','lendario','mitico','secreto')
   OR p_metric NOT IN ('chapters_read','works_started','works_read','max_chapters_day','streak','favorites',
     'genres_read','genres_all','tags_read','comments','replies_made','replies_received','likes_received','followers','following',
     'events_joined','events_won','event_rewards','cosmetic_equipped','cosmetics_owned','own_rarity','cosmetic_kinds_all',
     'coins_received','shop_purchases','coins_spent','coins_earned','sub_plan','sub_cosmetic_equipped','level','secret','secrets_found','manual')
 THEN RAISE EXCEPTION 'invalid category, rarity or metric'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO achievements(slug,name,description,unlock_text,icon,category,rarity,metric,metric_param,goal,xp_reward,coin_reward,is_secret,hint,active,cosmetic_reward_id,title_reward,extra_reward)
  VALUES(p_slug,trim(p_name),trim(p_description),coalesce(p_unlock_text,''),coalesce(p_icon,'trophy'),p_category,p_rarity,p_metric,nullif(p_metric_param,''),p_goal,p_xp_reward,p_coin_reward,coalesce(p_is_secret,false),p_hint,coalesce(p_active,true),p_cosmetic_reward_id,nullif(p_title_reward,''),p_extra_reward)
  RETURNING id INTO saved_id;
 ELSE
  UPDATE achievements SET slug=p_slug,name=trim(p_name),description=trim(p_description),unlock_text=coalesce(p_unlock_text,''),
   icon=coalesce(p_icon,'trophy'),category=p_category,rarity=p_rarity,metric=p_metric,metric_param=nullif(p_metric_param,''),
   goal=p_goal,xp_reward=p_xp_reward,coin_reward=p_coin_reward,is_secret=coalesce(p_is_secret,false),
   hint=p_hint,active=coalesce(p_active,true),cosmetic_reward_id=p_cosmetic_reward_id,title_reward=nullif(p_title_reward,''),extra_reward=p_extra_reward
  WHERE id=p_id RETURNING id INTO saved_id;
 END IF;
 IF saved_id IS NULL THEN RAISE EXCEPTION 'achievement not found'; END IF;
 RETURN saved_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_achievement(uuid,text,text,text,text,text,text,text,text,text,integer,integer,integer,boolean,text,boolean,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_achievement(uuid,text,text,text,text,text,text,text,text,text,integer,integer,integer,boolean,text,boolean,uuid,text,text) TO authenticated;
