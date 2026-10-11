import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, LockKeyhole, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Aviso de Privacidade — Eternal Reading" },
      { name: "description", content: "Como a Eternal Reading trata dados pessoais durante a beta fechada." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar ao início
      </Link>
      <div className="mt-6 flex items-start gap-3">
        <span className="rounded-2xl bg-primary/10 p-3 text-primary"><LockKeyhole className="h-6 w-6" aria-hidden /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Eternal Reading · Beta fechada</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Aviso de Privacidade</h1>
          <p className="mt-2 text-sm text-muted-foreground">Versão preliminar de 11 de outubro de 2026.</p>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
        <p className="text-sm leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Pendência antes do lançamento público:</strong> o responsável pelo tratamento e o canal oficial para pedidos de privacidade devem ser identificados nesta página. Não publique dados inventados; obtenha revisão do responsável legal e, quando apropriado, assessoria jurídica.
        </p>
      </div>

      <div className="mt-8 space-y-7 text-sm leading-7 text-muted-foreground">
        <section>
          <h2 className="text-lg font-bold text-foreground">1. Dados que podem ser tratados</h2>
          <p>Conforme as funções que você utiliza, a Eternal pode tratar e-mail de cadastro, nome de usuário, identificadores da conta, nome e elementos escolhidos para o perfil, avatar, molduras e outros cosméticos equipados, favoritos, histórico e progresso de leitura, sequência, conquistas, pontuação de facção, comentários, publicações, reações, denúncias e registros de moderação.</p>
          <p>Para segurança e operação podem ser gerados registros técnicos de acesso, falhas, solicitações e ações administrativas. Não inclua senhas, chaves privadas nem dados de pagamento em comentários ou publicações.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground">2. Finalidades</h2>
          <p>Os dados são usados para autenticar a conta, entregar o catálogo e o leitor, salvar progresso, operar recursos sociais, prevenir abuso, moderar conteúdo, conceder recompensas válidas, atender solicitações e manter a segurança e disponibilidade do serviço.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground">3. Fornecedores e compartilhamento</h2>
          <p>A plataforma utiliza Lovable Cloud/Supabase para hospedar partes da aplicação, autenticação e banco de dados, Cloudflare R2 para armazenar mídia de obras e o Asaas para processar pagamentos quando o ambiente de produção estiver habilitado. Esses fornecedores podem tratar dados necessários ao funcionamento de seus serviços conforme seus próprios termos e políticas.</p>
          <p>Durante o checkout, dados exigidos pelo provedor — como nome, e-mail e CPF — podem ser enviados diretamente ao Asaas. O código do site não armazena o número completo do cartão. Não afirmamos que todos os dados permaneçam no Brasil ou que nunca haja transferência internacional; isso depende das configurações e condições dos fornecedores.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground">4. Base, retenção e segurança</h2>
          <p>O responsável deve documentar a base legal apropriada para cada finalidade e conservar dados somente pelo tempo necessário para operar o serviço, manter segurança, cumprir obrigações aplicáveis e resolver disputas. A equipe deve limitar o acesso administrativo, guardar credenciais em secrets de servidor, manter o bucket de mídia privado, revisar permissões e manter um processo de backup e resposta a incidentes.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground">5. Seus direitos e solicitações</h2>
          <p>Conforme a legislação aplicável, você pode solicitar informações sobre o tratamento, acesso, correção, anonimização, bloqueio, eliminação quando cabível e revisão de decisões nos termos legais. O responsável deve disponibilizar um canal eletrônico para receber e responder pedidos de titulares. O canal oficial de contato ainda precisa ser informado nesta versão preliminar; ele é um bloqueador para a abertura pública.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground">6. Menores de idade</h2>
          <p>Se você for menor de idade, envolva seu responsável legal antes de contratar planos pagos ou fornecer dados de cobrança. Não envie documentos pessoais em canais públicos da comunidade.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground">7. Atualizações</h2>
          <p>Este aviso pode ser atualizado conforme a beta evolui. A versão final deve identificar o responsável, canal de contato, datas, prazos de retenção e demais detalhes confirmados do tratamento antes do lançamento oficial.</p>
        </section>
      </div>
      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Consulte também os <Link to="/termos" className="text-primary underline underline-offset-4">Termos de Uso</Link>.
      </p>
    </main>
  );
}
