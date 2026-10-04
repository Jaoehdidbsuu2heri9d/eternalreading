/** Eternal Coins: saldo e histórico (somente leitura; mudanças só pelo banco). */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const SOURCE_LABEL: Record<string, string> = {
  subscription: "Bônus de assinatura", purchase: "Compra na Loja", admin: "Ajuste da equipe", refund: "Reembolso", event: "Evento",
};
export const formatCoins = (n: number) => n.toLocaleString("pt-BR");

export function useWallet(userId: string | undefined) {
  return useQuery({
    queryKey: ["wallet", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("coin_wallets").select("balance, earned, spent").eq("user_id", userId!).maybeSingle();
      return data ?? { balance: 0, earned: 0, spent: 0 };
    },
  });
}

export function useCoinHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ["coin-history", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("coin_transactions")
        .select("id, amount, balance_after, source, reason, created_at").eq("user_id", userId!)
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
}

/** Mensagens amigáveis para erros vindos do banco. */
export function shopError(msg: string): string {
  if (msg.includes("insufficient")) return "Saldo de Eternal Coins insuficiente.";
  if (msg.includes("plan required")) return "Este item exige um plano Eternal.";
  if (msg.includes("level required")) return "Você ainda não tem o nível necessário.";
  if (msg.includes("already owned")) return "Você já possui este item.";
  if (msg.includes("sold out")) return "Item esgotado.";
  if (msg.includes("unavailable")) return "Item fora do período de venda.";
  return "Não foi possível concluir a compra.";
}
