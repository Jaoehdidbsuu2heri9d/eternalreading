import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useProfile, useSession } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({
    meta: [
      { title: "Meu perfil — Eternal" },
      { name: "description", content: "Atalho para o seu perfil na Eternal." },
      { property: "og:title", content: "Meu perfil — Eternal" },
      { property: "og:description", content: "Seu perfil na Eternal." },
    ],
  }),
  component: MePage,
});

/** Atalho que redireciona para o perfil do usuário logado. */
function MePage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const navigate = useNavigate();
  useEffect(() => {
    if (profile) navigate({ to: "/perfil/$username", params: { username: profile.username }, replace: true });
  }, [profile, navigate]);
  return <div className="p-8 text-muted-foreground">Abrindo seu perfil…</div>;
}
