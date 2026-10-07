-- Eternal Reading: catálogo expandido de conquistas.
-- Seguro para dados existentes: somente INSERT de conquistas ausentes e ajustes de definições.
-- Não remove user_achievements nem achievement_rewards.

-- Corrige a métrica de "gêneros disponíveis": o objetivo é dinâmico via achievement_goal.
-- Corrige coins_received para representar coins recebidas acumuladas, não quantidade de transações.
CREATE OR REPLACE FUNCTION public.achievement_metric(p_user uuid, p_metric text, p_param text)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v bigint;
BEGIN
  v := CASE p_metric
    WHEN 'chapters_read' THEN (SELECT count(*) FROM chapter_reads WHERE user_id = p_user)
    WHEN 'works_started' THEN (SELECT count(DISTINCT manga_id) FROM chapter_reads WHERE user_id = p_user)
    WHEN 'works_read' THEN (SELECT count(DISTINCT manga_id) FROM chapter_reads WHERE user_id = p_user)
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

REVOKE ALL ON FUNCTION public.achievement_metric(uuid,text,text) FROM PUBLIC, anon, authenticated;

INSERT INTO public.achievements
(slug,name,description,unlock_text,icon,category,rarity,xp_reward,coin_reward,extra_reward,is_secret,hint,active,metric,metric_param,goal,sort)
SELECT v.slug,v.name,v.description,v.unlock_text,v.icon,v.category,v.rarity,v.xp,v.coins,v.extra,v.secret,v.hint,true,v.metric,v.param,v.goal,v.sort
FROM (VALUES
('primeiro-capitulo','Primeiro Capítulo','Leia seu primeiro capítulo.','A jornada começou.','book','leitura','comum',50,25,NULL,false,NULL,1,10),
('primeira-obra','Primeira Obra','Leia sua primeira obra.','Você encontrou sua primeira história.','star','leitura','comum',75,30,NULL,false,NULL,2,20),
('leitor-curioso','Leitor Curioso','Leia 10 capítulos.','Sua curiosidade já está rendendo frutos.','book-open','leitura','comum',100,50,NULL,false,NULL,10,30),
('leitor-frequente','Leitor Frequente','Leia 50 capítulos.','Você está criando uma rotina.','book-open','leitura','incomum',250,100,NULL,false,NULL,50,40),
('leitor-incansavel','Leitor Incansável','Leia 100 capítulos.','Cem capítulos vencidos.','flame','leitura','raro',500,200,NULL,false,NULL,100,50),
('maratonista','Maratonista','Leia 20 capítulos em um único dia.','Hoje foi dia de maratona.','zap','leitura','epico',700,300,NULL,false,NULL,20,60),
('mestre-da-leitura','Mestre da Leitura','Leia 500 capítulos.','Seu histórico já parece uma biblioteca.','crown','leitura','lendario',1500,700,NULL,false,NULL,500,70),
('lenda-da-leitura','Lenda da Leitura','Leia 1.000 capítulos.','Uma marca reservada para leitores incansáveis.','trophy','leitura','mitico',3000,1500,NULL,false,NULL,1000,80),
('começo-da-jornada','Começo da Jornada','Mantenha 3 dias consecutivos de leitura.','Três dias sem perder o ritmo.','flame','sequencia','comum',100,50,NULL,false,NULL,3,100),
('em-chamas','Em Chamas','Mantenha 7 dias consecutivos de leitura.','A sequência começou a pegar fogo.','flame','sequencia','incomum',250,100,NULL,false,NULL,7,110),
('leitor-dedicado','Leitor Dedicado','Mantenha 30 dias consecutivos de leitura.','Um mês inteiro mantendo a chama acesa.','flame','sequencia','epico',750,300,NULL,false,NULL,30,120),
('determinação','Determinação','Mantenha 60 dias consecutivos de leitura.','Dois meses sem desistir.','shield','sequencia','lendario',1500,700,NULL,false,NULL,60,130),
('lenda-da-sequencia','Lenda da Sequência','Mantenha 100 dias consecutivos de leitura.','Pouquíssimos leitores chegam aqui.','crown','sequencia','mitico',2500,1200,NULL,false,NULL,100,140),
('imparavel','Imparável','Mantenha 365 dias consecutivos de leitura.','Um ano inteiro de Eternal.','crown','sequencia','mitico',10000,5000,'Título exclusivo: Imparável',false,NULL,365,150),
('primeiro-favorito','Primeiro Favorito','Adicione uma obra aos favoritos.','Você já tem uma história para voltar.','heart','favoritos','comum',50,25,NULL,false,NULL,1,200),
('colecionador-favoritos','Colecionador','Tenha 10 obras nos favoritos.','Sua lista começou a crescer.','heart','favoritos','incomum',150,75,NULL,false,NULL,10,210),
('grande-acervo','Grande Acervo','Tenha 50 obras nos favoritos.','Uma biblioteca particular está nascendo.','heart','favoritos','raro',400,200,NULL,false,NULL,50,220),
('biblioteca-particular','Biblioteca Particular','Tenha 100 obras nos favoritos.','Seu acervo merece respeito.','library','favoritos','epico',800,400,NULL,false,NULL,100,230),
('curador-eterno','Curador Eterno','Tenha 250 obras nos favoritos.','Você sabe exatamente o que quer ler.','crown','favoritos','lendario',2000,1000,NULL,false,NULL,250,240),
('sem-preconceito','Sem Preconceito','Leia obras de 5 gêneros diferentes.','Você deu uma chance para mundos diferentes.','compass','exploracao','incomum',200,100,NULL,false,NULL,5,300),
('multiverso','Multiverso','Leia obras de 10 gêneros diferentes.','Dez gêneros, inúmeros mundos.','globe','exploracao','raro',500,250,NULL,false,NULL,10,310),
('explorador-eterno','Explorador Eterno','Leia obras de todos os gêneros disponíveis.','Você explorou todo o catálogo de gêneros.','globe','exploracao','lendario',2000,1000,NULL,false,NULL,1,320),
('primeiro-comentario','Primeiro Comentário','Faça seu primeiro comentário.','Sua voz agora faz parte da Eternal.','message-circle','comunidade','comum',75,30,NULL,false,NULL,1,400),
('conversador','Conversador','Faça 25 comentários.','Você participa das conversas.','message-circle','comunidade','incomum',250,100,NULL,false,NULL,25,410),
('voz-da-comunidade','Voz da Comunidade','Faça 100 comentários.','Sua voz já é conhecida por aqui.','message-circle','comunidade','raro',600,250,NULL,false,NULL,100,420),
('presença','Presença','Receba 50 curtidas em comentários.','Suas palavras conquistaram leitores.','thumbs-up','comunidade','epico',700,300,NULL,false,NULL,50,430),
('influencia-eterna','Influência Eterna','Receba 500 curtidas em comentários.','Sua participação movimenta a comunidade.','sparkles','comunidade','lendario',2000,1000,NULL,false,NULL,500,440),
('querido-pela-comunidade','Querido pela Comunidade','Receba 1.000 curtidas em comentários.','Mil pessoas escolheram suas palavras.','heart','comunidade','mitico',4000,2000,NULL,false,NULL,1000,450),
('primeiro-evento','Primeiro Evento','Participe de um evento.','Você entrou para a história de um evento.','calendar','eventos','comum',100,50,NULL,false,NULL,1,500),
('veterano-eventos','Veterano','Participe de 5 eventos.','Cinco eventos vividos.','medal','eventos','incomum',300,150,NULL,false,NULL,5,510),
('competidor','Competidor','Participe de 10 eventos.','Você não foge de um desafio.','swords','eventos','raro',600,300,NULL,false,NULL,10,520),
('campeao','Campeão','Vença um evento.','Você chegou ao topo.','trophy','eventos','epico',1000,500,'Badge Campeão',false,NULL,1,530),
('cacador-recompensas','Caçador de Recompensas','Consiga 5 recompensas de eventos.','Você sabe transformar eventos em troféus.','gem','eventos','lendario',1500,750,NULL,false,NULL,5,540),
('lenda-dos-eventos','Lenda dos Eventos','Consiga 10 recompensas de eventos.','Uma carreira de eventos memorável.','crown','eventos','mitico',3000,1500,NULL,false,NULL,10,550),
('primeiro-estilo','Primeiro Estilo','Equipe seu primeiro cosmético.','Seu perfil ganhou personalidade.','palette','cosmeticos','comum',75,30,NULL,false,NULL,1,600),
('personalizado','Personalizado','Possua 5 cosméticos.','Você começou sua coleção.','palette','cosmeticos','incomum',200,100,NULL,false,NULL,5,610),
('colecionador-cosmeticos','Colecionador','Possua 10 cosméticos.','Dez itens no inventário.','gem','cosmeticos','raro',500,250,NULL,false,NULL,10,620),
('fashionista-eterno','Fashionista Eterno','Possua 25 cosméticos.','Seu perfil nunca passa despercebido.','sparkles','cosmeticos','epico',1000,500,NULL,false,NULL,25,630),
('cacador-de-raridades','Caçador de Raridades','Possua um cosmético Lendário.','Você encontrou uma raridade.','gem','cosmeticos','lendario',1500,750,NULL,false,NULL,1,640),
('tesouro-mitico','Tesouro Mítico','Possua um cosmético Mítico.','Poucos conseguem reunir esse tesouro.','gem','cosmeticos','mitico',3000,1500,NULL,false,NULL,1,650),
('arsenal-eterno','Arsenal Eterno','Possua cosméticos de todas as categorias principais.','Seu arsenal está completo.','layers','cosmeticos','lendario',2000,1000,NULL,false,NULL,1,660),
('primeiras-coins','Primeiras Coins','Receba suas primeiras Eternal Coins.','Sua carteira Eternal começou.','coins','coins','comum',50,25,NULL,false,NULL,1,700),
('primeira-compra','Primeira Compra','Faça sua primeira compra na loja.','Você fez sua primeira aquisição.','shopping-bag','coins','incomum',100,50,NULL,false,NULL,1,710),
('investidor','Investidor','Gaste 1.000 Eternal Coins.','Você sabe investir em sua coleção.','coins','coins','raro',500,250,NULL,false,NULL,1000,720),
('magnata','Magnata','Acumule 5.000 Eternal Coins ao longo da conta.','Sua economia Eternal está crescendo.','crown','coins','lendario',2000,1000,NULL,false,NULL,5000,730),
('colecionador-de-tesouros','Colecionador de Tesouros','Faça 10 compras usando Eternal Coins.','Dez aquisições feitas com Coins.','gem','coins','epico',1000,500,NULL,false,NULL,10,740),
('eternal','Eternal','Ative a assinatura Eternal pela primeira vez.','Bem-vindo ao Eternal.','crown','assinatura','raro',500,250,NULL,false,NULL,1,800),
('sunshine','Sunshine','Ative Eternal Sunshine pela primeira vez.','A luz chegou ao seu perfil.','sun','assinatura','epico',750,400,NULL,false,NULL,1,810),
('personalidade-eterna','Personalidade Eterna','Equipe um cosmético exclusivo de assinatura.','Seu plano ganhou uma identidade visual.','sparkles','assinatura','epico',800,400,NULL,false,NULL,1,820),
('voce-encontrou','Você Encontrou','Descubra uma área escondida do Eternal.','Você encontrou o que poucos procuram.','key','secreta','secreto',1000,500,'Badge Explorador Secreto',true,'Algumas portas não ficam no mapa.',true,'secret','hidden_area',1,900),
('de-madrugada','De Madrugada','Faça uma atividade secreta em um horário específico.','Nem todo leitor dorme cedo.','moon','secreta','secreto',750,400,NULL,true,'Talvez a madrugada esconda algo.',true,'secret','madrugada',1,910),
('primeiro-descobridor','Primeiro Descobridor','Esteja entre os primeiros usuários a descobrir um segredo.','Você chegou antes da maioria.','key','secreta','secreto',1500,750,NULL,true,'Algumas descobertas têm janela curta.',true,'secret','first_discoverer',1,920),
('olhos-atentos','Olhos Atentos','Encontre um elemento secreto escondido na interface.','Você prestou atenção nos detalhes.', 'eye','secreta','secreto',1200,600,NULL,true,'Nem tudo na interface está à vista.',true,'secret','hidden_element',1,930),
('easter-egg-eterno','Easter Egg Eterno','Descubra um Easter Egg especial.','Você encontrou uma surpresa da equipe.', 'sparkles','secreta','secreto',2000,1000,NULL,true,'A Eternal também esconde brincadeiras.',true,'secret','easter_egg',1,940),
('???','???','Uma conquista extremamente rara.','Você descobriu o impossível.','lock','secreta','secreto',10000,5000,'Recompensa lendária',true,'???',true,'manual','',1,999),
('level-10','Ascensão','Alcance o nível 10.','Seu perfil está evoluindo.','arrow-up','progressao','raro',500,250,NULL,false,NULL,10,1000),
('level-25','Veterano da Eternal','Alcance o nível 25.','Você já faz parte da história da plataforma.','shield','progressao','epico',1000,500,NULL,false,NULL,25,1010),
('level-50','Lenda da Eternal','Alcance o nível 50.','Seu nome merece ser lembrado.','crown','progressao','mitico',3000,1500,NULL,false,NULL,50,1020)
) AS v(slug,name,description,unlock_text,icon,category,rarity,xp,coins,extra,secret,hint,active,metric,param,goal,sort)
WHERE NOT EXISTS (SELECT 1 FROM public.achievements a WHERE a.slug = v.slug);

-- Mantém conquistas antigas, mas permite que a nova taxonomia seja aplicada sem recriar registros.
UPDATE public.achievements SET category = 'progressao' WHERE metric = 'level';
UPDATE public.achievements SET category = 'favoritos' WHERE metric = 'favorites';

