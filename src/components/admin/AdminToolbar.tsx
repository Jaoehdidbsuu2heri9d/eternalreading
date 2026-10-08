import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, Search, Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_GROUPS, adminSectionPath } from "@/components/admin/adminNavigation";

type Props={favorites:string[];count:number;onSelect:(area:string,view:string)=>void};
export function AdminToolbar({favorites,count,onSelect}:Props){
 const [open,setOpen]=useState(false),[query,setQuery]=useState("");
 const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  const handler=(e:KeyboardEvent)=>{
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setOpen(v=>!v)}
   if(e.key==="Escape")setOpen(false);
  };
  document.addEventListener("keydown",handler);
  return ()=>document.removeEventListener("keydown",handler);
 },[]);
 useEffect(()=>{if(open) input.current?.focus()},[open]);
 const q=query.trim();
 const users=useQuery({
  queryKey:["admin-global-search-users",q],
  enabled:open&&q.length>=2,
  queryFn:async()=>{
   const r=await supabase.rpc("admin_list_users",{p_search:q});
   if(r.error)throw r.error;
   return (r.data??[]).slice(0,6);
  },
 });
 const works=useQuery({
  queryKey:["admin-global-search-works",q],
  enabled:open&&q.length>=2,
  queryFn:async()=>{
   const r=await supabase.from("manga").select("id,title").ilike("title",`%${q}%`).limit(6);
   if(r.error)throw r.error;
   return r.data??[];
  },
 });
 const scans=useQuery({
  queryKey:["admin-search-scans",q],enabled:open&&q.length>=2,
  queryFn:async()=>{
   const r=await supabase.from("scans").select("id,name,slug").ilike("name",`%${q}%`).limit(5);
   if(r.error)throw r.error;
   return r.data??[];
  },
 });
 const chapters=useQuery({
  queryKey:["admin-search-chapters",q],enabled:open&&q.length>=2,
  queryFn:async()=>{
   const r=await supabase.from("chapters").select("id,title,manga_id").ilike("title",`%${q}%`).limit(5);
   if(r.error)throw r.error;
   return r.data??[];
  },
 });
 const sections=ADMIN_GROUPS.flatMap(g=>g.items.map(item=>({...item,group:g})));
 const filtered=sections.filter(x=>!q||(`${x.group.label} ${x.label}`).toLocaleLowerCase("pt-BR").includes(q.toLocaleLowerCase("pt-BR"))).slice(0,10);
 const pin=sections.filter(x=>favorites.includes(adminSectionPath(x.group.id,x.id)));
 const navigate=(g:string,v:string)=>{setOpen(false);onSelect(g,v)};
 return <>
  <div className="flex items-center gap-2">
   <button type="button" onClick={()=>setOpen(true)} aria-label="Busca global" className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary">
    <Search className="h-4 w-4"/><span className="hidden sm:inline">Buscar</span><kbd className="hidden rounded-md bg-surface-2 px-1.5 text-xs sm:inline">Ctrl K</kbd>
   </button>
   <button type="button" onClick={()=>onSelect("visao-geral","alertas")} aria-label="Central de alertas" className="relative rounded-xl border border-border p-2.5 hover:border-primary">
    <Bell className="h-4 w-4"/>{count>0&&<span className="absolute -right-1 -top-2 rounded-full bg-destructive px-1.5 text-[10px] text-white">{count}</span>}
   </button>
  </div>
  {pin.length>0&&<div role="region" className="flex max-w-full flex-wrap items-center gap-2" aria-label="Atalhos rápidos">
   <Star className="h-3.5 w-3.5 text-amber-300"/>{pin.slice(0,4).map(x=><button key={x.id+x.group.id} type="button" onClick={()=>navigate(x.group.id,x.id)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:text-primary">{x.label}</button>)}
  </div>}
  {open&&<div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/75 p-4 pt-[10vh]" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
   <div role="dialog" aria-label="Busca do painel administrativo" aria-modal="true" className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
    <div className="flex items-center gap-3 border-b border-border p-4">
     <Search className="h-5 w-5 text-muted-foreground"/><input ref={input} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar área, usuário ou obra..." aria-label="Buscar no painel" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/>
     <button type="button" onClick={()=>setOpen(false)} aria-label="Fechar busca"><X className="h-5 w-5"/></button>
    </div>
    <div className="max-h-[60vh] space-y-2 overflow-y-auto p-3 text-sm">
     {filtered.map(x=><button key={x.group.id+x.id} type="button" onClick={()=>navigate(x.group.id,x.id)} className="flex w-full justify-between rounded-lg px-3 py-2 text-left hover:bg-surface-2"><span>{x.label}</span><span className="text-xs text-muted-foreground">{x.group.label}</span></button>)}
     {q.length>=2&&<div className="border-t border-border pt-2">
      <p className="px-3 text-xs font-semibold text-muted-foreground">Usuários e obras</p>
      {(users.data??[]).map(u=><Link key={u.id} to="/perfil/$username" params={{username:u.username}} onClick={()=>setOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-surface-2">👤 @{u.username}</Link>)}
      {(works.data??[]).map(w=><Link key={w.id} to="/admin/obras/$id" params={{id:w.id}} onClick={()=>setOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-surface-2">📚 {w.title}</Link>)}
      {(chapters.data??[]).map(c=><Link key={c.id} to="/admin/obras/$id" params={{id:c.manga_id}} onClick={()=>setOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-surface-2">📖 Capítulo: {c.title}</Link>)}
      {(scans.data??[]).map(scan=><Link key={scan.id} to="/scan/$slug" params={{slug:scan.slug}} onClick={()=>setOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-surface-2">🤝 Scan: {scan.name}</Link>)}
      {(users.isError||works.isError)&&<p role="alert" className="px-3 text-xs text-destructive">Busca parcial indisponível. Verifique as permissões.</p>}
     </div>}
     {!filtered.length&&q.length<2&&<p className="px-3 text-xs text-muted-foreground">Digite para encontrar uma seção.</p>}
    </div>
   </div>
  </div>}
 </>;
}
