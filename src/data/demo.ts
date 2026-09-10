import type {
  Cost,
  Dataset,
  FinancialEvent,
  Invoice,
  Target,
} from "../domain/types";

const SNAPSHOT = "2026-08-31";
const months = [
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
];
const units = [
  { id: "u-central", name: "Unidade Central" },
  { id: "u-norte", name: "Unidade Norte" },
  { id: "u-sul", name: "Unidade Sul" },
];
const payers = [
  { id: "p-vita", name: "Convênio Vida Clara" },
  { id: "p-plena", name: "Saúde Plena" },
  { id: "p-municipal", name: "Rede Municipal Modelo" },
  { id: "p-particular", name: "Particular" },
];
const services = [
  "Consulta especializada",
  "Exame de imagem",
  "Procedimento ambulatorial",
  "Terapia assistida",
];
const categories = [
  "Pessoal assistencial",
  "Materiais e medicamentos",
  "Serviços de diagnóstico",
  "Estrutura e utilidades",
];

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function eventIfVisible(events: FinancialEvent[], event: FinancialEvent): void {
  if (event.date <= SNAPSHOT) events.push(event);
}

const invoices: Invoice[] = [];
const events: FinancialEvent[] = [];
let sequence = 1;
for (let monthIndex = 0; monthIndex < months.length; monthIndex += 1) {
  for (let unitIndex = 0; unitIndex < units.length; unitIndex += 1) {
    for (let row = 0; row < 16; row += 1) {
      const id = `F-${String(sequence).padStart(4, "0")}`;
      const payerIndex = (row + unitIndex + monthIndex) % payers.length;
      const billedDate = `${months[monthIndex]}-${String(4 + ((row * 3 + unitIndex) % 20)).padStart(2, "0")}`;
      const amountCents =
        16_000 +
        ((row * 7_300 + unitIndex * 4_100 + monthIndex * 2_900) % 92_000);
      const invoice: Invoice = {
        id,
        unitId: units[unitIndex].id,
        payerId: payers[payerIndex].id,
        service: services[(row + monthIndex) % services.length],
        serviceDate: addDays(billedDate, -2),
        billedDate,
        dueDate: addDays(billedDate, payerIndex === 3 ? 15 : 30),
        amountCents,
      };
      invoices.push(invoice);
      const glosaStep = Math.floor(sequence / 6);
      const glosa =
        sequence % 6 === 0
          ? Math.round(amountCents * (0.12 + (glosaStep % 3) * 0.03))
          : 0;
      const writtenOff = glosa > 0 && sequence % 18 === 0 ? glosa : 0;
      const reverses = glosa > 0 && sequence % 12 === 0 && writtenOff === 0;
      if (glosa)
        eventIfVisible(events, {
          id: `E-${id}-G`,
          invoiceId: id,
          date: addDays(billedDate, 6),
          type: "glosa",
          amountCents: glosa,
          reason: [
            "Documentação incompleta",
            "Divergência de autorização",
            "Tabela contratual",
          ][glosaStep % 3],
        });
      if (writtenOff)
        eventIfVisible(events, {
          id: `E-${id}-B`,
          invoiceId: id,
          date: addDays(billedDate, 25),
          type: "write_off",
          amountCents: writtenOff,
          reason: "Baixa definitiva após análise",
        });
      if (reverses)
        eventIfVisible(events, {
          id: `E-${id}-R`,
          invoiceId: id,
          date: addDays(billedDate, 20),
          type: "glosa_reversal",
          amountCents: glosa,
          reason: "Recurso aceito",
        });
      // A glosa que ainda não foi revertida permanece em aberto e não recebe pagamento neste modelo.
      const payable =
        amountCents -
        writtenOff -
        (glosa > 0 && !reverses && writtenOff === 0 ? glosa : 0);
      // Reversed glosas always receive a later payment, allowing the demo to show recovery in cash.
      if (sequence % 4 !== 0 || reverses) {
        const firstPayment = Math.floor(
          payable * (sequence % 5 === 0 ? 0.45 : 0.6),
        );
        eventIfVisible(events, {
          id: `E-${id}-P1`,
          invoiceId: id,
          date: addDays(billedDate, 12),
          type: "payment",
          amountCents: firstPayment,
        });
        if (sequence % 3 !== 1) {
          const finalDate = addDays(billedDate, reverses ? 28 : 34);
          eventIfVisible(events, {
            id: `E-${id}-P2`,
            invoiceId: id,
            date: finalDate,
            type: "payment",
            amountCents: payable - firstPayment,
            recoveredCents: reverses
              ? Math.min(glosa, payable - firstPayment)
              : undefined,
          });
        }
      }
      sequence += 1;
    }
  }
}

const costs: Cost[] = [];
const targets: Target[] = [];
for (let monthIndex = 0; monthIndex < months.length; monthIndex += 1) {
  units.forEach((unit, unitIndex) => {
    const base = 540_000 + unitIndex * 74_000 + monthIndex * 13_500;
    categories.forEach((category, categoryIndex) => {
      const shares = [0.52, 0.19, 0.16, 0.13];
      costs.push({
        id: `C-${unit.id}-${months[monthIndex]}-${categoryIndex}`,
        unitId: unit.id,
        month: months[monthIndex],
        category,
        amountCents: Math.round(base * shares[categoryIndex]),
      });
    });
    targets.push({
      unitId: unit.id,
      month: months[monthIndex],
      billedCents: 720_000 + unitIndex * 95_000 + monthIndex * 16_000,
      receivedCents: 650_000 + unitIndex * 85_000 + monthIndex * 14_000,
      costCents: Math.round(base * 1.02),
    });
  });
}

export const demoData: Dataset = {
  invoices,
  events,
  costs,
  targets,
  units,
  payers,
  snapshotDate: SNAPSHOT,
};
