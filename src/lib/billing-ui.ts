/** Rótulos de assinatura/pagamento usados nas telas. */
export const SUB_STATUS_LABEL: Record<string, string> = {
  active: "Ativa", trialing: "Em teste", pending: "Aguardando pagamento", past_due: "Pagamento atrasado",
  canceled: "Cancelada (sem renovação)", expired: "Expirada", paused: "Pausada",
};
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente", CONFIRMED: "Confirmado", RECEIVED: "Recebido", RECEIVED_IN_CASH: "Recebido",
  OVERDUE: "Atrasado", REFUNDED: "Estornado", REFUND_REQUESTED: "Estorno pedido", DELETED: "Removido",
  CHARGEBACK_REQUESTED: "Contestado",
};
export const METHOD_LABEL: Record<string, string> = { PIX: "PIX", CREDIT_CARD: "Cartão", BOLETO: "Boleto", UNDEFINED: "—" };
export const formatBRL = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
