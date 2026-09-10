import { calculateDashboard } from "./finance";
import type { Dataset, Filters, Invoice } from "./types";

export type GuideType = "Consulta" | "SADT" | "Procedimento ambulatorial";
export type AuthorizationStatus = "Autorizado" | "Dispensado" | "Pendente";
export type DocumentStatus = "Conferido" | "Pendente" | "Não aplicável";
export type GlosaCategory = "Administrativa" | "Técnica" | "Contratual";
export type GlosaWorkflowStatus =
  | "A preparar"
  | "Em análise"
  | "Liberada a receber"
  | "Recebida"
  | "Baixada";

export interface HealthDocument {
  label: string;
  status: DocumentStatus;
  scope: "Checklist da emissão";
}

export interface HealthItem {
  kind: "Honorários" | "Procedimentos" | "Materiais" | "Medicamentos";
  label: string;
  amountCents: number;
}

export interface HealthAccount {
  invoiceId: string;
  specialty: string;
  procedure: string;
  internalCode: string;
  guideType: GuideType;
  guideNumber: string;
  authorizationStatus: AuthorizationStatus;
  billingLagDays: number;
  documents: HealthDocument[];
  /** Itens sintéticos que somam exatamente o valor da fatura financeira. */
  items: HealthItem[];
}

export interface GlosaCase {
  id: string;
  eventId: string;
  invoiceId: string;
  category: GlosaCategory;
  reason: string;
  owner: string;
  contractId: string;
  contractLabel: string;
  contractualDays: number;
  notificationAt: string;
  contractualDeadline: string;
  protocol?: string;
  submittedAt?: string;
  responseDueDate?: string;
}

export interface HealthData {
  accounts: HealthAccount[];
  glosaCases: GlosaCase[];
}

export interface GlosaCasePosition {
  id: string;
  eventId: string;
  invoiceId: string;
  payerName: string;
  unitName: string;
  service: string;
  specialty: string;
  procedure: string;
  guideType: GuideType;
  guideNumber: string;
  category: GlosaCategory;
  reason: string;
  owner: string;
  responsible: string;
  contractId: string;
  contractLabel: string;
  contractualDays: number;
  protocol?: string;
  registeredDate: string;
  notificationAt: string;
  dueDate: string;
  contractualDeadline: string;
  submittedAt?: string;
  appealDueDate?: string;
  responseDueDate?: string;
  status: GlosaWorkflowStatus;
  amountCents: number;
  glosedCents: number;
  reversedCents: number;
  recoveredCashCents: number;
  writtenOffCents: number;
  underDiscussionCents: number;
  releasedToReceiveCents: number;
  documents: HealthDocument[];
  events: Array<{
    date: string;
    type: string;
    label: string;
    amountCents: number;
    recoveredCents?: number;
  }>;
  recommendation: string;
  priority: {
    level: "Alta" | "Média" | "Baixa";
    reason: string;
    dueState: "Vencido" | "Próximo" | "Sem prazo" | "Em dia";
    deadlineType: "Submissão" | "Resposta" | "Sem prazo";
  };
}

export interface HealthAnalytics {
  asOf: string;
  accounts: HealthAccount[];
  cases: GlosaCasePosition[];
  summary: {
    billedVolume: number;
    billedCents: number;
    averageTicketCents: number | null;
    averageBillingLagDays: number | null;
    completeDocumentsPct: number | null;
    cohortGlosaRatePct: number | null;
    cohortReversalRatePct: number | null;
    cohortCashRecoveryRatePct: number | null;
  };
  specialtyBreakdown: Array<{
    name: string;
    invoiceCount: number;
    billedCents: number;
    averageTicketCents: number | null;
    completeDocumentsPct: number | null;
    glosaCents: number;
    cohortGlosaRatePct: number | null;
  }>;
  payerScorecards: Array<{
    id: string;
    name: string;
    invoiceCount: number;
    billedCents: number;
    glosaCents: number;
    cohortGlosaRatePct: number | null;
    recoveryCents: number;
    cohortCashRecoveryRatePct: number | null;
  }>;
  paretoReasons: Array<{
    name: string;
    category: GlosaCategory;
    amountCents: number;
    count: number;
    cumulativePct: number;
  }>;
  glosa: {
    registeredCents: number;
    disputedCents: number;
    reversedAwaitingCashCents: number;
    recoveredCashCents: number;
    writtenOffCents: number;
    registeredCount: number;
    disputedCount: number;
    reversedAwaitingCashCount: number;
    recoveredCashCount: number;
    writtenOffCount: number;
    periodNotifications: { amountCents: number; count: number };
    reasons: Array<{ name: string; amountCents: number; count: number }>;
    cohorts: Array<{
      month: string;
      registeredCents: number;
      reversedCents: number;
      recoveredCashCents: number;
      writtenOffCents: number;
      caseCount: number;
    }>;
  };
  queues: {
    overdue: GlosaCasePosition[];
    dueSoon: GlosaCasePosition[];
    toPrepare: GlosaCasePosition[];
    releasedToReceive: GlosaCasePosition[];
  };
}

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);
const inRange = (date: string, start: string, end: string) =>
  date >= start && date <= end;
