import { describe, expect, it } from "vitest";
import {
  compareLatestMonth,
  recoveryScenario,
} from "../src/domain/intelligence";
import { calculateDashboard } from "../src/domain/finance";
import { demoData } from "../src/data/demo";
import type { Filters } from "../src/domain/types";
const filters: Filters = {
  startMonth: "2026-01",
  endMonth: "2026-08",
  unitId: "all",
  payerId: "all",
};

describe("comparação mensal explicável", () => {
  it("compara último mês e anterior preservando unidade/pagador, mesmo fora do mês inicial", () => {
    const selected = {
      ...filters,
      startMonth: "2026-08",
      unitId: "u-norte",
      payerId: "p-vita",
    };
    const actual = compareLatestMonth(demoData, selected, "2026-01");
    const july = calculateDashboard(demoData, {
      ...selected,
      startMonth: "2026-07",
      endMonth: "2026-07",
    });
    const august = calculateDashboard(demoData, selected);
    expect(actual.available).toBe(true);
    expect(actual.previousMonth).toBe("2026-07");
    expect(actual.billed?.previous).toBe(july.metrics.billedCents);
    expect(actual.billed?.current).toBe(august.metrics.billedCents);
    expect(actual.received?.difference).toBe(
      august.metrics.receivedCents - july.metrics.receivedCents,
    );
  });
  it("não transforma histórico ausente nem mês parcial em comparação", () => {
    const january = compareLatestMonth(
      demoData,
      { ...filters, endMonth: "2026-01" },
      "2026-01",
    );
    expect(january.available).toBe(false);
    expect(january.previousMonth).toBe("2025-12");
    expect(january.billed).toBeNull();
    const partial = compareLatestMonth(
      { ...demoData, snapshotDate: "2026-08-15" },
      filters,
      "2026-01",
    );
    expect(partial.available).toBe(false);
    expect(partial.reason).toContain("incompleto");
  });
  it("retorna variação percentual nula quando o denominador é zero", () => {
    const empty = { ...demoData, invoices: [], events: [] };
    const result = compareLatestMonth(empty, filters, "2026-01");
    expect(result.billed?.current).toBe(0);
    expect(result.billed?.changePct).toBeNull();
  });
});
describe("cenário de recuperação", () => {
  it("reconcilia as duas parcelas exclusivas em centavos e respeita extremos", () => {
    expect(recoveryScenario(101, 203, 50, 50).additionalCashCents).toBe(153);
    expect(recoveryScenario(10000, 2500, 0, 0).additionalCashCents).toBe(0);
    expect(recoveryScenario(10000, 2500, 100, 100).additionalCashCents).toBe(
      12500,
    );
    expect(recoveryScenario(0, 0, 30, 100).additionalCashCents).toBe(0);
  });
  it("rejeita valores inválidos em vez de exibir previsões falsas", () => {
    expect(() => recoveryScenario(100, 200, 101, 0)).toThrow(RangeError);
    expect(() => recoveryScenario(-1, 200, 0, 0)).toThrow(RangeError);
    expect(() => recoveryScenario(100, 200, NaN, 0)).toThrow(RangeError);
    expect(() => recoveryScenario(1.2, 200, 0, 0)).toThrow(RangeError);
  });
});
