-- Coleção inicial de molduras autorais para a Loja Eternal.
-- Inserção idempotente: reaplicar não duplica itens nem altera itens já editados no admin.
INSERT INTO public.cosmetics (
  slug, name, description, kind, rarity, preview, animation, media_url,
  required_level, required_plan, active, coin_price, availability, event_slug,
  starts_at, ends_at, sort, in_shop, stock, sold, effect, media_path, media_type,
  frame_category, required_achievement_id, featured, released_at, after_event,
  exclusive_tag, keep_after_plan
)
VALUES
  ('aurora-prism-frame', 'Prisma Aurora', 'Uma moldura delicada com reflexos de aurora e brilho suave.', 'frame', 'uncommon', '#34d399', 'shimmer', NULL, 1, 'free', true, 120, 'shop', NULL, NULL, NULL, 10, true, NULL, 0, '{"style":"aura","intensity":0.65,"speed":0.8,"size":0.9}'::jsonb, NULL, 'image', 'classica', NULL, true, now(), 'keep', NULL, false),
  ('phantom-circuit-frame', 'Circuito Fantasma', 'Linhas elétricas azul-ciano que orbitam como circuitos de outro mundo.', 'frame', 'rare', '#38bdf8', 'spin', NULL, 1, 'free', true, 240, 'shop', NULL, NULL, NULL, 20, true, NULL, 0, '{"style":"electric","intensity":0.85,"speed":1.15,"size":1}'::jsonb, NULL, 'image', 'neon', NULL, true, now(), 'keep', NULL, false),
  ('celestial-tempest-frame', 'Tempestade Celeste', 'Energia arcana violeta com detalhes geométricos e partículas luminosas.', 'frame', 'epic', '#a855f7', 'drift', NULL, 1, 'free', true, 420, 'shop', NULL, NULL, NULL, 30, true, NULL, 0, '{"style":"magic","intensity":1,"speed":0.9,"size":1.05}'::jsonb, NULL, 'image', 'fantasia', NULL, true, now(), 'keep', NULL, false),
  ('oni-flame-frame', 'Chamas de Oni', 'Uma aura rubra inspirada em lendas e guerreiros de fantasia.', 'frame', 'epic', '#fb7185', 'pulse', NULL, 1, 'free', true, 480, 'shop', NULL, NULL, NULL, 40, true, NULL, 0, '{"style":"fire","intensity":1.1,"speed":1.2,"size":1.05}'::jsonb, NULL, 'image', 'anime', NULL, true, now(), 'keep', NULL, false),
  ('solar-crown-frame', 'Coroa Solar', 'Ornamentos dourados de uma moldura digna de uma lenda.', 'frame', 'legendary', '#f59e0b', 'glow', NULL, 1, 'free', true, 650, 'shop', NULL, NULL, NULL, 50, true, NULL, 0, '{"style":"aura","intensity":1.2,"speed":0.8,"size":1.1}'::jsonb, NULL, 'image', 'premium', NULL, true, now(), 'keep', NULL, false),
  ('crimson-eclipse-frame', 'Eclipse Carmesim', 'Um eclipse místico com energia rosa e violeta em constante movimento.', 'frame', 'mythic', '#f0abfc', 'shimmer', NULL, 1, 'free', true, 900, 'shop', NULL, NULL, NULL, 60, true, NULL, 0, '{"style":"galaxy","intensity":1.25,"speed":0.85,"size":1.15}'::jsonb, NULL, 'image', 'especial', NULL, true, now(), 'keep', NULL, false),
  ('void-secret-frame', 'Segredo do Vazio', 'Uma moldura secreta com energia sombria e brilho magenta quase sobrenatural.', 'frame', 'mythic', '#f43f9e', 'glow', NULL, 1, 'free', true, 1200, 'shop', NULL, NULL, NULL, 70, true, NULL, 0, '{"style":"dark","intensity":1.35,"speed":0.75,"size":1.2}'::jsonb, NULL, 'image', 'especial', NULL, true, now(), 'keep', NULL, false)
ON CONFLICT (slug) DO NOTHING;
