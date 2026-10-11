import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Eternal Reading" },
      { name: "description", content: "Regras de uso da comunidade Eternal Reading, atualmente em beta fechada." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar ao início
      </Link>
      <div className="mt-6 flex items-start gap-3">
        <span className="rounded-2xl bg-primary/10 p-3 text-primary"><FileText className="h-6 w-6" aria-hidden /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Eternal Reading · Beta fechada</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Termos de Uso</h1>
          <p className="mt-2 text-sm text-muted-foreground">Versão preliminar de 11 de outubro de 2026. Leia antes de usar a plataforma.</p>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
        <p className="text-sm leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Pendência antes do lançamento público:</strong> a identificação do responsável pela operação e o canal oficial de contato ainda precisam ser preenchidos e revisados. Este texto é um rascunho operacional, não substitui revisão jurídica.
        </p>
      </div>

      <div className="prose-eternal mt-8 space-y-7 text-sm leading-7 text-muted-foreground">
        <section>
          <h2 className="text-lg font-bold text-foreground">1. Sobre a Eternal</h2>
          <p>A Eternal Reading é uma comunidade de leitura e descoberta de obras, atualmente em beta fechada e acessível por convite. Durante a beta, recursos, interface e disponibilidade podem mudar conforme os testes e o feedback dos membros.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground">2. Conta e acesso</h2>
          <p>Você é responsável por proteger suas credenciais, manter informações corretas e avisar a equipe se suspeitar de acesso indevido. Não tente contornar convites, permissões de conta, limites técnicos ou controles de segurança. A equipe pode restringir contas usadas para fraude, abuso, assédio ou violação destes termos, com avaliação proporcional ao caso.</p>
          <p>Menores de idade devem obter autorização e acompanhamento de seu responsável legal antes de contratar planos pagos. Não use dados de pagamento de outra pessoa sem autorização.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground">3. Obras e direitos autorais</h2>
          <p>As obras devem ser disponibilizadas apenas com autorização adequada de seus titulares ou parceiros responsáveis. Não use a plataforma para publicar, solicitar ou redistribuir material sem os direitos necessários. Titulares, autores, editoras e representantes podem solicitar análise ou remoção de conteúdo; o canal oficial de contato precisa ser publicado antes da abertura pública.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground">4. Conduta na comunidade</h2>
          <p>Trate outros membros com respeito. Não publique ameaças, informações pessoais de terceiros, spam, conteúdo ilegal ou material que viole as regras da comunidade. Marque spoilers quando as ferramentas oferecerem essa opção e não tente abusar de missões, rankings, Coins, convites ou recompensas.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground">5. Planos pagos e cancelamento</h2>
          <p>Quando o checkout de produção estiver formalmente habilitado, os planos, preços, periodicidade, benefícios, renovação e instruções de cancelamento serão apresentados na página de planos e no fluxo seguro do provedor de pagamento. Benefícios pagos só são ativados após confirmação válida do provedor. A Eternal não armazena os dados completos do cartão; o checkout é processado pelo Asaas.</p>
          <p>Pagamentos de sandbox ou de teste não são compras reais e não liberam benefícios de produção. Em caso de divergência de cobrança, cancelamento ou pedido de reembolso, use o canal oficial de suporte que será informado antes do lançamento.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground">6. Badge Testador Beta</h2>
          <p>O badge “Testador Beta” é uma distinção da fase de testes, concedida após uma assinatura paga real ser confirmada pelo webhook de produção durante a janela da beta, antes do lançamento oficial de 27 de novembro de 2026. Pagamentos de sandbox, tentativas recusadas, cobranças pendentes ou registros manuais não qualificam. O badge não substitui direitos de cancelamento ou reembolso nem promete benefícios financeiros.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground">7. Disponibilidade e segurança</h2>
          <p>Durante a beta, podem ocorrer interrupções, manutenção, correções ou perda temporária de funcionalidades. A equipe envidará esforços razoáveis para proteger contas e dados, mas os membros devem manter credenciais seguras e comunicar problemas sem publicar segredos, documentos ou dados de pagamento em canais públicos.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground">8. Alterações e contato</h2>
          <p>Estes termos podem ser atualizados à medida que a beta evolui. A versão atual e a data de atualização devem permanecer disponíveis nesta página. A identificação do responsável pela operação e um canal de contato oficial precisam ser preenchidos antes de abrir a Eternal ao público.</p>
        </section>
      </div>
      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Consulte também o <Link to="/privacidade" className="text-primary underline underline-offset-4">Aviso de Privacidade</Link>.
      </p>
    </main>
  );
}
