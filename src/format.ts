const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});
export function money(cents: number | null): string {
  return cents === null ? "Não apurado" : currency.format(cents / 100);
}
export function moneyCompact(cents: number | null): string {
  if (cents === null) return "Não apurado";
  const reais = cents / 100;
  const abs = Math.abs(reais);
  const divisor = abs >= 1e6 ? 1e6 : abs >= 1e3 ? 1e3 : 1;
  const suffix = divisor === 1e6 ? " mi" : divisor === 1e3 ? " mil" : "";
  return `R$ ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(reais / divisor)}${suffix}`;
}
export function percent(value: number | null): string {
  return value === null
    ? "Não apurado"
    : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
}
export function dateLabel(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${date.slice(0, 10)}T00:00:00Z`),
  );
}
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  })
    .format(new Date(`${month.slice(0, 7)}-01T00:00:00Z`))
    .replace(".", "");
}
export function delta(actual: number, target: number | null): string {
  if (!target) return "Meta não disponível neste recorte";
  const value = ((actual - target) / target) * 100;
  return `${value >= 0 ? "+" : ""}${percent(value)} frente à meta`;
}
