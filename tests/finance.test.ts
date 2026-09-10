import { describe, expect, it } from "vitest";
import {
  calculateDashboard,
  getInvoicePosition,
  validateDataset,
} from "../src/domain/finance";
import { demoData } from "../src/data/demo";
import type { Dataset, Filters } from "../src/domain/types";

const allFilters: Filters = {
  startMonth: "2026-01",
  endMonth: "2026-08",
  unitId: "all",
  payerId: "all",
};

function sample(): Dataset {
  return {
    snapshotDate: "2026-02-28",
    units: [{ id: "u", name: "Unidade teste" }],
    payers: [{ id: "p", name: "Pagador teste" }],
    invoices: [
      {
        id: "old",
        unitId: "u",
        payerId: "p",
        service: "Consulta",
        serviceDate: "2026-01-01",
        billedDate: "2026-01-02",
        dueDate: "2026-01-31",
        amountCents: 10_000,
      },
      {
        id: "now",
        unitId: "u",
        payerId: "p",
        service: "Exame",
        serviceDate: "2026-02-01",
        billedDate: "2026-02-02",
        dueDate: "2026-02-28",
        amountCents: 20_000,
      },
      {
        id: "dispute",
        unitId: "u",
        payerId: "p",
        service: "Terapia",
        serviceDate: "2026-02-02",
        billedDate: "2026-02-03",
        dueDate: "2026-02-15",
        amountCents: 12_000,
      },
    ],
    events: [
      {
        id: "pay-old",
        invoiceId: "old",
        date: "2026-02-10",
        type: "payment",
        amountCents: 4_000,
      },
      {
        id: "pay-now",
        invoiceId: "now",
        date: "2026-02-20",
        type: "payment",
        amountCents: 20_000,
      },
      {
        id: "glosa",
        invoiceId: "dispute",
        date: "2026-02-08",
        type: "glosa",
        amountCents: 3_000,
        reason: "Documentação",
      },
      {
        id: "future",
        invoiceId: "old",
        date: "2026-03-01",
        type: "payment",
        amountCents: 6_000,
      },
    ],
    costs: [
      {
        id: "cost",
        unitId: "u",
        month: "2026-02",
        category: "Pessoal",
        amountCents: 8_000,
      },
    ],
    targets: [
      {
        unitId: "u",
        month: "2026-02",
        billedCents: 25_000,
        receivedCents: 20_000,
        costCents: 9_000,
      },
    ],
  };
}