const addDays = (date: string, days: number) => {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};
const isDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

function isSelected(invoice: Invoice, filters: Filters): boolean {
  return (
    (filters.unitId === "all" || invoice.unitId === filters.unitId) &&
    (filters.payerId === "all" || invoice.payerId === filters.payerId)
  );
}

function documentsComplete(documents: HealthDocument[]) {
  return documents.every((document) => document.status !== "Pendente");
}

function makePosition(
  data: Dataset,
  healthData: HealthData,
  item: GlosaCase,
  asOf: string,
): GlosaCasePosition | null {
  const invoice = data.invoices.find((entry) => entry.id === item.invoiceId);
  const account = healthData.accounts.find(
    (entry) => entry.invoiceId === item.invoiceId,
  );
  const glosaEvent = data.events.find((entry) => entry.id === item.eventId);
  if (
    !invoice ||
    !account ||
    !glosaEvent ||
    glosaEvent.date > asOf ||
    !isDate(item.notificationAt) ||
    item.notificationAt !== glosaEvent.date ||
    item.notificationAt > asOf
  )
    return null;
  const eventPriority: Record<string, number> = {
    glosa: 0,
    appeal_submission: 1,
    glosa_reversal: 2,
    write_off: 3,
    payment: 4,
  };
  const eventList = data.events
    .filter((event) => event.invoiceId === invoice.id && event.date <= asOf)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        eventPriority[a.type] - eventPriority[b.type] ||
        a.id.localeCompare(b.id),
    );
  const reversedCents = sum(
    eventList
      .filter((event) => event.type === "glosa_reversal")
      .map((event) => event.amountCents),
  );
  const recoveredCashCents = sum(
    eventList
      .filter((event) => event.type === "payment")
      .map((event) => event.recoveredCents ?? 0),
  );
  const writtenOffCents = sum(
    eventList
      .filter((event) => event.type === "write_off")
      .map((event) => event.amountCents),
  );
  const underDiscussionCents = Math.max(
    0,
    glosaEvent.amountCents - reversedCents - writtenOffCents,
  );
  const releasedToReceiveCents = Math.max(
    0,
    reversedCents - recoveredCashCents,
  );
  const submitted =
    item.submittedAt !== undefined &&
    isDate(item.submittedAt) &&
    item.submittedAt <= asOf &&
    Boolean(item.protocol?.trim());
  let status: GlosaWorkflowStatus;
  if (underDiscussionCents > 0)
    status = submitted ? "Em análise" : "A preparar";
  else if (releasedToReceiveCents > 0) status = "Liberada a receber";
  else if (writtenOffCents > 0) status = "Baixada";
  else status = "Recebida";
  const currentDeadline =
    underDiscussionCents > 0
      ? submitted
        ? item.responseDueDate
        : item.contractualDeadline
      : undefined;
  const deadlineType =
    currentDeadline === undefined
      ? "Sem prazo"
      : submitted
        ? "Resposta"
        : "Submissão";
  const dueState: GlosaCasePosition["priority"]["dueState"] =
    currentDeadline === undefined
      ? "Sem prazo"
      : currentDeadline < asOf &&
          (status === "A preparar" || status === "Em análise")
        ? "Vencido"
        : currentDeadline <= addDays(asOf, 7) &&
            (status === "A preparar" || status === "Em análise")
          ? "Próximo"
          : "Em dia";
  const priority: GlosaCasePosition["priority"] =
    dueState === "Vencido"
      ? {
          level: "Alta" as const,
          reason: `Prazo de ${deadlineType.toLowerCase()} demonstrativo vencido; confirmar a regra contratual aplicável.`,
          dueState,
          deadlineType,
        }
      : releasedToReceiveCents > 0 || dueState === "Próximo"
        ? {
            level: "Média" as const,
            reason:
              releasedToReceiveCents > 0
                ? "Reversão registrada, aguardando entrada de caixa."
                : `Prazo de ${deadlineType.toLowerCase()} demonstrativo próximo; conferir documentação.`,
            dueState,
            deadlineType,
          }
        : {
            level: "Baixa" as const,
            reason: "Sem ação priorizada pelo motor no corte selecionado.",
            dueState,
            deadlineType,
          };
  const nextAction =
    status === "A preparar"
      ? "Conferir documentos e fundamento antes de submeter a contestação."
      : status === "Em análise"
        ? "Acompanhar resposta do pagador pelo protocolo registrado."
        : status === "Liberada a receber"
          ? "Conciliar o valor liberado com o próximo recebimento em caixa."
          : status === "Recebida"
            ? "Recuperação conciliada no caixa demonstrativo."
            : recoveredCashCents > 0
              ? "Encerrada com baixa parcial e recuperação; registrar o motivo e avaliar prevenção no faturamento."
              : "Encerrada com baixa integral; registrar o motivo e avaliar prevenção no faturamento.";
  const recommendation =
    writtenOffCents > 0 &&
    (underDiscussionCents > 0 || releasedToReceiveCents > 0)
      ? `${nextAction} Há baixa parcial registrada; os saldos restantes continuam em acompanhamento.`
      : nextAction;
  const labels: Record<string, string> = {
    glosa: "Glosa registrada",
    glosa_reversal: "Glosa revertida",
    payment: "Pagamento da conta",
    write_off: "Baixa definitiva",
  };
  return {
    id: item.id,
    eventId: item.eventId,
    invoiceId: invoice.id,
    payerName:
      data.payers.find((payer) => payer.id === invoice.payerId)?.name ??
      invoice.payerId,
    unitName:
      data.units.find((unit) => unit.id === invoice.unitId)?.name ??
      invoice.unitId,
    service: invoice.service,
    specialty: account.specialty,
    procedure: account.procedure,
    guideType: account.guideType,
    guideNumber: account.guideNumber,
    category: item.category,
    reason: item.reason,
    owner: item.owner,
    responsible: item.owner,
    contractId: item.contractId,
    contractLabel: item.contractLabel,
    contractualDays: item.contractualDays,
    protocol: submitted ? item.protocol : undefined,
    registeredDate: item.notificationAt,
    notificationAt: item.notificationAt,
    dueDate: item.contractualDeadline,
    contractualDeadline: item.contractualDeadline,
    submittedAt: submitted ? item.submittedAt : undefined,
    appealDueDate: submitted ? item.responseDueDate : undefined,
    responseDueDate: submitted ? item.responseDueDate : undefined,
    status,
    amountCents: glosaEvent.amountCents,
    glosedCents: glosaEvent.amountCents,
    reversedCents,
    recoveredCashCents,
    writtenOffCents,
    underDiscussionCents,
    releasedToReceiveCents,
    documents: account.documents,
    events: [
      ...eventList.map((event) => ({
        date: event.date,
        type: event.type,
        label: labels[event.type] ?? event.type,
        amountCents: event.amountCents,
        recoveredCents: event.recoveredCents,
      })),
      ...(submitted && item.submittedAt
        ? [
            {
              date: item.submittedAt,
              type: "appeal_submission",
              label: "Contestação submetida",
              amountCents: 0,
            },
          ]
        : []),
    ].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        eventPriority[a.type] - eventPriority[b.type],
    ),
    recommendation,
    priority,
  };
}

