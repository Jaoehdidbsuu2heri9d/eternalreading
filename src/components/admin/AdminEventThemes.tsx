import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Eye, Palette, Plus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/common/EButton";

type ThemeRow = {
  id: string; name: string; description: string; event_type: string;
  primary_color: string; secondary_color: string; accent_color: string; background_color: string;
  banner_url: string | null; decoration: string; effects_intensity: number;
  animations_enabled: boolean; starts_at: string | null; ends_at: string | null;
  status: "draft" | "scheduled" | "active" | "archived"; priority: number;
};
const presets = [
  { event_type: "halloween", name: "Halloween", description: "Mistério, sombras e magia violeta.", primary_color: "#a855f7", secondary_color: "#312e81", accent_color: "#f97316", background_color: "#10090e", decoration: "bats" },
  { event_type: "christmas", name: "Natal", description: "Uma celebração acolhedora com luzes e neve.", primary_color: "#dc2626", secondary_color: "#166534", accent_color: "#facc15", background_color: "#0b100e", decoration: "snow" },
  { event_type: "easter", name: "Páscoa", description: "Cores pastel e detalhes delicados.", primary_color: "#a78bfa", secondary_color: "#f9a8d4", accent_color: "#facc15", background_color: "#14101a", decoration: "flowers" },
  { event_type: "new_year", name: "Ano-Novo", description: "Brilhos dourados para uma nova jornada.", primary_color: "#eab308", secondary_color: "#64748b", accent_color: "#f8fafc", background_color: "#09090b", decoration: "confetti" },
  { event_type: "valentines", name: "Dia dos Namorados", description: "Detalhes rosados e corações sutis.", primary_color: "#ec4899", secondary_color: "#9d174d", accent_color: "#fda4af", background_color: "#160a12", decoration: "hearts" },
  { event_type: "eternal_birthday", name: "Aniversário Eternal", description: "Celebre a comunidade Eternal Reading.", primary_color: "#8b5cf6", secondary_color: "#4c1d95", accent_color: "#f0abfc", background_color: "#0c0914", decoration: "sparkles" },
] as const;
const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
export function AdminEventThemes() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<ThemeRow | null>(null);
  const [notice, setNotice] = useState("");
  const themes = useQuery({
    queryKey: ["admin-event-themes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_event_themes").select("*").order("priority", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ThemeRow[];
    },
  });
  const save = useMutation({
    mutationFn: async (row: Partial<ThemeRow> & { name: string; event_type: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Entre novamente para continuar.");
      const payload = { ...row, updated_by: auth.user.id, ...(row.id ? {} : { created_by: auth.user.id }) };
      const result = row.id
        ? await supabase.from("site_event_themes").update(payload).eq("id", row.id).select().single()
        : await supabase.from("site_event_themes").insert(payload).select().single();
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => { setSelected(data as ThemeRow); setNotice("Tema salvo. A ativação global ficará disponível ao ativar este tema."); void qc.invalidateQueries({ queryKey: ["admin-event-themes"] }); },
    onError: (e) => setNotice(`Não foi possível salvar: ${(e as Error).message}`),
  });
  const activate = useMutation({
    mutationFn: async (row: ThemeRow) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão expirada.");
      // Expire any currently active theme before activating the selected one.
      const { error: expireError } = await supabase.from("site_event_themes").update({ status: "archived", updated_by: auth.user.id }).eq("status", "active");
      if (expireError) throw expireError;
      const { error } = await supabase.from("site_event_themes").update({ status: "active", updated_by: auth.user.id }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { setNotice("Tema global ativado. A aparência global será aplicada quando o mecanismo de temas estiver conectado."); void qc.invalidateQueries({ queryKey: ["admin-event-themes"] }); },
    onError: (e) => setNotice(`Não foi possível ativar: ${(e as Error).message}`),
  });
  const deactivate = useMutation({
    mutationFn: async (row: ThemeRow) => {
      const { error } = await supabase.from("site_event_themes").update({ status: "archived" }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { setNotice("Tema desativado."); void qc.invalidateQueries({ queryKey: ["admin-event-themes"] }); },
    onError: (e) => setNotice(`Não foi possível desativar: ${(e as Error).message}`),
  });
  const usePreset = (p: typeof presets[number]) => setSelected({
    id: "", ...p, status: "draft", banner_url: null, effects_intensity: 1, animations_enabled: true,
    starts_at: null, ends_at: null, priority: 0,
  });
  const active = themes.data?.find((t) => t.status === "active");
  return <section className="space-y-6">
    <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-violet-950/50 via-card to-fuchsia-950/20 p-6 sm:p-8">
      <div className="flex items-start gap-4"><span className="rounded-2xl bg-primary/15 p-3 text-primary"><Palette className="h-6 w-6" /></span><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Personalização global</p><h2 className="mt-1 text-2xl font-black">Temas e Eventos</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Crie campanhas visuais e gerencie o tema comemorativo da Eternal Reading. Somente o dono pode alterar estes dados, com validação no banco.</p></div></div>
      <div className="mt-5 rounded-2xl border border-border bg-background/50 p-4"><p className="text-xs text-muted-foreground">Tema ativo registrado</p><p className="mt-1 text-lg font-bold">{active?.name ?? "Tema padrão da Eternal"}</p><p className="mt-1 text-sm text-muted-foreground">{active ? "Status ativo no banco de dados" : "Nenhum evento global está ativo."}</p></div>
    </div>
    <div><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-lg font-bold">Biblioteca de temas</h3><Button size="sm" variant="outline" onClick={() => setSelected({ id: "", name: "Novo evento", description: "", event_type: "custom", primary_color: "#8b5cf6", secondary_color: "#312e81", accent_color: "#f59e0b", background_color: "#09070e", banner_url: null, decoration: "none", effects_intensity: 1, animations_enabled: true, starts_at: null, ends_at: null, status: "draft", priority: 0 })}><Plus className="mr-1 h-4 w-4" /> Criar tema</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{presets.map((p) => <article key={p.event_type} className="overflow-hidden rounded-2xl border border-border bg-card"><div className="h-24" style={{ background: `radial-gradient(circle at 80% 20%, ${p.accent_color}66, transparent 35%), linear-gradient(120deg, ${p.background_color}, ${p.secondary_color})` }}><div className="flex h-full items-end p-4"><span className="rounded-full border border-white/20 bg-black/30 px-3 py-1 text-xs text-white">{p.decoration}</span></div></div><div className="p-4"><h4 className="font-bold">{p.name}</h4><p className="mt-1 text-sm text-muted-foreground">{p.description}</p><Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => usePreset(p)}><Eye className="mr-1 h-4 w-4" /> Personalizar este tema</Button></div></article>)}</div>
    </div>
    {selected && <form className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); save.mutate(selected); }}>
      <div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold">{selected.id ? "Editar tema" : "Criar tema"}</h3><p className="text-sm text-muted-foreground">Prévia instantânea das cores antes de salvar.</p></div><Button type="button" variant="ghost" onClick={() => setSelected(null)}>Fechar</Button></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span className="block">Nome</span><input required maxLength={80} className={field} value={selected.name} onChange={e=>setSelected({...selected!,name:e.target.value})}/></label><label className="space-y-1 text-sm"><span className="block">Tipo de evento</span><select className={field} value={selected.event_type} onChange={e=>setSelected({...selected!,event_type:e.target.value})}>{[...presets.map(p=>({value:p.event_type,label:p.name})),{value:"custom",label:"Personalizado"}].map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label></div>
      <label className="block space-y-1 text-sm"><span>Descrição</span><textarea className={field} rows={2} value={selected.description} onChange={e=>setSelected({...selected!,description:e.target.value})}/></label>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{([{key:"primary_color",label:"Principal"},{key:"secondary_color",label:"Secundária"},{key:"accent_color",label:"Destaque"},{key:"background_color",label:"Fundo"}] as const).map(c=><label key={c.key} className="space-y-2 rounded-xl border border-border p-3 text-sm"><span className="block">{c.label}</span><input type="color" className="h-10 w-full cursor-pointer rounded-lg bg-transparent" value={selected[c.key]} onChange={e=>setSelected({...selected!,[c.key]:e.target.value})}/><span className="text-xs text-muted-foreground">{selected[c.key]}</span></label>)}</div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span className="block">Decoração</span><select className={field} value={selected.decoration} onChange={e=>setSelected({...selected!,decoration:e.target.value})}>{["none","bats","snow","flowers","sparkles","hearts","confetti"].map(x=><option key={x} value={x}>{x}</option>)}</select></label><label className="space-y-1 text-sm"><span className="block">Intensidade dos efeitos (0–3)</span><input type="range" min="0" max="3" className="w-full" value={selected.effects_intensity} onChange={e=>setSelected({...selected!,effects_intensity:Number(e.target.value)})}/></label></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span className="block">Início (fuso de Brasília)</span><input type="datetime-local" className={field} value={selected.starts_at ? selected.starts_at.slice(0,16) : ""} onChange={e=>setSelected({...selected!,starts_at:e.target.value ? new Date(e.target.value).toISOString() : null,status:e.target.value?"scheduled":selected.status})}/></label><label className="space-y-1 text-sm"><span className="block">Término (fuso de Brasília)</span><input type="datetime-local" className={field} value={selected.ends_at ? selected.ends_at.slice(0,16) : ""} onChange={e=>setSelected({...selected!,ends_at:e.target.value ? new Date(e.target.value).toISOString() : null})}/></label></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.animations_enabled} onChange={e=>setSelected({...selected!,animations_enabled:e.target.checked})}/> Ativar animações leves</label>
      <div className="overflow-hidden rounded-2xl border border-border p-4" style={{background:selected.background_color,color:"#fff"}}><div className="rounded-xl p-4" style={{background:selected.secondary_color}}><span className="text-xs font-bold uppercase tracking-widest">Prévia do evento</span><h4 className="mt-2 text-2xl font-black">{selected.name}</h4><p className="mt-1 text-sm opacity-80">{selected.description || "Sua descrição aparecerá aqui."}</p><span className="mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold" style={{background:selected.accent_color,color:selected.background_color}}>Eternal Reading</span></div></div>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={save.isPending}>Salvar tema</Button><Button type="button" variant="outline" disabled={!selected.id || activate.isPending} onClick={()=>activate.mutate(selected as ThemeRow)}><Sparkles className="mr-1 h-4 w-4"/> Ativar globalmente</Button></div>
    </form>}
    {notice && <p role="status" className="rounded-xl border border-border p-3 text-sm">{notice}</p>}
    <div><h3 className="mb-3 flex items-center gap-2 text-lg font-bold"><CalendarClock className="h-5 w-5 text-primary"/> Eventos salvos</h3><div className="space-y-2">{(themes.data??[]).map(t=><div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{t.name}</p><span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{t.status}</span>{t.status==="active"&&<CheckCircle2 className="h-4 w-4 text-emerald-400"/>}</div><p className="mt-1 text-sm text-muted-foreground">{t.description}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>setSelected(t)}>Editar</Button>{t.status==="active"?<Button size="sm" variant="secondary" onClick={()=>deactivate.mutate(t)}>Desativar</Button>:<Button size="sm" onClick={()=>activate.mutate(t)}>Ativar</Button>}</div></div>)}{themes.isLoading?<p className="text-sm text-muted-foreground">Carregando temas…</p>:null}{!themes.isLoading&&!themes.data?.length?<p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum tema salvo ainda. Escolha um tema predefinido para começar.</p>:null}</div></div>
    <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">Nota técnica: o tema fica persistido no banco. Para alterar automaticamente a aparência de todas as páginas, o provedor global de tema ainda precisa ser ligado ao tema ativo; esta tela gerencia os registros e a ativação.</p>
  </section>;
}