describe("motor financeiro", () => {
  it("gera um conjunto demonstrativo íntegro, com data de corte e volume planejados", () => {
    expect(demoData.invoices).toHaveLength(384);
    expect(demoData.snapshotDate).toBe("2026-08-31");
    expect(validateDataset(demoData)).toEqual([]);
    expect(
      demoData.events.every((event) => event.date <= demoData.snapshotDate),
    ).toBe(true);
    expect(
      demoData.events.some((event) => (event.recoveredCents ?? 0) > 0),
    ).toBe(true);
  });

  it("mede recebimento pelo pagamento, inclusive de conta faturada antes do período, e exclui futuro", () => {
    const dashboard = calculateDashboard(sample(), {
      ...allFilters,
      startMonth: "2026-02",
      endMonth: "2026-02",
    });
    expect(dashboard.metrics.billedCents).toBe(32_000);
    expect(dashboard.metrics.receivedCents).toBe(24_000);
    expect(dashboard.metrics.openCents).toBe(18_000);
    expect(dashboard.metrics.overdueCents).toBe(18_000);
  });

  it("usa a posição no último dia do período e não mistura agosto em janeiro", () => {
    const january = calculateDashboard(demoData, {
      ...allFilters,
      startMonth: "2026-01",
      endMonth: "2026-01",
    });
    const august = calculateDashboard(demoData, allFilters);
    expect(january.asOf).toBe("2026-01-31");
    expect(january.monthly).toHaveLength(1);
    expect(
      january.positions.every(
        (position) => position.billedDate <= january.asOf,
      ),
    ).toBe(true);
    expect(january.positions.length).toBeLessThan(august.positions.length);
    expect(
      calculateDashboard(sample(), {
        ...allFilters,
        startMonth: "2026-01",
        endMonth: "2026-01",
      }).metrics.receivedCents,
    ).toBe(0);
  });

  it("mantém pagamento parcial e glosa no aberto; a posição ignora eventos futuros", () => {
    const data = sample();
    const old = getInvoicePosition(data, data.invoices[0], data.snapshotDate);
    const dispute = getInvoicePosition(
      data,
      data.invoices[2],
      data.snapshotDate,
    );
    expect(old.paidCents).toBe(4_000);
    expect(old.openCents).toBe(6_000);
    expect(dispute.openCents).toBe(12_000);
    expect(dispute.disputedCents).toBe(3_000);
    expect(dispute.status).toBe("Em disputa");
  });

  it("mede prazo de pagamento para conta antiga quitada no mês e limita recurso ao saldo aberto", () => {
    const data = sample();
    data.events = data.events
      .filter((event) => event.id !== "future")
      .concat({
        id: "pay-old-final",
        invoiceId: "old",
        date: "2026-02-11",
        type: "payment",
        amountCents: 6_000,
      });
    const dashboard = calculateDashboard(data, {
      ...allFilters,
      startMonth: "2026-02",
      endMonth: "2026-02",
    });
    expect(dashboard.metrics.averageDaysToPay).toBe(29);
    data.events.push({
      id: "pay-dispute",
      invoiceId: "dispute",
      date: "2026-02-21",
      type: "payment",
      amountCents: 12_000,
    });
    expect(
      getInvoicePosition(data, data.invoices[2], data.snapshotDate)
        .disputedCents,
    ).toBe(0);
  });

  it("reconcilia visão filtrada por unidade e pagador e deixa custos/metas nulos por pagador", () => {
    const whole = calculateDashboard(demoData, allFilters);
    const byUnit = demoData.units.map((unit) =>
      calculateDashboard(demoData, { ...allFilters, unitId: unit.id }),
    );
    expect(whole.metrics.billedCents).toBe(
      byUnit.reduce((sum, item) => sum + item.metrics.billedCents, 0),
    );
    expect(whole.metrics.receivedCents).toBe(
      byUnit.reduce((sum, item) => sum + item.metrics.receivedCents, 0),
    );
    const payer = calculateDashboard(demoData, {
      ...allFilters,
      payerId: "p-particular",
    });
    expect(payer.metrics.costCents).toBeNull();
    expect(payer.metrics.resultCents).toBeNull();
    expect(payer.metrics.billedTargetCents).toBeNull();
    expect(payer.costCategories).toEqual([]);
    expect(whole.costCategories.every((bucket) => bucket.count > 0)).toBe(true);
    expect(whole.glosaReasons.every((bucket) => bucket.count > 0)).toBe(true);
  });

  it("calcula glosa por coorte, baixa no resultado, aging inclusivo e metas alinhadas", () => {
    const dashboard = calculateDashboard(sample(), {
      ...allFilters,
      startMonth: "2026-02",
      endMonth: "2026-02",
    });
    expect(dashboard.metrics.glosaCents).toBe(3_000);
    expect(dashboard.metrics.glosaRatePct).toBeCloseTo((3_000 / 32_000) * 100);
    expect(dashboard.metrics.resultCents).toBe(24_000);
    expect(dashboard.metrics.billedTargetCents).toBe(25_000);
    expect(dashboard.monthly[0].billedCents).toBe(
      dashboard.metrics.billedCents,
    );
    expect(
      dashboard.aging.find((bucket) => bucket.name === "A vencer")?.amountCents,
    ).toBe(0);
    expect(
      dashboard.aging.find((bucket) => bucket.name === "1–30 dias")
        ?.amountCents,
    ).toBe(18_000);
  });

  it("preserva a taxa da primeira glosa temporal quando a ordem dos eventos muda", () => {
    const data = sample();
    data.events = data.events
      .filter((event) => event.id !== "glosa")
      .concat(
        {
          id: "glosa-late",
          invoiceId: "dispute",
          date: "2026-02-12",
          type: "glosa",
          amountCents: 2_000,
        },
        {
          id: "glosa-early",
          invoiceId: "dispute",
          date: "2026-02-06",
          type: "glosa",
          amountCents: 1_000,
        },
      );
    const reversed: Dataset = { ...data, events: [...data.events].reverse() };
    const filters = {
      ...allFilters,
      startMonth: "2026-02",
      endMonth: "2026-02",
    };
    const expectedRate = (1_000 / 32_000) * 100;
    expect(calculateDashboard(data, filters).metrics.glosaRatePct).toBeCloseTo(
      expectedRate,
    );
    expect(
      calculateDashboard(reversed, filters).metrics.glosaRatePct,
    ).toBeCloseTo(expectedRate);
  });

  it("retorna taxas e médias nulas quando não há divisor ou conta totalmente paga", () => {
    const data = sample();
    data.invoices = [
      {
        ...data.invoices[0],
        billedDate: "2026-01-02",
        serviceDate: "2026-01-01",
      },
    ];
    data.events = [];
    data.costs = [];
    data.targets = [];
    const dashboard = calculateDashboard(data, {
      ...allFilters,
      startMonth: "2026-02",
      endMonth: "2026-02",
    });
    expect(dashboard.metrics.glosaRatePct).toBeNull();
    expect(dashboard.metrics.marginPct).toBeNull();
    expect(dashboard.metrics.averageDaysToPay).toBeNull();
  });

  it("rejeita filtros fora do intervalo e dados temporalmente ou economicamente impossíveis", () => {
    expect(() =>
      calculateDashboard(demoData, {
        ...allFilters,
        startMonth: "2026-08",
        endMonth: "2026-01",
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateDashboard(demoData, {
        ...allFilters,
        startMonth: "2026-09",
        endMonth: "2026-09",
      }),
    ).toThrow(RangeError);
    const data = sample();
    data.events = [
      {
        id: "glosa-late",
        invoiceId: "old",
        date: "2026-02-05",
        type: "glosa",
        amountCents: 12_000,
      },
      {
        id: "reversal-early",
        invoiceId: "old",
        date: "2026-02-04",
        type: "glosa_reversal",
        amountCents: 1_000,
      },
      {
        id: "glosa",
        invoiceId: "now",
        date: "2026-02-05",
        type: "glosa",
        amountCents: 6_000,
      },
      {
        id: "reversal",
        invoiceId: "now",
        date: "2026-02-06",
        type: "glosa_reversal",
        amountCents: 4_000,
      },
      {
        id: "writeoff",
        invoiceId: "now",
        date: "2026-02-07",
        type: "write_off",
        amountCents: 3_000,
      },
      {
        id: "recovered",
        invoiceId: "dispute",
        date: "2026-02-09",
        type: "payment",
        amountCents: 5_000,
        recoveredCents: 5_000,
      },
      {
        id: "unknown",
        invoiceId: "dispute",
        date: "2026-02-10",
        type: "refund" as never,
        amountCents: 1_000,
      },
    ];
    data.units.push({ id: "u", name: "Unidade repetida" });
    data.payers.push({ id: "p", name: "Pagador repetido" });
    data.costs.push({ ...data.costs[0] });
    data.targets.push({ ...data.targets[0] });
    const errors = validateDataset(data).join("\n");
    expect(errors).toMatch(/Unidade duplicada/);
    expect(errors).toMatch(/Pagador duplicado/);
    expect(errors).toMatch(/Custo duplicado/);
    expect(errors).toMatch(/Meta duplicada/);
    expect(errors).toMatch(/Reversão acima da disputa/);
    expect(errors).toMatch(/Baixa acima da disputa/);
    expect(errors).toMatch(/Recuperação acima das reversões/);
    expect(errors).toMatch(/Disputa acima do saldo aberto/);
    expect(errors).toMatch(/Tipo inválido/);
  });
});