/** Validates the synthetic health extension without changing the financial source of truth. */
export function validateHealthData(
  data: Dataset,
  healthData: HealthData,
): string[] {
  const errors: string[] = [];
  const invoiceIds = new Set(data.invoices.map((invoice) => invoice.id));
  const accounts = new Set<string>();
  healthData.accounts.forEach((account) => {
    if (!invoiceIds.has(account.invoiceId))
      errors.push(`Conta assistencial sem fatura: ${account.invoiceId}.`);
    else if (accounts.has(account.invoiceId))
      errors.push(`Conta assistencial duplicada: ${account.invoiceId}.`);
    else accounts.add(account.invoiceId);
    if (!/^INT-[A-Z0-9-]+$/.test(account.internalCode))
      errors.push(`Código interno inválido: ${account.invoiceId}.`);
    if (account.billingLagDays < 0 || !Number.isInteger(account.billingLagDays))
      errors.push(`Prazo de faturamento inválido: ${account.invoiceId}.`);
    const invoice = data.invoices.find(
      (entry) => entry.id === account.invoiceId,
    );
    if (
      invoice &&
      sum(account.items.map((item) => item.amountCents)) !== invoice.amountCents
    )
      errors.push(
        `Itens assistenciais não conciliam com a fatura: ${account.invoiceId}.`,
      );
  });
  invoiceIds.forEach((invoiceId) => {
    if (!accounts.has(invoiceId))
      errors.push(`Fatura sem conta assistencial: ${invoiceId}.`);
  });
  const cases = new Set<string>();
  const caseInvoices = new Set<string>();
  const glosaEvents = data.events.filter((event) => event.type === "glosa");
  const glosaEventIds = new Set(glosaEvents.map((event) => event.id));
  const glosaCountByInvoice = new Map<string, number>();
  glosaEvents.forEach((event) =>
    glosaCountByInvoice.set(
      event.invoiceId,
      (glosaCountByInvoice.get(event.invoiceId) ?? 0) + 1,
    ),
  );
  glosaCountByInvoice.forEach((count, invoiceId) => {
    if (count > 1)
      errors.push(
        `Mais de um evento de glosa sem alocação por conta: ${invoiceId}.`,
      );
  });
  const referencedGlosaEvents = new Set<string>();
  healthData.glosaCases.forEach((item) => {
    const event = data.events.find((entry) => entry.id === item.eventId);
    if (cases.has(item.id)) errors.push(`Caso de glosa duplicado: ${item.id}.`);
    else cases.add(item.id);
    if (!event || event.type !== "glosa" || event.invoiceId !== item.invoiceId)
      errors.push(`Caso de glosa sem evento compatível: ${item.id}.`);
    else referencedGlosaEvents.add(event.id);
    if (caseInvoices.has(item.invoiceId))
      errors.push(
        `Mais de uma glosa sem alocação por conta: ${item.invoiceId}.`,
      );
    else caseInvoices.add(item.invoiceId);
    if (!isDate(item.notificationAt) || item.notificationAt !== event?.date)
      errors.push(`Notificação incompatível com a glosa: ${item.id}.`);
    if (
      !isDate(item.contractualDeadline) ||
      item.contractualDeadline < item.notificationAt
    )
      errors.push(`Prazo contratual inválido: ${item.id}.`);
    if (
      item.submittedAt &&
      (!isDate(item.submittedAt) || item.submittedAt < item.notificationAt)
    )
      errors.push(`Submissão anterior à notificação: ${item.id}.`);
    if (item.submittedAt && !item.protocol?.trim())
      errors.push(`Submissão sem protocolo: ${item.id}.`);
    if (
      item.responseDueDate &&
      (!item.submittedAt ||
        !isDate(item.responseDueDate) ||
        item.responseDueDate < item.submittedAt)
    )
      errors.push(`Prazo de resposta sem submissão válida: ${item.id}.`);
    if (
      !item.contractId.trim() ||
      !item.contractLabel.trim() ||
      !Number.isInteger(item.contractualDays) ||
      item.contractualDays < 1
    )
      errors.push(`Referência contratual inválida: ${item.id}.`);
  });
  glosaEventIds.forEach((eventId) => {
    if (!referencedGlosaEvents.has(eventId))
      errors.push(`Evento de glosa sem caso: ${eventId}.`);
  });
  return errors;
}

