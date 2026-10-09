-- Expandir raridades e operações administrativas da loja de molduras sem recriar dados existentes.
ALTER TABLE public.cosmetics DROP CONSTRAINT IF EXISTS cosmetics_rarity_check;
ALTER TABLE public.cosmetics ADD CONSTRAINT cosmetics_rarity_check
  CHECK (rarity = ANY (ARRAY['common','uncommon','rare','epic','legendary','mythic','secret']));

INSERT INTO public.frame_categories(slug, name, sort, active) VALUES
  ('classica','Clássica',1,true),('neon','Neon',2,true),('elemental','Elemental',3,true),
  ('fantasia','Fantasia',4,true),('dark','Dark',5,true),('cute','Cute',6,true),
  ('anime','Anime',7,true),('premium','Premium',8,true),('eventos','Eventos',9,true),
  ('conquistas','Conquistas',10,true),('especial','Especial',11,true)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.cosmetics
SET frame_category = 'classica'
WHERE kind = 'frame' AND frame_category IS NULL;

-- Excluir apenas cosméticos que ainda não fazem parte de nenhum inventário.
-- Itens adquiridos nunca são apagados em cascata por engano.
CREATE OR REPLACE FUNCTION public.admin_delete_cosmetic(p_cosmetic uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cosmetics WHERE id = p_cosmetic) THEN
    RAISE EXCEPTION 'item not found';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_cosmetics WHERE cosmetic_id = p_cosmetic) THEN
    RAISE EXCEPTION 'item has owners; deactivate instead';
  END IF;
  DELETE FROM public.cosmetics WHERE id = p_cosmetic;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_cosmetic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_cosmetic(uuid) TO authenticated;
