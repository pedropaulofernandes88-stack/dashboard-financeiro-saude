import { describe, expect, it } from "vitest";
import { healthDemo } from "../src/data/health-demo";
import { demoData } from "../src/data/demo";
import { calculateHealth, validateHealthData } from "../src/domain/health";
import type { Dataset, Filters } from "../src/domain/types";

const allFilters: Filters = {
  startMonth: "2026-01",
  endMonth: "2026-08",
  unitId: "all",
  payerId: "all",
};

describe("motor de inteligência de saúde", () => {
  it("mantém extensão assistencial íntegra, conciliada e sem dados pessoais", () => {
    expect(validateHealthData(demoData, healthDemo)).toEqual([]);
    expect(healthDemo.accounts).toHaveLength(demoData.invoices.length);
    expect(
      healthDemo.accounts.every((account) =>
        account.internalCode.startsWith("INT-"),
      ),
    ).toBe(true);
    const particular = new Set(
      demoData.invoices
        .filter((invoice) => invoice.payerId === "p-particular")
        .map((invoice) => invoice.id),
    );
    expect(
      healthDemo.glosaCases.some((item) => particular.has(item.invoiceId)),
    ).toBe(false);
  });

  it("mapeia cada serviço ao perfil clínico correto e preserva o checklist da emissão", () => {
    const expectedSpecialty: Record<string, string> = {
      "Consulta especializada": "Cardiologia",
      "Exame de imagem": "Diagnóstico por imagem",
      "Procedimento ambulatorial": "Ortopedia",
      "Terapia assistida": "Fisioterapia",
    };
    demoData.invoices.forEach((invoice) => {
      const account = healthDemo.accounts.find(
        (item) => item.invoiceId === invoice.id,
      );
      expect(account?.specialty).toBe(expectedSpecialty[invoice.service]);
      expect(
        account?.documents.every(
          (document) => document.scope === "Checklist da emissão",
        ),
      ).toBe(true);
    });
  });

  it("expõe contrato demonstrativo e usa os mesmos dias para submissão e resposta", () => {
    const toDays = (from: string, to: string) =>
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000;
    healthDemo.glosaCases.forEach((item) => {
      expect(item.contractId).toMatch(/^DEMO-/);
      expect(toDays(item.notificationAt, item.contractualDeadline)).toBe(
        item.contractualDays,
      );
      if (item.submittedAt && item.responseDueDate)
        expect(toDays(item.submittedAt, item.responseDueDate)).toBe(
          item.contractualDays,
        );
    });
  });

  it("concilia cada estágio e não trata reversão como recebimento em caixa", () => {
    const analytics = calculateHealth(demoData, healthDemo, allFilters);
    const stages = analytics.glosa;
    expect(stages.registeredCents).toBe(
      stages.disputedCents +
        stages.recoveredCashCents +
        stages.writtenOffCents +
        stages.reversedAwaitingCashCents,
    );
    expect(
      analytics.cases.some(
        (item) => item.reversedCents > 0 && item.recoveredCashCents === 0,
      ),
    ).toBe(true);
  });

  it("calcula taxas de glosa, reversão e recuperação na mesma coorte faturada", () => {
    const analytics = calculateHealth(demoData, healthDemo, allFilters);
    const denominator = analytics.summary.billedCents;
    const cohort = analytics.cases.filter(
      (item) => item.registeredDate >= "2026-01-01",
    );
    expect(analytics.summary.cohortGlosaRatePct).toBeCloseTo(
      (cohort.reduce((total, item) => total + item.glosedCents, 0) /
        denominator) *
        100,
    );
    expect(analytics.summary.cohortReversalRatePct).toBeCloseTo(
      (cohort.reduce((total, item) => total + item.reversedCents, 0) /
        denominator) *
        100,
    );
    expect(analytics.summary.cohortCashRecoveryRatePct).toBeCloseTo(
      (cohort.reduce((total, item) => total + item.recoveredCashCents, 0) /
        denominator) *
        100,
    );
  });

  it("aplica corte histórico e filtros de unidade e pagador", () => {
    const january = calculateHealth(demoData, healthDemo, {
      ...allFilters,
      startMonth: "2026-01",
      endMonth: "2026-01",
    });
    const whole = calculateHealth(demoData, healthDemo, allFilters);
    const unit = calculateHealth(demoData, healthDemo, {
      ...allFilters,
      unitId: "u-central",
    });
    const payer = calculateHealth(demoData, healthDemo, {
      ...allFilters,
      payerId: "p-vita",
    });
    expect(january.asOf).toBe("2026-01-31");
    expect(
      january.cases.every((item) =>
        item.events.every((event) => event.date <= january.asOf),
      ),
    ).toBe(true);
    expect(unit.summary.billedCents).toBeLessThan(whole.summary.billedCents);
    expect(
      payer.cases.every((item) => item.payerName === "Convênio Vida Clara"),
    ).toBe(true);
  });

  it("substitui prazo de submissão por prazo de resposta em caso enviado", () => {
    const analytics = calculateHealth(demoData, healthDemo, allFilters);
    const submitted = analytics.cases.find(
      (item) =>
        item.submittedAt &&
        item.dueDate < analytics.asOf &&
        item.underDiscussionCents > 0,
    );
    expect(submitted).toBeDefined();
    expect(submitted?.status).not.toBe("A preparar");
    expect(submitted?.priority.deadlineType).toBe("Resposta");
  });

  it("mantém Pareto limitado a 100% no filtro de agosto e separa fluxo de notificações do estoque", () => {
    const august = calculateHealth(demoData, healthDemo, {
      ...allFilters,
      startMonth: "2026-08",
    });
    const last = august.paretoReasons.at(-1);
    expect(last?.cumulativePct ?? 0).toBeLessThanOrEqual(100);
    expect(last?.cumulativePct ?? 0).toBeCloseTo(100);
    expect(august.glosa.periodNotifications.count).toBeLessThanOrEqual(
      august.glosa.registeredCount,
    );
  });

  it("exige submissão anterior a toda reversão ou baixa demonstrativa", () => {
    healthDemo.glosaCases.forEach((item) => {
      const firstResolution = demoData.events
        .filter(
          (event) =>
            event.invoiceId === item.invoiceId &&
            (event.type === "glosa_reversal" || event.type === "write_off"),
        )
        .sort((a, b) => a.date.localeCompare(b.date))[0];
      if (firstResolution) {
        expect(item.submittedAt).toBeDefined();
        expect((item.submittedAt as string) <= firstResolution.date).toBe(true);
      }
    });
  });

  it("rejeita duas glosas na mesma conta sem alocação explícita", () => {
    const duplicate = {
      ...healthDemo,
      glosaCases: [
        ...healthDemo.glosaCases,
        { ...healthDemo.glosaCases[0], id: "GC-duplicado" },
      ],
    };
    expect(validateHealthData(demoData, duplicate).join("\n")).toMatch(
      /Mais de uma glosa sem alocação/,
    );
  });

  it("rejeita coberturas incompletas, eventos duplicados e datas ou protocolo inválidos", () => {
    const missingAccount = {
      ...healthDemo,
      accounts: healthDemo.accounts.slice(1),
    };
    expect(validateHealthData(demoData, missingAccount).join("\n")).toMatch(
      /Fatura sem conta assistencial/,
    );
    const secondGlosa = {
      ...demoData,
      events: [
        ...demoData.events,
        {
          ...demoData.events.find((event) => event.type === "glosa")!,
          id: "E-second-glosa",
        },
      ],
    };
    expect(validateHealthData(secondGlosa, healthDemo).join("\n")).toMatch(
      /Mais de um evento de glosa/,
    );
    const malformed = {
      ...healthDemo,
      glosaCases: healthDemo.glosaCases.map((item, index) =>
        index === 0
          ? {
              ...item,
              notificationAt: "2026-02-30",
              submittedAt: "2026-01-01",
              protocol: "",
            }
          : item,
      ),
    };
    expect(validateHealthData(demoData, malformed).join("\n")).toMatch(
      /Notificação incompatível/,
    );
    expect(validateHealthData(demoData, malformed).join("\n")).toMatch(
      /Submissão anterior/,
    );
  });

  it("mantém baixa parcial e valor liberado em filas distintas, com linha do tempo ordenada", () => {
    const sourceCase = healthDemo.glosaCases.find(
      (item) => item.submittedAt && item.submittedAt <= "2026-08-31",
    )!;
    const sourceEvent = demoData.events.find(
      (event) => event.id === sourceCase.eventId,
    )!;
    const data = {
      ...demoData,
      events: demoData.events
        .filter((event) => event.invoiceId !== sourceCase.invoiceId)
        .concat(
          { ...sourceEvent, amountCents: 1_000 },
          {
            id: "R-partial",
            invoiceId: sourceCase.invoiceId,
            date: "2026-02-08",
            type: "glosa_reversal" as const,
            amountCents: 700,
          },
          {
            id: "B-partial",
            invoiceId: sourceCase.invoiceId,
            date: "2026-02-09",
            type: "write_off" as const,
            amountCents: 300,
          },
          {
            id: "P-partial",
            invoiceId: sourceCase.invoiceId,
            date: "2026-02-10",
            type: "payment" as const,
            amountCents: 400,
            recoveredCents: 400,
          },
        ),
    };
    const analytics = calculateHealth(data, healthDemo, allFilters);
    const item = analytics.cases.find((entry) => entry.id === sourceCase.id)!;
    expect(item.status).toBe("Liberada a receber");
    expect(item.releasedToReceiveCents).toBe(300);
    expect(
      analytics.queues.releasedToReceive.some((entry) => entry.id === item.id),
    ).toBe(true);
    expect(item.recommendation).toMatch(/baixa parcial registrada/i);
    expect(item.events.map((event) => event.type)).toEqual([
      "glosa",
      "appeal_submission",
      "glosa_reversal",
      "write_off",
      "payment",
    ]);
    expect(
      item.events.find((event) => event.type === "payment")?.recoveredCents,
    ).toBe(400);

    // A partial loss must not hide an unresolved dispute or stop its deadline alerts.
    const stillDisputed = {
      ...data,
      events: data.events.filter(
        (event) => event.id !== "R-partial" && event.id !== "P-partial",
      ),
    };
    const pending = calculateHealth(
      stillDisputed,
      healthDemo,
      allFilters,
    ).cases.find((entry) => entry.id === sourceCase.id)!;
    expect(pending.status).toBe("Em análise");
    expect(pending.underDiscussionCents).toBe(700);
    expect(pending.priority.dueState).toBe("Vencido");
    expect(pending.recommendation).not.toContain("Encerrada");

    // Closed with both cash recovery and a final loss: never label fully recovered.
    const settled = {
      ...data,
      events: data.events.map((event) =>
        event.id === "P-partial"
          ? { ...event, amountCents: 700, recoveredCents: 700 }
          : event,
      ),
    };
    const closed = calculateHealth(settled, healthDemo, allFilters).cases.find(
      (entry) => entry.id === sourceCase.id,
    )!;
    expect(closed.status).toBe("Baixada");
    expect(closed.recommendation).toMatch(/baixa parcial e recuperação/i);
    expect(closed.priority.dueState).toBe("Sem prazo");
  });

  it("não deixa fatos posteriores atravessarem a data de corte", () => {
    const laterSnapshot: Dataset = { ...demoData, snapshotDate: "2026-09-30" };
    const result = calculateHealth(laterSnapshot, healthDemo, {
      ...allFilters,
      endMonth: "2026-08",
    });
    expect(result.asOf).toBe("2026-08-31");
    expect(
      result.cases.every((item) =>
        item.events.every((event) => event.date <= result.asOf),
      ),
    ).toBe(true);
  });

  it("não exibe caso com notificação inválida ou futura, mesmo se a fonte não foi validada antes", () => {
    const invalidNotification = {
      ...healthDemo,
      glosaCases: healthDemo.glosaCases.map((item, index) =>
        index === 0 ? { ...item, notificationAt: "2026-12-01" } : item,
      ),
    };
    const baseline = calculateHealth(demoData, healthDemo, allFilters);
    const safe = calculateHealth(demoData, invalidNotification, allFilters);
    expect(safe.cases).toHaveLength(baseline.cases.length - 1);
  });
});