/** Calculates health-specific operational metrics from financial events visible on the selected cut. */
export function calculateHealth(
  data: Dataset,
  healthData: HealthData,
  filters: Filters,
): HealthAnalytics {
  const dashboard = calculateDashboard(data, filters);
  const asOf = dashboard.asOf;
  const start = `${filters.startMonth}-01`;
  const cohortInvoices = data.invoices.filter(
    (invoice) =>
      isSelected(invoice, filters) && inRange(invoice.billedDate, start, asOf),
  );
  const cohortIds = new Set(cohortInvoices.map((invoice) => invoice.id));
  const accounts = healthData.accounts.filter((account) =>
    cohortIds.has(account.invoiceId),
  );
  const cases = healthData.glosaCases
    .map((item) => makePosition(data, healthData, item, asOf))
    .filter((item): item is GlosaCasePosition => item !== null)
    .filter((item) => {
      const invoice = data.invoices.find(
        (entry) => entry.id === item.invoiceId,
      );
      return invoice !== undefined && isSelected(invoice, filters);
    });
  const cohortCases = cases.filter((item) => cohortIds.has(item.invoiceId));
  const billedCents = sum(cohortInvoices.map((invoice) => invoice.amountCents));
  const cohortGlosaCents = sum(cohortCases.map((item) => item.glosedCents));
  const cohortReversedCents = sum(
    cohortCases.map((item) => item.reversedCents),
  );
  const cohortRecoveredCents = sum(
    cohortCases.map((item) => item.recoveredCashCents),
  );
  const summary: HealthAnalytics["summary"] = {
    billedVolume: cohortInvoices.length,
    billedCents,
    averageTicketCents: cohortInvoices.length
      ? billedCents / cohortInvoices.length
      : null,
    averageBillingLagDays: accounts.length
      ? sum(accounts.map((account) => account.billingLagDays)) / accounts.length
      : null,
    completeDocumentsPct: accounts.length
      ? (accounts.filter((account) => documentsComplete(account.documents))
          .length /
          accounts.length) *
        100
      : null,
    cohortGlosaRatePct: billedCents
      ? (cohortGlosaCents / billedCents) * 100
      : null,
    cohortReversalRatePct: billedCents
      ? (cohortReversedCents / billedCents) * 100
      : null,
    cohortCashRecoveryRatePct: billedCents
      ? (cohortRecoveredCents / billedCents) * 100
      : null,
  };
  const specialtyBreakdown = Array.from(
    new Set(accounts.map((account) => account.specialty)),
  )
    .map((name) => {
      const accountSet = accounts.filter(
        (account) => account.specialty === name,
      );
      const ids = new Set(accountSet.map((account) => account.invoiceId));
      const invoices = cohortInvoices.filter((invoice) => ids.has(invoice.id));
      const subtotal = sum(invoices.map((invoice) => invoice.amountCents));
      const glosaCents = sum(
        cohortCases
          .filter((item) => ids.has(item.invoiceId))
          .map((item) => item.glosedCents),
      );
      return {
        name,
        invoiceCount: invoices.length,
        billedCents: subtotal,
        averageTicketCents: invoices.length ? subtotal / invoices.length : null,
        completeDocumentsPct: accountSet.length
          ? (accountSet.filter((account) =>
              documentsComplete(account.documents),
            ).length /
              accountSet.length) *
            100
          : null,
        glosaCents,
        cohortGlosaRatePct: subtotal ? (glosaCents / subtotal) * 100 : null,
      };
    })
    .sort((a, b) => b.billedCents - a.billedCents);
  const payerScorecards = data.payers
    .filter(
      (payer) => filters.payerId === "all" || payer.id === filters.payerId,
    )
    .map((payer) => {
      const invoices = cohortInvoices.filter(
        (invoice) => invoice.payerId === payer.id,
      );
      const ids = new Set(invoices.map((invoice) => invoice.id));
      const payerCases = cohortCases.filter((item) => ids.has(item.invoiceId));
      const subtotal = sum(invoices.map((invoice) => invoice.amountCents));
      const glosaCents = sum(payerCases.map((item) => item.glosedCents));
      const recoveryCents = sum(
        payerCases.map((item) => item.recoveredCashCents),
      );
      return {
        id: payer.id,
        name: payer.name,
        invoiceCount: invoices.length,
        billedCents: subtotal,
        glosaCents,
        cohortGlosaRatePct: subtotal ? (glosaCents / subtotal) * 100 : null,
        recoveryCents,
        cohortCashRecoveryRatePct: subtotal
          ? (recoveryCents / subtotal) * 100
          : null,
      };
    })
    .filter((item) => item.invoiceCount > 0)
    .sort((a, b) => b.billedCents - a.billedCents);
  const reasonGroups = Object.values(
    cases.reduce<
      Record<
        string,
        {
          name: string;
          category: GlosaCategory;
          amountCents: number;
          count: number;
        }
      >
    >((all, item) => {
      const key = `${item.category}/${item.reason}`;
      const current = all[key] ?? {
        name: item.reason,
        category: item.category,
        amountCents: 0,
        count: 0,
      };
      current.amountCents += item.glosedCents;
      current.count += 1;
      all[key] = current;
      return all;
    }, {}),
  ).sort((a, b) => b.amountCents - a.amountCents);
  const reasonTotalCents = sum(reasonGroups.map((item) => item.amountCents));
  let cumulative = 0;
  const paretoReasons = reasonGroups.map((item) => {
    cumulative += item.amountCents;
    return {
      ...item,
      cumulativePct: reasonTotalCents
        ? (cumulative / reasonTotalCents) * 100
        : 0,
    };
  });
  const reconciliation = {
    registeredCents: sum(cases.map((item) => item.glosedCents)),
    disputedCents: sum(cases.map((item) => item.underDiscussionCents)),
    reversedAwaitingCashCents: sum(
      cases.map((item) => item.releasedToReceiveCents),
    ),
    recoveredCashCents: sum(cases.map((item) => item.recoveredCashCents)),
    writtenOffCents: sum(cases.map((item) => item.writtenOffCents)),
    registeredCount: cases.length,
    disputedCount: cases.filter((item) => item.underDiscussionCents > 0).length,
    reversedAwaitingCashCount: cases.filter(
      (item) => item.releasedToReceiveCents > 0,
    ).length,
    recoveredCashCount: cases.filter((item) => item.recoveredCashCents > 0)
      .length,
    writtenOffCount: cases.filter((item) => item.writtenOffCents > 0).length,
    periodNotifications: {
      amountCents: sum(
        cases
          .filter((item) => inRange(item.registeredDate, start, asOf))
          .map((item) => item.glosedCents),
      ),
      count: cases.filter((item) => inRange(item.registeredDate, start, asOf))
        .length,
    },
  };
  const glosa = {
    ...reconciliation,
    reasons: reasonGroups.map(({ name, amountCents, count }) => ({
      name,
      amountCents,
      count,
    })),
    cohorts: Array.from(
      new Set(cases.map((item) => item.registeredDate.slice(0, 7))),
    )
      .sort()
      .map((month) => {
        const items = cases.filter((item) =>
          item.registeredDate.startsWith(month),
        );
        return {
          month,
          registeredCents: sum(items.map((item) => item.glosedCents)),
          reversedCents: sum(items.map((item) => item.reversedCents)),
          recoveredCashCents: sum(items.map((item) => item.recoveredCashCents)),
          writtenOffCents: sum(items.map((item) => item.writtenOffCents)),
          caseCount: items.length,
        };
      }),
  };
  const prioritySort = (a: GlosaCasePosition, b: GlosaCasePosition) =>
    b.underDiscussionCents - a.underDiscussionCents ||
    a.dueDate.localeCompare(b.dueDate);
  return {
    asOf,
    accounts,
    cases,
    summary,
    specialtyBreakdown,
    payerScorecards,
    paretoReasons,
    glosa,
    queues: {
      overdue: cases
        .filter((item) => item.priority.dueState === "Vencido")
        .sort(prioritySort),
      dueSoon: cases
        .filter((item) => item.priority.dueState === "Próximo")
        .sort(prioritySort),
      toPrepare: cases
        .filter((item) => item.status === "A preparar")
        .sort(prioritySort),
      releasedToReceive: cases
        .filter((item) => item.releasedToReceiveCents > 0)
        .sort(prioritySort),
    },
  };
}
