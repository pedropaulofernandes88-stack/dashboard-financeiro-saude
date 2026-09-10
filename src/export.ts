import type { Dashboard, Filters } from "./domain/types";

/** CSV with UTF-8 BOM, pt-BR decimal delimiter and formula-injection protection. */
export function csvCell(value: string | number): string {
  let text =
    typeof value === "number" ? String(value).replace(".", ",") : value;
  if (typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(text))
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function toCsv(rows: (string | number)[][]): string {
  return "\ufeff" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}
export function dashboardCsv(
  dashboard: Dashboard,
  filters: Filters,
  page: string,
): string {
  const context: (string | number)[][] = [
    ["PULSO — DADOS SINTÉTICOS / DEMONSTRAÇÃO"],
    [
      "Posição",
      dashboard.asOf,
      "Período",
      filters.startMonth,
      filters.endMonth,
      "Unidade",
      filters.unitId,
      "Pagador",
      filters.payerId,
    ],
  ];
  if (page === "receivables" || page === "glosas") {
    const positions = dashboard.positions.filter((item) =>
      page === "glosas" ? item.disputedCents > 0 : item.openCents > 0,
    );
    return toCsv([
      ...context,
      [
        "Conta",
        "Unidade",
        "Pagador",
        "Serviço",
        "Faturamento",
        "Vencimento",
        "Faturado (R$)",
        "Pago (R$)",
        "Baixado (R$)",
        "Em aberto (R$)",
        "Em disputa (R$)",
        "Dias de atraso",
        "Situação",
      ],
      ...positions.map((item) => [
        item.id,
        item.unitName,
        item.payerName,
        item.service,
        item.billedDate,
        item.dueDate,
        item.amountCents / 100,
        item.paidCents / 100,
        item.writtenOffCents / 100,
        item.openCents / 100,
        item.disputedCents / 100,
        item.overdueDays,
        item.status,
      ]),
    ]);
  }
  if (page === "costs") {
    return toCsv([
      ...context,
      ["Categoria", "Custo (R$)"],
      ...dashboard.costCategories.map((item) => [
        item.name,
        item.amountCents / 100,
      ]),
      [
        "Total",
        dashboard.metrics.costCents === null
          ? "Não apurado para este pagador"
          : dashboard.metrics.costCents / 100,
      ],
    ]);
  }
  return toCsv([
    ...context,
    [
      "Mês",
      "Faturado (R$)",
      "Recebido (R$)",
      "Custo (R$)",
      "Meta faturamento (R$)",
      "Resultado gerencial (R$)",
    ],
    ...dashboard.monthly.map((row) => [
      row.month,
      row.billedCents / 100,
      row.receivedCents / 100,
      dashboard.metrics.costCents === null
        ? "Não apurado"
        : row.costCents / 100,
      dashboard.metrics.billedTargetCents === null
        ? "Não apurado"
        : row.targetCents / 100,
      dashboard.metrics.resultCents === null
        ? "Não apurado"
        : row.resultCents / 100,
    ]),
  ]);
}
export function downloadCsv(content: string, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
