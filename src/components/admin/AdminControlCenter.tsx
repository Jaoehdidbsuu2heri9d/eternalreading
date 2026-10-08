import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { ADMIN_GROUPS, adminSectionPath, getAdminSection } from "@/components/admin/adminNavigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminToolbar } from "@/components/admin/AdminToolbar";
import { supabase } from "@/integrations/supabase/client";

export function AdminControlCenter({area,view,children}:{area:string;view:string;children:ReactNode}){
 const navigate=useNavigate();
 const [collapsed,setCollapsed]=useState(false);
 const [drawer,setDrawer]=useState(false);
 const [favorites,setFavorites]=useState<string[]>(()=>{
  try{return JSON.parse(localStorage.getItem("eternal-admin-favorites")||"[]") as string[]}catch{return []}
 });
 useEffect(()=>{localStorage.setItem("eternal-admin-favorites",JSON.stringify(favorites))},[favorites]);
 const toggleFavorite=(key:string)=>setFavorites(x=>x.includes(key)?x.filter(k=>k!==key):[...x,key]);
 const select=(g:string,v:string)=>{setDrawer(false);void navigate({to:"/admin",search:{area:g,view:v}})};
 const counts=useQuery({
  queryKey:["admin-navigation-alert-counts"],
  refetchInterval:60000,
  queryFn:async()=>{
   const [requests,reports,webhooks]=await Promise.all([
    supabase.from("scan_requests").select("id",{head:true,count:"exact"}).eq("status","pending"),
    supabase.from("comment_reports").select("id",{head:true,count:"exact"}).eq("status","pending"),
    supabase.from("payment_events").select("id",{head:true,count:"exact"}).not("error","is",null),
   ]);
   return {requests:requests.count??0,reports:reports.count??0,webhooks:webhooks.count??0};
  },
 });
 const badges=counts.data??{requests:0,reports:0,webhooks:0};
 const selected=getAdminSection(area,view);
 const Sidebar=({mobile=false}:{mobile?:boolean})=><div className="h-full overflow-y-auto">
  <div className="mb-3 flex items-center justify-between gap-3 border-b border-border px-3 pb-4">
   <p className="truncate text-sm font-black tracking-wide text-amber-300">{collapsed&&!mobile?"EC":"ETERNAL CONTROL"}</p>
   {mobile?<button type="button" aria-label="Fechar menu" onClick={()=>setDrawer(false)}><X className="h-5 w-5"/></button>:<button type="button" aria-label={collapsed?"Expandir menu":"Recolher menu"} onClick={()=>setCollapsed(x=>!x)} className="rounded-lg p-1 hover:bg-white/5">{collapsed?<PanelLeftOpen className="h-4 w-4"/>:<PanelLeftClose className="h-4 w-4"/>}</button>}
  </div>
  <AdminSidebar area={area} view={view} compact={!mobile&&collapsed} counts={badges} favorites={favorites}
   onToggleFavorite={toggleFavorite} onSelect={select}/>
 </div>;
 return <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-[1800px]">
   <aside className={`hidden shrink-0 border-r border-border bg-background/80 p-3 transition-all duration-200 xl:block ${collapsed?"w-24":"w-64"}`}><Sidebar/></aside>
   {drawer&&<div className="fixed inset-0 z-[70] bg-black/75 xl:hidden" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setDrawer(false)}}>
     <aside className="h-full w-[min(88vw,330px)] overflow-y-auto border-r border-border bg-background p-4 shadow-2xl"><Sidebar mobile/></aside>
   </div>}
   <div className="min-w-0 flex-1 px-4 pb-20 pt-5 sm:px-6 xl:px-8">
    <header className="mb-6 space-y-4 border-b border-border pb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
       <div className="flex items-center gap-2">
        <button type="button" aria-label="Abrir menu administrativo" onClick={()=>setDrawer(true)} className="rounded-xl border border-border p-2.5 xl:hidden"><Menu className="h-5 w-5"/></button>
        <div><p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Central de Controle</p>
         <h1 className="text-xl font-bold sm:text-2xl">{selected?.section.label??"Administração"}</h1></div>
       </div>
       <AdminToolbar favorites={favorites} count={badges.requests+badges.reports+badges.webhooks} onSelect={select}/>
      </div>
      <nav aria-label="Caminho de navegação" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
       <button type="button" onClick={()=>select("visao-geral","dashboard")} className="hover:text-primary">Admin</button><span aria-hidden>›</span>
       <span>{selected?.category.label??"Visão Geral"}</span><span aria-hidden>›</span>
       <span className="font-semibold text-foreground">{selected?.section.label??"Dashboard"}</span>
      </nav>
    </header>
    <div className="min-w-0">{children}</div>
   </div>
 </div>;
}
