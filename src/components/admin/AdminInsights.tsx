import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Metric={label:string;value:number|null;group:string;view:string;warning?:boolean};
export function AdminInsights({mode}:{mode:"dashboard"|"alertas"}) {
 const navigate=useNavigate();
 const data=useQuery({
  queryKey:["admin-control-dashboard"],
  refetchInterval:60000,
  queryFn:async()=>{
   const list=await Promise.all([
    supabase.from("profiles").select("id",{count:"exact",head:true}),
    supabase.from("manga").select("id",{count:"exact",head:true}).eq("published",true),
    supabase.from("chapters").select("id",{count:"exact",head:true}).eq("status","published"),
    supabase.from("scans").select("id",{count:"exact",head:true}),
    supabase.from("subscriptions").select("id",{count:"exact",head:true}).eq("status","active"),
    supabase.from("supporter_manual_grants").select("user_id",{count:"exact",head:true}).is("revoked_at",null),
    supabase.from("user_achievements").select("*",{count:"exact",head:true}),
    supabase.from("comment_reports").select("id",{count:"exact",head:true}).eq("status","pending"),
    supabase.from("scan_requests").select("id",{count:"exact",head:true}).eq("status","pending"),
    supabase.from("payment_events").select("id",{count:"exact",head:true}).not("error","is",null),
    supabase.from("payments").select("id",{count:"exact",head:true}).eq("status","PENDING"),
    supabase.from("chapters").select("id",{count:"exact",head:true}).eq("status","draft"),
   ]);
   return list.map(r=>r.error?null:(r.count??0));
  }
 });
 const vals=data.data??[];
 const main:Metric[]=[
  {label:"Usuários cadastrados",value:vals[0]??null,group:"usuarios",view:"todos"},
  {label:"Obras publicadas",value:vals[1]??null,group:"conteudo",view:"obras"},
  {label:"Capítulos publicados",value:vals[2]??null,group:"conteudo",view:"capitulos"},
  {label:"Scans",value:vals[3]??null,group:"scans-parcerias",view:"scans"},
  {label:"Assinaturas ativas",value:vals[4]??null,group:"assinaturas",view:"assinaturas"},
  {label:"Reconhecimentos ativos",value:vals[5]??null,group:"apoiadores",view:"reconhecimentos"},
  {label:"Conquistas desbloqueadas",value:vals[6]??null,group:"gamificacao",view:"conquistas"},
 ];
 const urgent:Metric[]=[
  {label:"Denúncias pendentes",value:vals[7]??null,group:"comunidade",view:"denuncias",warning:true},
  {label:"Solicitações de scans",value:vals[8]??null,group:"scans-parcerias",view:"solicitacoes",warning:true},
  {label:"Webhooks com erro",value:vals[9]??null,group:"sistema",view:"webhooks",warning:true},
  {label:"Pagamentos pendentes",value:vals[10]??null,group:"assinaturas",view:"pagamentos",warning:true},
  {label:"Capítulos em rascunho",value:vals[11]??null,group:"conteudo",view:"capitulos",warning:true},
 ];
 const render=(m:Metric)=>(
  <button key={m.label} type="button" onClick={()=>void navigate({to:"/admin",search:{area:m.group,view:m.view}})}
    className="surface-panel group flex min-w-0 flex-col items-start rounded-2xl border border-border p-4 text-left transition hover:border-primary">
   <div className="flex w-full justify-between gap-2 text-xs text-muted-foreground"><span>{m.label}</span><ArrowUpRight className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100"/></div>
   <strong className={`mt-2 text-2xl font-black ${m.warning&&(m.value??0)>0?"text-amber-300":"text-foreground"}`}>{m.value===null?"—":m.value.toLocaleString("pt-BR")}</strong>
  </button>
 );
 return <section className="space-y-6">
  {data.isLoading&&<p className="text-sm text-muted-foreground">Atualizando indicadores…</p>}
  {mode==="dashboard"&&<>
    <div><h2 className="flex items-center gap-2 text-lg font-semibold"><BarChart3 className="h-5 w-5 text-primary"/>Visão operacional</h2>
     <p className="mt-1 text-sm text-muted-foreground">Indicadores disponíveis no banco atual. “—” significa falta de permissão ou indisponibilidade.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{main.map(render)}</div>
    <div className="surface-panel rounded-2xl border border-border p-5" aria-label="Gráfico de métricas da plataforma">
      <h3 className="mb-4 text-sm font-semibold">Panorama de cadastros e publicações</h3>
      <div className="space-y-3">
        {main.slice(0,4).map(m => {
          const maximum=Math.max(1,...main.slice(0,4).map(x=>x.value??0));
          const width=m.value===null?0:Math.round((m.value/maximum)*100);
          return <div key={m.label}>
            <div className="mb-1 flex justify-between text-xs"><span>{m.label}</span><strong>{m.value??"—"}</strong></div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-amber-400/75" style={{width:`${width}%`}} />
            </div>
          </div>;
        })}
      </div>
    </div>
  </>}
  <div><h2 className="flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="h-5 w-5 text-amber-300"/>Atenção e pendências</h2>
  <p className="mt-1 text-sm text-muted-foreground">Abra um indicador para acessar a área responsável. Dados atualizados aproximadamente a cada minuto.</p></div>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{urgent.map(render)}</div>
 </section>;
}
