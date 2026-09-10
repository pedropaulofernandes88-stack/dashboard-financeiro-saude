import { describe, expect, it } from "vitest";
import { demoData } from "../src/data/demo";
import { healthDemo } from "../src/data/health-demo";
import { calculateHealth } from "../src/domain/health";
import { healthCsv } from "../src/health-export";
import type { Filters } from "../src/domain/types";
const filters: Filters = {
  startMonth: "2026-08",
  endMonth: "2026-08",
  unitId: "u-central",
  payerId: "all",
};
describe("exportação assistencial", () => {
  it("exporta todas e apenas contas do recorte com valor em reais e sem custo rateado fictício", () => {
    const analytics = calculateHealth(demoData, healthDemo, filters);
    const csv = healthCsv(analytics, filters, "intelligence");
    expect(csv.startsWith("\ufeff")).toBe(true);
    expect(csv.split("\r\n").length).toBe(analytics.accounts.length + 4);
    for (const account of analytics.accounts)
      expect(csv).toContain(`"${account.invoiceId}"`);
    expect(csv).not.toContain('"F-0001"');
    expect(csv).toContain('"u-central"');
    expect(csv).toContain("sem correspondência TUSS");
  });
  it("glosas exportam também casos anteriores ao início, conservam a identidade e a posição", () => {
    const analytics = calculateHealth(demoData, healthDemo, filters);
    const csv = healthCsv(analytics, filters, "glosas");
    expect(
      analytics.cases.some((item) => item.registeredDate < "2026-08-01"),
    ).toBe(true);
    expect(csv.split("\r\n").length).toBe(analytics.cases.length + 4);
    expect(csv).toContain("2026-08-31");
    expect(csv).toContain("anteriores ao mês inicial");
    for (const item of analytics.cases) expect(csv).toContain(`"${item.id}"`);
  });
  it("aplica proteção de fórmula também ao motivo e protocolo", () => {
    const analytics = calculateHealth(demoData, healthDemo, filters);
    const sample = {
      ...analytics,
      cases: [
        {
          ...analytics.cases[0],
          reason: '=HYPERLINK("x")',
          protocol: "@SUM(1)",
        },
      ],
    };
    const csv = healthCsv(sample, filters, "glosas");
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'@SUM(1)");
  });
});
