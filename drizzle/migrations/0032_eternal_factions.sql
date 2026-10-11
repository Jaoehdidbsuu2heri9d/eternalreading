-- Fundações das quatro facções oficiais da Eternal Reading.
-- Memberships são gravadas apenas por RPC; a leitura concluída soma contribuição
-- à facção atual no banco para impedir que o navegador invente pontos.

CREATE TABLE IF NOT EXISTS public.factions (
  slug text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  short_name text NOT NULL,
  founder text NOT NULL,
  founder_title text NOT NULL,
  motto text NOT NULL,
  description text NOT NULL,
  lore text NOT NULL,
  virtues text[] NOT NULL DEFAULT ARRAY[]::text[],
  emblem text NOT NULL CHECK (emblem IN ('flame','moon','portal','raven')),
  accent_color text NOT NULL CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  gradient_class text NOT NULL,
  sort_order integer NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.factions
  (slug, name, short_name, founder, founder_title, motto, description, lore, virtues, emblem, accent_color, gradient_class, sort_order)
VALUES
  (
    'ordem-da-chama',
    'Ordem da Chama',
    'Chama',
    'Aurel, o Primeiro Dragão',
    'Fundador da Chama Rubra',
    'Nossa chama nunca se apaga.',
    'A ordem dos leitores que avançam mesmo diante das histórias mais difíceis.',
    'A lenda conta que Aurel encontrou a primeira chama nos escombros de uma biblioteca esquecida. Em vez de guardá-la para si, dividiu sua luz com quem ainda tinha coragem de continuar lendo. Desde então, a Ordem da Chama acredita que persistência transforma qualquer leitor em protagonista. Seu estandarte traz um dragão rubro, símbolo de coragem, lealdade e recomeço.',
    ARRAY['Coragem','Persistência','Lealdade'],
    'flame', '#F87171', 'from-red-950/80 via-rose-950/40 to-card', 1
  ),
  (
    'ordem-lunar',
    'Ordem Lunar',
    'Lunar',
    'Nyra, a Guardiã do Eclipse',
    'Fundadora do Véu Prateado',
    'Mesmo na escuridão, encontramos o caminho.',
    'A ordem dos leitores que procuram mistérios, simbolismos e verdades escondidas.',
    'Nyra percorreu histórias que outros abandonaram por parecerem sem respostas. Ao observar um eclipse através de um portal antigo, descobriu que até a sombra mais densa guarda uma pista. A Ordem Lunar valoriza paciência, imaginação e sensibilidade: seus membros sabem que a melhor revelação é aquela que faz todas as páginas anteriores ganharem um novo sentido.',
    ARRAY['Sabedoria','Intuição','Imaginação'],
    'moon', '#C4B5FD', 'from-violet-950/80 via-indigo-950/40 to-card', 2
  ),
  (
    'guardioes-do-portal',
    'Guardiões do Portal',
    'Portal',
    'Auren, o Arquiteto de Mundos',
    'Primeiro Guardião',
    'Toda história abre um novo mundo.',
    'A ordem dos exploradores que atravessam gêneros, descobrem novas obras e acolhem novos leitores.',
    'Diz-se que Auren construiu um portal para cada história ainda não descoberta. Os Guardiões não ficam presos a um único mundo: exploram fantasia, romance, ação, drama e tudo o que a biblioteca oferece. Sua missão é abrir caminhos, compartilhar recomendações e garantir que nenhum leitor fique sem uma próxima aventura.',
    ARRAY['Curiosidade','Generosidade','Descoberta'],
    'portal', '#6EE7B7', 'from-emerald-950/80 via-teal-950/40 to-card', 3
  ),
  (
    'corvos-eternos',
    'Corvos Eternos',
    'Corvos',
    'Veyr, o Observador',
    'Guardião dos Arquivos',
    'Conhecimento é o nosso poder.',
    'A ordem dos estrategistas que conectam pistas, constroem teorias e preservam a memória da comunidade.',
    'Veyr nunca lia apenas o que estava escrito: observava símbolos, escolhas e pequenos detalhes que passavam despercebidos. Ao reunir suas anotações, criou os Arquivos Eternos. Os Corvos acreditam que histórias ficam ainda melhores quando são discutidas, lembradas e compartilhadas. O seu brasão representa atenção, estratégia e a força de uma comunidade que pensa junto.',
    ARRAY['Estratégia','Atenção','Comunidade'],
    'raven', '#93C5FD', 'from-slate-950/90 via-blue-950/40 to-card', 4
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_name = EXCLUDED.short_name,
  founder = EXCLUDED.founder,
  founder_title = EXCLUDED.founder_title,
  motto = EXCLUDED.motto,
  description = EXCLUDED.description,
  lore = EXCLUDED.lore,
  virtues = EXCLUDED.virtues,
  emblem = EXCLUDED.emblem,
  accent_color = EXCLUDED.accent_color,
  gradient_class = EXCLUDED.gradient_class,
  sort_order = EXCLUDED.sort_order,
  active = true;

CREATE TABLE IF NOT EXISTS public.user_factions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  faction_slug text NOT NULL REFERENCES public.factions(slug) ON DELETE RESTRICT,
  joined_at timestamptz NOT NULL DEFAULT now(),
  contribution_points integer NOT NULL DEFAULT 0 CHECK (contribution_points >= 0)
);

CREATE INDEX IF NOT EXISTS user_factions_faction_points_idx
  ON public.user_factions (faction_slug, contribution_points DESC, joined_at ASC);

ALTER TABLE public.factions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_factions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS factions_read_authenticated ON public.factions;
CREATE POLICY factions_read_authenticated ON public.factions
  FOR SELECT TO authenticated USING (active OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role));

DROP POLICY IF EXISTS user_factions_roster_read ON public.user_factions;
CREATE POLICY user_factions_roster_read ON public.user_factions
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.factions, public.user_factions TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.factions, public.user_factions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.factions, public.user_factions TO service_role;

CREATE OR REPLACE FUNCTION public.choose_faction(p_faction_slug text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  inserted_count integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.factions
    WHERE slug = p_faction_slug AND active = true
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_factions (user_id, faction_slug)
  VALUES (uid, p_faction_slug)
  ON CONFLICT (user_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 1 THEN
    RETURN true;
  END IF;

  -- Idempotente ao confirmar novamente a facção atual; não permite trocar de
  -- facção usando chamadas repetidas ou concorrentes nesta fase inicial.
  RETURN EXISTS (
    SELECT 1 FROM public.user_factions
    WHERE user_id = uid AND faction_slug = p_faction_slug
  );
END;
$$;

REVOKE ALL ON FUNCTION public.choose_faction(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.choose_faction(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.credit_faction_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.user_factions
  SET contribution_points = contribution_points + 10
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_faction_contribution() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS faction_contribution_on_valid_read ON public.chapter_reads;
CREATE TRIGGER faction_contribution_on_valid_read
AFTER INSERT ON public.chapter_reads
FOR EACH ROW EXECUTE FUNCTION public.credit_faction_contribution();
