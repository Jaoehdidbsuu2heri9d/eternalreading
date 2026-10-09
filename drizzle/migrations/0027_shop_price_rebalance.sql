-- Fixed target prices make this migration safe to retry and prevent a second multiplier.
UPDATE public.cosmetics
SET coin_price = CASE slug
    WHEN 'frame-aurora-loja' THEN 200
    WHEN 'frame-aura' THEN 200
    WHEN 'aurora-prism-frame' THEN 250
    WHEN 'frame-neon-pulse' THEN 300
    WHEN 'aura-neon' THEN 300
    WHEN 'aura-particulas' THEN 400
    WHEN 'phantom-circuit-frame' THEN 500
    WHEN 'frame-gelo' THEN 500
    WHEN 'frame-energia' THEN 500
    WHEN 'aura-raio' THEN 600
    WHEN 'cotton-kitten-frame' THEN 650
    WHEN 'bg-nebulosa-loja' THEN 700
    WHEN 'midnight-cat-frame' THEN 800
    WHEN 'frame-chamas' THEN 800
    WHEN 'celestial-tempest-frame' THEN 850
    WHEN 'frame-runas' THEN 900
    WHEN 'aura-chama' THEN 900
    WHEN 'easter-bunny-frame' THEN 950
    WHEN 'oni-flame-frame' THEN 1000
    WHEN 'halloween-pumpkin-frame' THEN 1050
    WHEN 'bunny-dreamland-frame' THEN 1150
    WHEN 'moonlit-garden-frame' THEN 1200
    WHEN 'frame-galaxia' THEN 1200
    WHEN 'sakura-spring-frame' THEN 1200
    WHEN 'kitsune-spirit-frame' THEN 1250
    WHEN 'christmas-wonderland-frame' THEN 1300
    WHEN 'halloween-phantom-frame' THEN 1300
    WHEN 'solar-crown-frame' THEN 1300
    WHEN 'christmas-spark-frame' THEN 1400
    WHEN 'celestial-dragon-frame' THEN 1600
    WHEN 'frame-sombra' THEN 1600
    WHEN 'aura-sol' THEN 1600
    WHEN 'crimson-eclipse-frame' THEN 1800
    WHEN 'galaxy-sovereign-frame' THEN 2300
    WHEN 'void-secret-frame' THEN 2400
    WHEN 'eternal-phoenix-frame' THEN 2400
    ELSE coin_price
  END
WHERE slug IN ('frame-aurora-loja', 'frame-aura', 'aurora-prism-frame', 'frame-neon-pulse', 'aura-neon', 'aura-particulas', 'phantom-circuit-frame', 'frame-gelo', 'frame-energia', 'aura-raio', 'cotton-kitten-frame', 'bg-nebulosa-loja', 'midnight-cat-frame', 'frame-chamas', 'celestial-tempest-frame', 'frame-runas', 'aura-chama', 'easter-bunny-frame', 'oni-flame-frame', 'halloween-pumpkin-frame', 'bunny-dreamland-frame', 'moonlit-garden-frame', 'frame-galaxia', 'sakura-spring-frame', 'kitsune-spirit-frame', 'christmas-wonderland-frame', 'halloween-phantom-frame', 'solar-crown-frame', 'christmas-spark-frame', 'celestial-dragon-frame', 'frame-sombra', 'aura-sol', 'crimson-eclipse-frame', 'galaxy-sovereign-frame', 'void-secret-frame', 'eternal-phoenix-frame')
  AND active = true AND in_shop = true;
