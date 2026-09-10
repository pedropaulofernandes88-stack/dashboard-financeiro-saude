import { describe, expect, it } from "vitest";
import { csvCell, dashboardCsv, toCsv } from "../src/export";
import { calculateDashboard } from "../src/domain/finance";
import { demoData } from "../src/data/demo";
import type { Filters } from "../src/domain/types";
const filters: Filters = {
  startMonth: "2026-01",
  endMonth: "2026-08",
  unitId: "all",
  payerId: "all",
};

describe("CSV financeiro", () => {
  it("preserva centavos, aspas, acentuação, ponto e vírgula e quebras de linha", () => {
    expect(
      toCsv([
        ["Descrição", "Valor"],
        ['Conta; "teste"\nUnidade', 1234.56],
      ]),
    ).toBe(
      '\ufeff"Descrição";"Valor"\r\n"Conta; ""teste""\nUnidade";"1234,56"',
    );
  });
  it.each([
    '=HYPERLINK("x")',
    "+SUM(1)",
    "-2+3",
    "@SUM(1)",
    "  =1+1",
    "\t=1+1",
    "\r=1+1",
  ])("neutraliza fórmulas em campos de texto: %s", (value) => {
    expect(csvCell(value).startsWith("\"'")).toBe(true);
  });
  it("mantém números negativos como números e inclui origem e filtros", () => {
    expect(csvCell(-12.45)).toBe('"-12,45"');
    const csv = dashboardCsv(
      calculateDashboard(demoData, filters),
      filters,
      "overview",
    );
    expect(csv).toContain("DADOS SINTÉTICOS");
    expect(csv).toContain("2026-08-31");
    expect(csv).toContain("Resultado gerencial");
  });
  it("exporta o conjunto completo em aberto e não as contas liquidadas", () => {
    const dashboard = calculateDashboard(demoData, filters);
    const csv = dashboardCsv(dashboard, filters, "receivables");
    for (const position of dashboard.positions)
      expect(csv.includes(`"${position.id}"`)).toBe(position.openCents > 0);
  });
  it("não apresenta custo ou margem zero quando não há rateio por pagador", () => {
    const payerFilters = { ...filters, payerId: demoData.payers[0].id };
    const dashboard = calculateDashboard(demoData, payerFilters);
    expect(dashboardCsv(dashboard, payerFilters, "overview")).toContain(
      "Não apurado",
    );
    expect(dashboardCsv(dashboard, payerFilters, "costs")).toContain(
      "Não apurado para este pagador",
    );
  });
});
