-- Molduras animadas de verdade: arte temática no frontend + efeitos orbitais no banco.
-- Atualiza apenas molduras ativas da loja; não altera inventários, compras nem itens desativados.
UPDATE public.cosmetics
SET animation = CASE
  WHEN slug ILIKE '%hallow%' OR slug ILIKE '%pumpkin%' OR slug ILIKE '%chamas%' OR slug ILIKE '%flame%' OR slug ILIKE '%oni%' THEN 'pulse'
  WHEN slug ILIKE '%natal%' OR slug ILIKE '%christmas%' OR slug ILIKE '%cat%' OR slug ILIKE '%bunny%' OR slug ILIKE '%coelh%' THEN 'drift'
  WHEN slug ILIKE '%gelo%' OR slug ILIKE '%cristal%' OR slug ILIKE '%ice%' THEN 'shimmer'
  WHEN slug ILIKE '%circuit%' OR slug ILIKE '%energia%' OR slug ILIKE '%neon%' THEN 'spin'
  WHEN slug ILIKE '%galax%' OR slug ILIKE '%orbita%' OR slug ILIKE '%eclipse%' THEN 'drift'
  WHEN slug ILIKE '%runas%' OR slug ILIKE '%magic%' OR slug ILIKE '%celestial%' THEN 'spin'
  ELSE 'glow'
END,
effect = jsonb_build_object(
  'style', CASE
    WHEN slug ILIKE '%hallow%' OR slug ILIKE '%pumpkin%' OR slug ILIKE '%chamas%' OR slug ILIKE '%flame%' OR slug ILIKE '%oni%' THEN 'fire'
    WHEN slug ILIKE '%natal%' OR slug ILIKE '%christmas%' OR slug ILIKE '%cat%' OR slug ILIKE '%bunny%' OR slug ILIKE '%coelh%' OR slug ILIKE '%aurora%' THEN 'aura'
    WHEN slug ILIKE '%gelo%' OR slug ILIKE '%cristal%' OR slug ILIKE '%ice%' THEN 'ice'
    WHEN slug ILIKE '%circuit%' OR slug ILIKE '%energia%' OR slug ILIKE '%neon%' THEN 'electric'
    WHEN slug ILIKE '%galax%' OR slug ILIKE '%orbita%' OR slug ILIKE '%eclipse%' THEN 'galaxy'
    WHEN slug ILIKE '%sombra%' OR slug ILIKE '%void%' OR slug ILIKE '%phantom%' THEN 'dark'
    WHEN slug ILIKE '%runas%' OR slug ILIKE '%magic%' OR slug ILIKE '%celestial%' THEN 'magic'
    ELSE 'orbit'
  END,
  'intensity', CASE rarity WHEN 'mythic' THEN 1.35 WHEN 'legendary' THEN 1.2 WHEN 'epic' THEN 1.05 ELSE 0.85 END,
  'speed', CASE rarity WHEN 'mythic' THEN 1.25 WHEN 'legendary' THEN 1.1 ELSE 1 END,
  'size', 1.05
)
WHERE kind = 'frame' AND active = true AND in_shop = true;

INSERT INTO public.cosmetics (
  slug,name,description,kind,rarity,preview,animation,media_url,required_level,required_plan,active,coin_price,
  availability,event_slug,starts_at,ends_at,sort,in_shop,stock,sold,effect,media_path,media_type,frame_category,
  required_achievement_id,featured,released_at,after_event,exclusive_tag,keep_after_plan
) VALUES
('halloween-pumpkin-frame','Abóbora Travessa','Uma abobrinha fantasma com faíscas laranja, brilho roxo e sustos divertidos ao redor do avatar.','frame','epic','#f97316','pulse',NULL,1,'free',true,520,'shop','halloween',NULL,NULL,80,true,NULL,0,'{"style":"fire","intensity":1.15,"speed":1.1,"size":1.1}'::jsonb,NULL,'image','eventos',NULL,true,now(),'archive','event',false),
('christmas-spark-frame','Natal Encantado','Luzes natalinas piscando, neve cintilante e um gorro fofo que passeia pela moldura.','frame','legendary','#22c55e','drift',NULL,1,'free',true,680,'shop','christmas',NULL,NULL,90,true,NULL,0,'{"style":"ice","intensity":1.15,"speed":0.9,"size":1.1}'::jsonb,NULL,'image','eventos',NULL,true,now(),'archive','event',false),
('easter-bunny-frame','Coelhinho de Páscoa','Um coelhinho fofo e ovos coloridos saltitam em volta do seu avatar.','frame','epic','#f9a8d4','drift',NULL,1,'free',true,460,'shop','easter',NULL,NULL,100,true,NULL,0,'{"style":"aura","intensity":0.95,"speed":1.15,"size":1.05}'::jsonb,NULL,'image','eventos',NULL,true,now(),'archive','event',false),
('cotton-kitten-frame','Gatinho de Algodão','Um gatinho cor-de-rosa caminha ao redor do avatar entre estrelinhas e patinhas brilhantes.','frame','rare','#f472b6','spin',NULL,1,'free',true,320,'shop',NULL,NULL,NULL,110,true,NULL,0,'{"style":"aura","intensity":0.9,"speed":1.1,"size":1.05}'::jsonb,NULL,'image','cute',NULL,true,now(),'keep',NULL,false)
ON CONFLICT (slug) DO NOTHING;
