import { ChevronDown, Star } from "lucide-react";
import { ADMIN_GROUPS, adminSectionPath } from "@/components/admin/adminNavigation";
type BadgeCounts = { requests:number; reports:number; webhooks:number };
type Props = {
  area:string;view:string;compact:boolean;counts:BadgeCounts;
  favorites:string[];onToggleFavorite:(key:string)=>void;
  onSelect:(area:string,view:string)=>void;
};
export function AdminSidebar({area,view,compact,counts,favorites,onToggleFavorite,onSelect}:Props) {
  const emojis = ["🏠","👥","📚","🤝","💬","🎮","💎","❤️","🎨","🔔","⚙️","🔐"];
  return (
    <nav aria-label="Menu administrativo" className="space-y-1.5 pb-8">
      {ADMIN_GROUPS.map((group,index)=>(
        <details key={group.id} open={undefined} className="group rounded-xl" data-active={group.id===area}>
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-white/5 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-2.5">
              <span aria-hidden="true">{emojis[index]}</span>
              {!compact&&<span className="truncate">{group.label}</span>}
            </span>
            {!compact&&<ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-open:rotate-180" aria-hidden/>}
          </summary>
          <div className={`space-y-0.5 pb-2 ${compact?"pl-0":"pl-4"}`}>
            {group.items.map(item=>{
              const key=adminSectionPath(group.id,item.id);
              const current=group.id===area&&item.id===view;
              const badge=item.badge?counts[item.badge]:0;
              return <div key={key} className="flex items-center">
                <button type="button" aria-current={current?"page":undefined} title={item.label}
                  className={`min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-xs transition ${current?"bg-primary/15 font-semibold text-primary":"text-muted-foreground hover:bg-white/5 hover:text-foreground"}`}
                  onClick={()=>onSelect(group.id,item.id)}>{compact?item.label.slice(0,2):item.label}{badge>0? <span className="ml-1 rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">{badge}</span>:null}</button>
                {!compact&&<button type="button" title={favorites.includes(key)?"Remover favorito":"Fixar favorito"} aria-label={favorites.includes(key)?`Desafixar ${item.label}`:`Fixar ${item.label}`}
                  onClick={()=>onToggleFavorite(key)} className="rounded-md p-1.5 text-muted-foreground hover:text-amber-300">
                  <Star className="h-3.5 w-3.5" fill={favorites.includes(key)?"currentColor":"none"}/></button>}
              </div>;
            })}
          </div>
        </details>
      ))}
    </nav>
  );
}
