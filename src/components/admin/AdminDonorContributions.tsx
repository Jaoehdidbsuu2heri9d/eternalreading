import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AdminDonorContributions(){
 const donations=useQuery({
  queryKey:["admin-donor-contributions"],refetchInterval:30000,
  queryFn:async()=>{
   const {data,error}=await supabase.from("donations").select("id,user_id,amount_cents,status,created_at,billing_type").order("created_at",{ascending:false}).limit(100);
   if(error)throw error;
   const rows=data??[];
   const ids=[...new Set(rows.map(d=>d.user_id))];
   const people=ids.length?await supabase.from("profiles").select("id,username").in("id",ids):null;
   const names=new Map((people?.data??[]).map(p=>[p.id,p.username]));
   return {rows,names};
  }
 });
 return <section className="space-y-4">
  <p className="text-sm text-muted-foreground">Histórico de contribuições avulsas do Asaas Sandbox, separado de assinaturas e reconhecimentos honorários. Os valores são visíveis apenas à equipe autorizada.</p>
  <Link to="/hall-da-fama" className="inline-flex rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:text-primary">Abrir Hall da Fama público ↗</Link>
  {donations.isError&&<p role="alert" className="text-sm text-destructive">Não foi possível consultar contribuições. Confira as permissões do banco.</p>}
  {donations.isLoading&&<p className="text-sm text-muted-foreground">Carregando…</p>}
  {donations.data?.rows.length===0&&<p className="rounded-xl border border-border p-5 text-sm text-muted-foreground">Nenhuma contribuição registrada no Sandbox.</p>}
  {!!donations.data?.rows.length&&<div className="overflow-x-auto rounded-xl border border-border">
   <table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-surface-2 text-muted-foreground"><tr><th className="p-3">Membro</th><th className="p-3">Valor</th><th className="p-3">Status</th><th className="p-3">Data</th></tr></thead>
    <tbody className="divide-y divide-border">{donations.data.rows.map(d=><tr key={d.id}>
     <td className="p-3">@{donations.data!.names.get(d.user_id)??"Membro"}</td>
     <td className="p-3">{(d.amount_cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td>
     <td className="p-3">{d.status}</td>
     <td className="p-3">{new Date(d.created_at).toLocaleString("pt-BR")}</td>
    </tr>)}</tbody></table>
  </div>}
 </section>;
}
