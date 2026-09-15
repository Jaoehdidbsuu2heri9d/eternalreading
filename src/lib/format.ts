/** Utilidades de formatação em português. */

export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  return date.toLocaleDateString("pt-BR");
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatChapterNumber(n: number | string): string {
  const value = typeof n === "string" ? Number(n) : n;
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(n);
}
