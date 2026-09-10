import type { HealthAccount, HealthData } from "../domain/health";
import { demoData } from "./demo";

const DAY = 86_400_000;
const addDays = (date: string, days: number) => {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};
const daysBetween = (from: string, to: string) =>
  Math.floor(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY,
  );

const clinicalProfiles: Record<
  string,
  {
    specialty: string;
    procedure: string;
    code: string;
    guideType: "Consulta" | "SADT" | "Procedimento ambulatorial";
    itemShares: { procedure: number; materials: number; medication: number };
  }
> = {
  "Consulta especializada": {
    specialty: "Cardiologia",
    procedure: "Consulta cardiológica",
    code: "INT-CARD-001",
    guideType: "Consulta",
    itemShares: { procedure: 0, materials: 0, medication: 0 },
  },
  "Exame de imagem": {
    specialty: "Diagnóstico por imagem",
    procedure: "Ultrassonografia abdominal",
    code: "INT-IMG-012",
    guideType: "SADT",
    itemShares: { procedure: 0.78, materials: 0.22, medication: 0 },
  },
  "Procedimento ambulatorial": {
    specialty: "Ortopedia",
    procedure: "Procedimento ambulatorial ortopédico",
    code: "INT-ORTO-021",
    guideType: "Procedimento ambulatorial",
    itemShares: { procedure: 0.62, materials: 0.18, medication: 0.07 },
  },
  "Terapia assistida": {
    specialty: "Fisioterapia",
    procedure: "Sessão de fisioterapia assistida",
    code: "INT-FISIO-008",
    guideType: "SADT",
    itemShares: { procedure: 0, materials: 0, medication: 0 },
  },
};

const accounts: HealthAccount[] = demoData.invoices.map((invoice, index) => {
  const profile = clinicalProfiles[invoice.service];
  if (!profile)
    throw new Error(`Serviço sem perfil assistencial: ${invoice.service}.`);
  const hasPendingDocument = index % 11 === 0 || index % 17 === 0;
  const procedureCents = Math.floor(
    invoice.amountCents * profile.itemShares.procedure,
  );
  const materialsCents = Math.floor(
    invoice.amountCents * profile.itemShares.materials,
  );
  const medicationCents = Math.floor(
    invoice.amountCents * profile.itemShares.medication,
  );
  const honorariaCents =
    invoice.amountCents - procedureCents - materialsCents - medicationCents;
  return {
    invoiceId: invoice.id,
    specialty: profile.specialty,
    procedure: profile.procedure,
    internalCode: profile.code,
    guideType: profile.guideType,
    guideNumber: `GUIA-${invoice.id.slice(2)}`,
    authorizationStatus:
      invoice.payerId === "p-particular"
        ? "Dispensado"
        : hasPendingDocument
          ? "Pendente"
          : "Autorizado",
    billingLagDays: daysBetween(invoice.serviceDate, invoice.billedDate),
    documents: [
      {
        label: "Guia de atendimento",
        status: "Conferido",
        scope: "Checklist da emissão",
      },
      {
        label: "Registro assistencial",
        status: hasPendingDocument ? "Pendente" : "Conferido",
        scope: "Checklist da emissão",
      },
      {
        label: "Autorização",
        status:
          invoice.payerId === "p-particular"
            ? "Não aplicável"
            : hasPendingDocument
              ? "Pendente"
              : "Conferido",
        scope: "Checklist da emissão",
      },
    ],
    items: [
      ...(honorariaCents
        ? [
            {
              kind: "Honorários" as const,
              label: "Honorários assistenciais",
              amountCents: honorariaCents,
            },
          ]
        : []),
      ...(procedureCents
        ? [
            {
              kind: "Procedimentos" as const,
              label: profile.procedure,
              amountCents: procedureCents,
            },
          ]
        : []),
      ...(materialsCents
        ? [
            {
              kind: "Materiais" as const,
              label: "Materiais assistenciais",
              amountCents: materialsCents,
            },
          ]
        : []),
      ...(medicationCents
        ? [
            {
              kind: "Medicamentos" as const,
              label: "Medicamentos de uso ambulatorial",
              amountCents: medicationCents,
            },
          ]
        : []),
    ],
  };
});

const categoryByReason = {
  "Documentação incompleta": "Administrativa",
  "Divergência de autorização": "Técnica",
  "Tabela contratual": "Contratual",
} as const;

const contractByPayer: Record<
  string,
  { id: string; label: string; deadlineDays: number }
> = {
  "p-vita": {
    id: "DEMO-VC-2026",
    label: "Contrato demonstrativo Vida Clara 2026",
    deadlineDays: 12,
  },
  "p-plena": {
    id: "DEMO-SP-2026",
    label: "Contrato demonstrativo Saúde Plena 2026",
    deadlineDays: 10,
  },
  "p-municipal": {
    id: "DEMO-RM-2026",
    label: "Instrumento demonstrativo Rede Municipal 2026",
    deadlineDays: 14,
  },
  "p-particular": {
    id: "DEMO-PC-2026",
    label: "Condição demonstrativa Particular 2026",
    deadlineDays: 10,
  },
};

const glosaCases = demoData.events
  .filter((event) => event.type === "glosa")
  .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  .map((event, index) => {
    const invoice = demoData.invoices.find(
      (item) => item.id === event.invoiceId,
    );
    if (!invoice) throw new Error(`Fatura ausente para ${event.id}.`);
    const reason = event.reason as keyof typeof categoryByReason;
    const contract = contractByPayer[invoice.payerId];
    const settledAfterContest = demoData.events.some(
      (item) =>
        item.invoiceId === event.invoiceId &&
        (item.type === "glosa_reversal" || item.type === "write_off"),
    );
    const submitted = index % 3 !== 0 || settledAfterContest;
    const submittedAt = submitted
      ? addDays(event.date, 3 + (index % 3))
      : undefined;
    return {
      id: `GC-${event.invoiceId}`,
      eventId: event.id,
      invoiceId: event.invoiceId,
      category: categoryByReason[reason],
      reason,
      owner: [
        "Faturamento",
        "Auditoria assistencial",
        "Relacionamento com pagadores",
      ][index % 3],
      contractId: contract.id,
      contractLabel: contract.label,
      contractualDays: contract.deadlineDays,
      notificationAt: event.date,
      // Prazos são convenções contratuais fictícias por pagador neste demonstrativo.
      contractualDeadline: addDays(event.date, contract.deadlineDays),
      protocol: submitted
        ? `PRT-${event.invoiceId.slice(2)}-${String(index + 1).padStart(2, "0")}`
        : undefined,
      submittedAt,
      responseDueDate: submittedAt
        ? addDays(submittedAt, contract.deadlineDays)
        : undefined,
    };
  });

export const healthDemo: HealthData = { accounts, glosaCases };
