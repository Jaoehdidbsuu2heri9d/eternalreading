import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/common/EButton";
import { UserAvatar } from "@/components/UserAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { followList, followStats, friendlyError, setFollow } from "@/lib/social";

/** Seguidores, seguindo e botão Seguir/Seguindo no perfil. */
export function FollowPanel({ userId, me }: { userId: string; me?: string }) {
  const qc = useQueryClient();
  const [list, setList] = useState<"followers" | "following" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const stats = useQuery({ queryKey: ["follow-stats", userId, me], queryFn: () => followStats(userId, me) });
  const people = useQuery({ queryKey: ["follow-list", userId, list], enabled: !!list, queryFn: () => followList(userId, list!) });

  const toggle = useMutation({
    mutationFn: () => setFollow(me!, userId, !stats.data?.isFollowing),
    onSuccess: () => { setErr(null); qc.invalidateQueries({ queryKey: ["follow-stats"] }); qc.invalidateQueries({ queryKey: ["follow-list"] }); },
    onError: (e) => setErr(friendlyError(e)),
  });

  const s = stats.data;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4">
      <button type="button" className="text-sm hover:underline" onClick={() => setList("followers")}><strong>{s?.followers ?? "—"}</strong> <span className="text-muted-foreground">seguidores</span></button>
      <button type="button" className="text-sm hover:underline" onClick={() => setList("following")}><strong>{s?.following ?? "—"}</strong> <span className="text-muted-foreground">seguindo</span></button>
      {me && me !== userId && (
        <Button size="sm" variant={s?.isFollowing ? "secondary" : "primary"} disabled={!s || toggle.isPending} onClick={() => toggle.mutate()} aria-pressed={!!s?.isFollowing}>
          {s?.isFollowing ? "Seguindo" : "Seguir"}
        </Button>
      )}
      {err && <p role="alert" className="w-full text-sm text-destructive">{err}</p>}

      <Dialog open={!!list} onOpenChange={(o) => !o && setList(null)}>
        <DialogContent className="max-h-[80vh] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>{list === "followers" ? "Seguidores" : "Seguindo"}</DialogTitle></DialogHeader>
          <ul className="space-y-2">
            {(people.data ?? []).map((u) => (
              <li key={u.id}>
                <Link to="/perfil/$username" params={{ username: u.username }} onClick={() => setList(null)} className="flex items-center gap-3 rounded-xl p-2 hover:bg-secondary">
                  <UserAvatar userId={u.id} username={u.username} avatarPath={u.avatar_path} avatarUrl={u.avatar_url} size={36} />
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{u.display_name || u.username}</span><span className="block truncate text-xs text-muted-foreground">@{u.username}</span></span>
                </Link>
              </li>
            ))}
            {people.data?.length === 0 && <li className="text-sm text-muted-foreground">Ninguém por aqui ainda.</li>}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
