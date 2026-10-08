import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowUpRight, Crown, HeartHandshake, LockKeyhole, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/common/EButton";
import { Field, Input } from "@/components/common/EInput";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { formatBRL } from "@/lib/billing-ui";
import { startDonationCheckout } from "@/lib/donations.functions";

export const Route = createFileRoute("/_authenticated/apoiar")({
  head: () => ({
    meta: [
      { title: "Apoiar a Eternal — Hall da Fama" },
      { name: "description", content: "Apoie a comunidade no ambiente Sandbox, acompanhe suas contribuições e escolha sua privacidade." },
    ],
  }),
  component: ApoiarPage,
});

const statusLabels: Record<string,string> = {
  pending: "Aguardando pagamento", confirmed: "Confirmada",
  refunded: "Estornada", overdue: "Vencida", failed: "Falhou", canceled: "Cancelada",
};
const options = [10,25,50,100];

export function ApoiarPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const startDonation = useServerFn(startDonationCheckout);
  const [value, setValue] = useState(25);
  const [cpf, setCpf] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const preference = useQuery({
    queryKey: ["supporter-preference", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("supporter_preferences")
        .select("show_on_hall").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return !!data?.show_on_hall;
    },
  });
  useEffect(() => { if (preference.data !== undefined) setVisible(preference.data); }, [preference.data]);

  const history = useQuery({
    queryKey: ["my-donations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("donations")
        .select("id,amount_cents,status,created_at,confirmed_at,invoice_url")
        .eq("user_id",user!.id).order("created_at",{ ascending:false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 45000,
  });
  const savedVisibility = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre na sua conta.");
      const { error } = await supabase.from("supporter_preferences").upsert({
        user_id:user.id,show_on_hall:visible,updated_at:new Date().toISOString(),
      }, {onConflict:"user_id"});
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supporter-preference",user?.id] });
      qc.invalidateQueries({ queryKey: ["hall-of-fame"] });
      setNotice("Sua preferência de privacidade foi salva.");
    },
    onError: (e:Error) => setError(e.message),
  });

  const confirmed = (history.data ?? []).filter(d=>d.status==="confirmed");
  const total = confirmed.reduce((sum,d)=>sum+d.amount_cents,0);
  const donate = async (e:React.FormEvent) => {
    e.preventDefault();
    setError(null);setNotice(null);
    if (!Number.isFinite(value) || value < 5 || value > 10000) {
      setError("Informe um valor entre R$ 5 e R$ 10.000.");return;
    }
    setBusy(true);
    try {
      const result = await startDonation({ data: {
        amountCents:Math.round(value*100),
        cpf,showOnHall:visible,
      } });
      if (!result.url.startsWith("https://")) throw new Error("Endereço de pagamento inválido.");
      window.location.assign(result.url);
    } catch(e) {
      setError((e as Error).message || "Não foi possível iniciar a contribuição.");
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:py-8">
      <PageHeader title="Apoie a Eternal" subtitle="Sua contribuição ajuda a fortalecer nossa comunidade. Aqui, todas as cobranças são feitas somente no Sandbox." />
      <div className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200" role="status">
        <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5" /> Ambiente de testes</div>
        <p className="mt-1">Não realize pagamentos reais. O Hall reconhece apenas confirmações recebidas do Asaas Sandbox.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="surface-panel rounded-2xl p-5 sm:p-7 lg:col-span-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><HeartHandshake className="h-5 w-5 text-primary" /> Fazer uma contribuição</h2>
          <form onSubmit={donate} className="mt-5 space-y-5">
            <fieldset>
              <legend className="mb-3 text-sm font-semibold">Escolha um valor</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {options.map(n=><button key={n} type="button" aria-pressed={value===n} onClick={()=>setValue(n)}
                  className={`rounded-xl border px-3 py-3 text-sm font-bold ${value===n ? "border-amber-400 bg-amber-400/10 text-amber-300" : "border-border text-muted-foreground hover:border-primary"}`}>{formatBRL(n*100)}</button>)}
              </div>
            </fieldset>
            <Field label="Outro valor (R$)" htmlFor="donation-amount" hint="Mínimo R$ 5, máximo R$ 10.000. Contribuição única, sem renovação.">
              <Input id="donation-amount" type="number" min="5" max="10000" step="0.01" required value={value}
                onChange={e=>setValue(Number(e.target.value))} />
            </Field>
            <Field label="CPF do titular" htmlFor="donation-cpf" hint="Exigido pelo Asaas. Seu CPF não é salvo na tabela de doações.">
              <Input id="donation-cpf" required inputMode="numeric" autoComplete="off" maxLength={20}
                placeholder="000.000.000-00" value={cpf} onChange={e=>setCpf(e.target.value)} />
            </Field>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={visible} onChange={e=>setVisible(e.target.checked)} />
              <span><strong className="block">Quero aparecer no Hall da Fama</strong>
                <span className="mt-1 block text-xs text-muted-foreground">Opcional. Você poderá retirar sua autorização quando quiser. O valor doado não será público.</span>
              </span>
            </label>
            {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
            <Button type="submit" disabled={busy || !user || preference.isLoading} className="w-full">
              {busy ? "Gerando Pix de teste…" : `Continuar com Pix de teste · ${formatBRL(Math.round(value*100))}`}
            </Button>
            <p className="flex gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-4 w-4 shrink-0" /> O status só muda após a confirmação autenticada do Asaas Sandbox. Doações não alteram sua assinatura.</p>
          </form>
        </div>
        <aside className="surface-panel rounded-2xl p-5 sm:p-7 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Crown className="h-5 w-5 text-amber-300" /> Seu reconhecimento</h2>
          <div className="mt-5 rounded-2xl border border-border bg-surface-2 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total confirmado (visível só para você)</p>
            <p className="mt-2 text-2xl font-black text-amber-300">{formatBRL(total)}</p>
            <p className="mt-2 text-xs text-muted-foreground">{confirmed.length} contribuição(ões) confirmada(s)</p>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">Controle a exibição do seu perfil, mesmo sem fazer uma nova contribuição.</p>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/>
            Mostrar meu nome no Hall
          </label>
          <Button type="button" variant="secondary" size="sm" className="mt-3" disabled={savedVisibility.isPending || preference.isLoading}
            onClick={()=>{setError(null);savedVisibility.mutate();}}>{savedVisibility.isPending ? "Salvando…" : "Salvar privacidade"}</Button>
          <Link to="/hall-da-fama" className="mt-6 flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            Visitar o Hall da Fama <ArrowUpRight className="h-4 w-4" />
          </Link>
        </aside>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Minhas contribuições</h2>
        <p className="mt-1 text-xs text-muted-foreground">Histórico particular. Pagamentos pendentes não contam para o Hall.</p>
        {history.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Carregando histórico…</p>
        : history.isError ? <p role="alert" className="mt-4 text-sm text-destructive">Não foi possível carregar o histórico. Confira se a migration foi aplicada.</p>
        : (history.data ?? []).length===0 ? <p className="surface-panel mt-4 rounded-xl p-5 text-sm text-muted-foreground">Você ainda não iniciou nenhuma contribuição.</p>
        : <ul className="mt-4 space-y-3">{(history.data ?? []).map(d=><li className="surface-panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-4" key={d.id}>
            <div><p className="font-bold">{formatBRL(d.amount_cents)}</p><p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString("pt-BR")} · {statusLabels[d.status] ?? d.status}</p></div>
            {d.invoice_url && d.status==="pending" && <a href={d.invoice_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary hover:underline">Ver cobrança de teste ↗</a>}
          </li>)}</ul>}
      </section>
    </div>
  );
}
