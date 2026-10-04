import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Cargos do usuário logado (lidos do banco; o banco também protege cada ação). */
export function useRoles(userId?: string | null) {
  const q = useQuery({
    queryKey: ["my-roles", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as string);
    },
  });
  const roles = q.data ?? [];
  const isOwner = roles.includes("owner");
  return { isOwner, isAdmin: isOwner || roles.includes("admin"), loading: q.isLoading };
}
