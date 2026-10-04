import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { supabase } from "@/integrations/supabase/client";
import { formatRelativeDate } from "@/lib/format";

/** Sino de notificações com lista suspensa. */
export function NotificationBell({ userId }: { userId?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const list = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications").select("*").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });
  const unread = (list.data ?? []).filter((n) => !n.read).length;

  const markAll = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications").update({ read: true }).eq("user_id", userId!).eq("read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" aria-label={`Notificações${unread ? ` (${unread} novas)` : ""}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && (
          <span className="gradient-eternal absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-primary-foreground">
            {unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="surface-panel absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between border-b border-border p-3">
            <p className="text-sm font-semibold">Notificações</p>
            {unread > 0 && <button className="text-xs text-primary" onClick={() => markAll.mutate()}>Marcar como lidas</button>}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {(list.data ?? []).length === 0 && <li className="p-4 text-sm text-muted-foreground">Nada por aqui ainda.</li>}
            {(list.data ?? []).map((n) => (
              <li key={n.id}>
                <button
                  className={`w-full p-3 text-left text-sm hover:bg-secondary ${n.read ? "" : "bg-primary/10"}`}
                  onClick={() => { setOpen(false); if (n.link) navigate({ to: n.link }); }}
                >
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatRelativeDate(n.created_at)}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
