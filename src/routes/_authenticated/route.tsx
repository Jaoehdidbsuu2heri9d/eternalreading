import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";

import { Footer } from "@/components/Footer";
import { MobileNav } from "@/components/MobileNav";
import { Navbar } from "@/components/Navbar";
import { useProfile, useSession } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Área da comunidade: exige conta.
 * ssr: false porque a sessão fica no navegador.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    // Garante que toda conta tenha perfil (contas antigas ou cadastros interrompidos).
    await supabase.rpc("ensure_profile", {}).then(() => undefined, () => undefined);
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // O leitor usa tela cheia, sem navegação em volta.
  const isReader = pathname.startsWith("/ler/");

  if (isReader) return <Outlet />;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar profile={profile ?? null} />
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileNav {...(profile ? { username: profile.username } : {})} />
    </div>
  );
}
